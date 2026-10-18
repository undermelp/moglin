import * as THREE from 'three'
import { createTextures } from './textures.js'
import { Arena, groundHeight } from './arena.js'
import { GrassLantern } from './grass.js'
import { Rain } from './rain.js'
import { Player } from './player.js'
import { Crossbow } from './crossbow.js'
import { Guns } from './guns.js'
import { Arrows } from './arrows.js'
import { EnergyBalls } from './energy.js'
import { Molotovs, BURN_DPS } from './molotovs.js'
import { Horde } from './horde.js'
import { Effects } from './effects.js'
import { Gems } from './gems.js'
import { Progress } from './progress.js'
import { rollPerk } from './perks.js'
import { Input } from './input.js'
import { Hud } from './hud.js'
import { Sfx } from './audio.js'

const MELEE_RANGE = 2.55
const MELEE_ARC = 1.05
const MELEE_KNOCK = 8
const SLOW_MO_DURATION = 1
const SLOW_MO_SCALE = 0.28
const SLOW_MO_PLAYER_SCALE = 0.72
const LEVEL_WAVE_RADIUS = 14
const LEVEL_WAVE_DAMAGE = 32
const LEVEL_WAVE_KNOCK = 11
const LEVEL_WAVE_COLOR = 0x7ef6e4
const LEVEL_DAMAGE_MULT = 1.06
const LIGHTNING_INTERVAL = 4
const LIGHTNING_RANGE = 22
const LIGHTNING_DAMAGE = 80
const LIGHTNING_KNOCK = 9
const HIT_HEAR = 56
const BEST_TIME_KEY = 'horde.bestTime'

function loadBestTime() {
  const raw = Number(localStorage.getItem(BEST_TIME_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

function saveBestTime(seconds) {
  localStorage.setItem(BEST_TIME_KEY, String(seconds))
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.28
    this.renderer.domElement.id = 'view'
    document.body.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0b1016)
    this.scene.fog = new THREE.FogExp2(0x0b1016, 0.0012)

    this.camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.08, 3600)
    this.scene.add(this.camera)

    const textures = createTextures()
    this.arena = new Arena(this.scene)
    this.grass = new GrassLantern(this.scene, textures)
    this.rain = new Rain(this.scene)
    this.player = new Player(this.camera)
    this.crossbow = new Crossbow(this.camera)
    this.guns = new Guns(this.camera)
    this.weapon = this.crossbow
    this.arrows = new Arrows(this.scene)
    this.energy = new EnergyBalls(this.scene)
    this.molotovs = new Molotovs(this.scene)
    this.horde = new Horde(this.scene, textures.enemyFrames)
    this.effects = new Effects(this.scene)
    this.gems = new Gems(this.scene)
    this.progress = new Progress()
    this.input = new Input(this.renderer.domElement)
    this.hud = new Hud()
    this.audio = new Sfx()

    this.state = 'menu'
    this.kills = 0
    this.aliveTime = 0
    this.bestTime = loadBestTime()
    this.earned = []
    this.slowMo = 0
    this.lightningTimer = LIGHTNING_INTERVAL
    this.forward = new THREE.Vector3()
    this.hitNormal = new THREE.Vector3()
    this.hitPoint = new THREE.Vector3()
    this.hitSoundReady = true
    this.clock = new THREE.Clock()
    this.frameLamps = []
    this.motion = { moving: false, sliding: false, fireRate: 1 }
    this.arrowCtx = {
      enemies: null,
      blocks: null,
      onEnemyHit: (enemy, head, x, y, z, kx, kz) => this.onArrowHit(enemy, head, x, y, z, kx, kz),
    }
    this.energyCtx = {
      enemies: null,
      blocks: null,
      onEnemyHit: (enemy, head, x, y, z, kx, kz) => this.onArrowHit(enemy, head, x, y, z, kx, kz),
      onExplode: (x, y, z, radius, dx, dz) => this.onEnergyExplode(x, y, z, radius, dx, dz),
    }
    this.molotovCtx = {
      enemies: null,
      blocks: null,
      damageMult: 1,
      onIgnite: (x, z) => {
        this.audio.splash()
        this.hitNormal.set(0, 1, 0)
        this.hitPoint.set(x, groundHeight(x, z) + 0.2, z)
        this.effects.spark(this.hitPoint, 0xff6a22, this.hitNormal)
      },
      onBurn: (enemy, killed) => {
        if (killed) this.onKill(enemy)
      },
    }
    this.hudState = {
      health: 0,
      maxHealth: 100,
      mag: '∞',
      reserve: '',
      reloading: false,
      wave: 1,
      kills: 0,
      level: 1,
      xp: 0,
      xpNeed: 1,
      weapon: '',
      molotovs: 0,
    }

    this.awaitingLock = false
    this.horde.preview(this.arena.blocks)
    this.player.place(0)
    this.hud.showMenu(formatTime(this.bestTime))

    window.addEventListener('resize', () => this.resize())
    document.addEventListener('click', () => this.onClick())
    document.addEventListener('pointerlockerror', () => {
      this.awaitingLock = false
    })
    this.tick = this.tick.bind(this)
    requestAnimationFrame(this.tick)
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  requestLock() {
    const canvas = this.renderer.domElement
    if (document.pointerLockElement !== canvas) {
      this.awaitingLock = true
      const lock = canvas.requestPointerLock()
      if (lock && lock.catch) lock.catch(() => {})
    }
  }

  onClick() {
    this.audio.ensure()
    if (this.state === 'dead') return
    if (this.state === 'menu') this.start()
    this.requestLock()
  }

  start() {
    this.state = 'playing'
    this.kills = 0
    this.aliveTime = 0
    this.earned = []
    this.slowMo = 0
    this.lightningTimer = LIGHTNING_INTERVAL
    this.player.reset()
    this.guns.hide()
    this.crossbow.group.visible = true
    this.weapon = this.crossbow
    this.weapon.reset()
    this.arrows.clear()
    this.energy.clear()
    this.molotovs.clear()
    this.effects.clear()
    this.gems.reset()
    this.progress.reset()
    this.horde.begin(this.player, this.arena.blocks)
    this.hud.setPerks(this.earned)
    this.hud.announce('WAVE 1')
    this.audio.wave()
    this.syncHud()
  }

  restart() {
    this.start()
  }

  syncHud() {
    const state = this.hudState
    state.health = this.player.health
    state.maxHealth = this.player.maxHealth
    state.mag = '∞'
    state.reserve = ''
    state.reloading = false
    state.wave = Math.max(1, this.horde.wave)
    state.kills = this.kills
    state.level = this.progress.level
    state.xp = Math.floor(this.progress.xp)
    state.xpNeed = this.progress.need
    state.weapon = this.weapon.name
    state.molotovs = this.player.molotovs
    this.hud.sync(state)
  }

  /** Merge arrow + energy soft-lanterns into one reused list for the frame. */
  collectFrameLamps() {
    const arrowLamps = this.arrows.collectLamps()
    const energyLamps = this.energy.collectLamps()
    const out = this.frameLamps
    let n = 0
    for (let i = 0; i < arrowLamps.length; i++) {
      let lamp = out[n]
      if (!lamp) {
        lamp = { x: 0, z: 0, w: 0 }
        out[n] = lamp
      }
      const src = arrowLamps[i]
      lamp.x = src.x
      lamp.z = src.z
      lamp.w = src.w
      n += 1
    }
    for (let i = 0; i < energyLamps.length; i++) {
      let lamp = out[n]
      if (!lamp) {
        lamp = { x: 0, z: 0, w: 0 }
        out[n] = lamp
      }
      const src = energyLamps[i]
      lamp.x = src.x
      lamp.z = src.z
      lamp.w = src.w
      n += 1
    }
    out.length = n
    return out
  }

  onKill(enemy) {
    this.kills += 1
    this.gems.drop(enemy.x, enemy.z, this.arena.blocks, this.horde.enemies, enemy.drop)
    if (this.player.lifesteal > 0) this.player.heal(this.player.lifesteal)
  }

  tryIgnite(enemy) {
    if (!enemy.alive) return
    if (this.weapon.ignite) {
      enemy.ignite(BURN_DPS * this.player.damageMult)
      return
    }
    if (this.player.igniteChance <= 0) return
    if (Math.random() >= this.player.igniteChance) return
    enemy.ignite(BURN_DPS * this.player.damageMult)
  }

  onArrowHit(enemy, head, x, y, z, knockX, knockZ) {
    const headMult = this.weapon.headMultiplier + this.player.headBonus
    const amount = this.weapon.damage * this.player.damageMult * (head ? headMult : 1)
    const knock = this.player.knockMult
    const killed = enemy.damage(amount, knockX * knock, knockZ * knock)
    this.hud.markHit(head)
    if (this.hitSoundReady) {
      this.audio.hit(head, this.impactVolume(x, y, z))
      this.hitSoundReady = false
    }
    this.hitNormal.set(0, 1, 0)
    this.hitPoint.set(x, y, z)
    this.effects.spark(this.hitPoint, head ? 0xffe29a : 0xff5a2a, this.hitNormal)
    if (killed) this.onKill(enemy)
    else this.tryIgnite(enemy)
  }

  impactVolume(x, y, z) {
    const ear = this.player.camera.position
    const dist = Math.hypot(x - ear.x, y - ear.y, z - ear.z)
    return Math.max(0, 1 - dist / HIT_HEAR)
  }

  onEnergyExplode(x, y, z, radius, dirX, dirZ) {
    const loud = this.impactVolume(x, y, z)
    this.audio.plasmaBoom(loud)
    this.hitNormal.set(0, 1, 0)
    const color = this.weapon.ballColor || 0xff66cc
    this.hitPoint.set(x, y, z)
    this.effects.spark(this.hitPoint, color, this.hitNormal)
    this.effects.blastBurst(x, y, z, radius, color)
    const amount = this.weapon.damage * this.player.damageMult
    const knock = 5.5 * this.player.knockMult
    const enemies = this.horde.enemies
    let any = false
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy.alive) continue
      const dx = enemy.x - x
      const dz = enemy.z - z
      const dist = Math.hypot(dx, dz)
      const reach = radius + enemy.radius
      if (dist > reach) continue
      const falloff = 1 - (dist / reach) * 0.45
      let kx = dirX * knock
      let kz = dirZ * knock
      if (dist > 0.2) {
        kx = (dx / dist) * knock
        kz = (dz / dist) * knock
      }
      const killed = enemy.damage(amount * falloff, kx, kz)
      any = true
      this.hitPoint.set(enemy.x, groundHeight(enemy.x, enemy.z) + 1.1, enemy.z)
      this.effects.spark(this.hitPoint, color, this.hitNormal)
      if (killed) this.onKill(enemy)
      else this.tryIgnite(enemy)
    }
    if (any) {
      this.hud.markHit(false)
      if (this.hitSoundReady) {
        this.audio.hit(false, loud)
        this.hitSoundReady = false
      }
    }
  }

  giveGun() {
    this.weapon.group.visible = false
    this.weapon = this.guns.roll(this.weapon)
    this.weapon.group.visible = true
    this.weapon.reset()
  }

  givePerk() {
    const perk = rollPerk()
    perk.apply(this.player)
    let entry = null
    for (let i = 0; i < this.earned.length; i++) {
      if (this.earned[i].id === perk.id) {
        entry = this.earned[i]
        break
      }
    }
    if (entry) entry.count += 1
    else this.earned.push({ id: perk.id, name: perk.name, desc: perk.desc, count: 1 })
    this.hud.setPerks(this.earned)
    return perk
  }

  levelShockwave() {
    const x = this.player.x
    const z = this.player.z
    const y = groundHeight(x, z) + 0.35
    this.audio.chime()
    this.effects.shockwave(x, y, z, LEVEL_WAVE_RADIUS, LEVEL_WAVE_COLOR)
    this.hitNormal.set(0, 1, 0)
    this.hitPoint.set(x, y + 0.5, z)
    this.effects.spark(this.hitPoint, LEVEL_WAVE_COLOR, this.hitNormal)
    const amount = LEVEL_WAVE_DAMAGE * this.player.damageMult
    const knock = LEVEL_WAVE_KNOCK * this.player.knockMult
    const enemies = this.horde.enemies
    let any = false
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy.alive) continue
      const dx = enemy.x - x
      const dz = enemy.z - z
      const dist = Math.hypot(dx, dz)
      const reach = LEVEL_WAVE_RADIUS + enemy.radius
      if (dist > reach) continue
      const falloff = 1 - (dist / reach) * 0.4
      let kx = 0
      let kz = 0
      if (dist > 0.2) {
        kx = (dx / dist) * knock
        kz = (dz / dist) * knock
      }
      const killed = enemy.damage(amount * falloff, kx, kz)
      any = true
      this.hitPoint.set(enemy.x, groundHeight(enemy.x, enemy.z) + 1.1, enemy.z)
      this.effects.spark(this.hitPoint, LEVEL_WAVE_COLOR, this.hitNormal)
      if (killed) this.onKill(enemy)
    }
    if (any) this.hud.markHit(false)
  }

  tickLightning(dt) {
    if (this.player.lightning <= 0) {
      this.lightningTimer = LIGHTNING_INTERVAL
      return
    }
    this.lightningTimer -= dt
    if (this.lightningTimer > 0) return

    const px = this.player.x
    const pz = this.player.z
    const reach = LIGHTNING_RANGE
    const enemies = this.horde.enemies
    let enemy = null
    let seen = 0
    for (let i = 0; i < enemies.length; i++) {
      const candidate = enemies[i]
      if (!candidate.alive) continue
      const dx = candidate.x - px
      const dz = candidate.z - pz
      const limit = reach + candidate.radius
      if (dx * dx + dz * dz > limit * limit) continue
      seen += 1
      if (Math.random() * seen < 1) enemy = candidate
    }
    if (!enemy) {
      this.lightningTimer = 0
      return
    }

    this.lightningTimer = LIGHTNING_INTERVAL
    const dx = enemy.x - px
    const dz = enemy.z - pz
    const dist = Math.hypot(dx, dz) || 1
    const knock = LIGHTNING_KNOCK * this.player.knockMult
    const amount = LIGHTNING_DAMAGE * this.player.lightning * this.player.damageMult
    const killed = enemy.damage(amount, (dx / dist) * knock, (dz / dist) * knock)
    const y = groundHeight(enemy.x, enemy.z) + 1.15
    this.hitNormal.set(0, 1, 0)
    this.hitPoint.set(enemy.x, y, enemy.z)
    this.effects.lightning(enemy.x, y, enemy.z)
    this.effects.spark(this.hitPoint, 0xd6ecff, this.hitNormal)
    this.audio.lightning()
    this.hud.markHit(false)
    if (killed) this.onKill(enemy)
  }

  melee() {
    if (!this.weapon.swing()) return
    this.audio.swing()
    this.player.addKick()
    const forwardX = -Math.sin(this.player.yaw)
    const forwardZ = -Math.cos(this.player.yaw)
    const amount = this.weapon.damage * (this.weapon.pellets > 1 ? 2.5 : 1.25) * this.player.meleeMult
    const range = MELEE_RANGE * this.player.meleeRangeMult
    const arc = Math.cos(Math.min(1.45, MELEE_ARC * this.player.meleeArcMult))
    const knock = MELEE_KNOCK * this.player.knockMult
    const enemies = this.horde.enemies
    let hit = false
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy.alive) continue
      const dx = enemy.x - this.player.x
      const dz = enemy.z - this.player.z
      const dist = Math.hypot(dx, dz)
      if (dist > range + enemy.radius) continue
      let nx = forwardX
      let nz = forwardZ
      if (dist > 0.35) {
        nx = dx / dist
        nz = dz / dist
        if (nx * forwardX + nz * forwardZ < arc) continue
      }
      const killed = enemy.damage(amount, nx * knock, nz * knock)
      hit = true
      this.hitNormal.set(nx, 0.25, nz)
      this.hitPoint.set(enemy.x, groundHeight(enemy.x, enemy.z) + 1.15, enemy.z)
      this.effects.spark(this.hitPoint, 0xffe29a, this.hitNormal)
      if (killed) this.onKill(enemy)
      else this.tryIgnite(enemy)
    }
    if (hit) {
      this.hud.markHit(false)
      this.audio.hit(false, this.impactVolume(this.hitPoint.x, this.hitPoint.y, this.hitPoint.z))
    }
  }

  shoot() {
    if (this.weapon.sound === 'shot') this.audio.shot()
    else if (this.weapon.sound === 'smg') this.audio.smg()
    else if (this.weapon.sound === 'plasma') this.audio.plasma()
    else this.audio.bow()
    this.player.addKick()
    const muzzle = this.weapon.muzzleWorld()
    const x = muzzle.x
    const y = muzzle.y
    const z = muzzle.z
    const spread = this.weapon.spread
    const speed = this.weapon.arrowSpeed * this.player.arrowSpeedMult
    const energy = this.weapon.projectile === 'energy'
    for (let i = 0; i < this.weapon.pellets; i++) {
      this.camera.getWorldDirection(this.forward)
      this.forward.x += (Math.random() - 0.5) * spread
      this.forward.y += (Math.random() - 0.5) * spread
      this.forward.z += (Math.random() - 0.5) * spread
      this.forward.normalize()
      if (energy) {
        this.energy.spawn(
          x,
          y,
          z,
          this.forward.x,
          this.forward.y,
          this.forward.z,
          speed,
          this.weapon.boltSize,
          this.weapon.explodeRadius || 0,
          this.weapon.ballColor || 0x66e8ff,
          this.weapon.pierce || 1,
        )
      } else {
        this.arrows.spawn(
          x,
          y,
          z,
          this.forward.x,
          this.forward.y,
          this.forward.z,
          speed,
          this.weapon.boltSize,
          this.weapon.pierce || 1,
          this.weapon.projectile === 'bullet',
        )
      }
    }
  }

  throwMolotov() {
    if (this.player.molotovs <= 0) {
      this.audio.dry()
      return
    }
    this.player.molotovs -= 1
    this.audio.bow()
    this.player.addKick()
    this.camera.getWorldDirection(this.forward)
    this.molotovs.throw(
      this.camera.position.x + this.forward.x * 0.45,
      this.camera.position.y - 0.12,
      this.camera.position.z + this.forward.z * 0.45,
      this.forward.x,
      this.forward.y,
      this.forward.z,
    )
  }

  update(dt) {
    const input = this.input.consume()
    const running = this.state === 'playing' && input.locked
    if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt)

    if (input.locked) this.awaitingLock = false

    if (this.state === 'menu') {
      this.horde.present(dt, this.camera)
      const motion = this.motion
      motion.moving = false
      motion.sliding = false
      motion.fireRate = 1
      this.weapon.update(dt, motion, false)
      this.hud.showMenu(formatTime(this.bestTime))
      this.audio.swell(dt, 0, 0.08)
    } else if (this.state === 'dead') {
      this.hud.showDead(
        Math.max(1, this.horde.wave),
        this.kills,
        this.progress.level,
        null,
        formatTime(this.aliveTime),
        formatTime(this.bestTime),
      )
      this.audio.swell(dt, this.horde.wave, 0.35)
      if (input.reload) {
        this.audio.ensure()
        this.restart()
        this.requestLock()
      }
    } else if (!input.locked && !this.awaitingLock) {
      this.hud.showPause()
      this.audio.swell(dt, this.horde.wave, 0.2)
    } else {
      this.hud.hideScreen()
    }

    if (!running) {
      this.player.place(dt)
      this.gems.update(dt, this.player, false)
      if (this.state === 'playing') this.collectFrameLamps()
      else this.frameLamps.length = 0
      return
    }

    this.aliveTime += dt
    this.hitSoundReady = true

    const enemies = this.horde.enemies
    const circles = this.horde.prepareCircles(this.player)
    const playerDt = this.slowMo > 0 ? dt * SLOW_MO_PLAYER_SCALE : dt
    this.player.update(playerDt, input, this.arena.blocks, circles)
    if (this.player.slid) this.audio.slide()
    if (this.player.jumped) this.audio.hop()
    const picked = this.gems.update(dt, this.player, true)
    let leveled = 0
    let perk = null
    if (picked > 0) {
      this.audio.gem()
      leveled = this.progress.addGems(picked, this.player.xpMult)
    }
    if (leveled > 0) {
      this.slowMo = SLOW_MO_DURATION
      this.levelShockwave()
      for (let i = 0; i < leveled; i++) {
        this.player.damageMult *= LEVEL_DAMAGE_MULT
        perk = this.givePerk()
        this.giveGun()
        this.player.molotovs += 1
      }
    }

    if (input.melee) this.melee()
    if (input.throw) this.throwMolotov()
    const motion = this.motion
    motion.moving = this.player.moving || this.player.sliding
    motion.sliding = this.player.sliding
    motion.fireRate = this.player.fireRateMult
    const weaponEvent = this.weapon.update(dt, motion, input.fireHeld)
    if (weaponEvent === 'fire') this.shoot()

    const arrowCtx = this.arrowCtx
    arrowCtx.enemies = enemies
    arrowCtx.blocks = this.arena.blocks
    this.arrows.update(dt, arrowCtx)

    const energyCtx = this.energyCtx
    energyCtx.enemies = enemies
    energyCtx.blocks = this.arena.blocks
    this.energy.update(dt, energyCtx)

    const molotovCtx = this.molotovCtx
    molotovCtx.enemies = enemies
    molotovCtx.blocks = this.arena.blocks
    molotovCtx.damageMult = this.player.damageMult
    this.molotovs.update(dt, molotovCtx)

    const lamps = this.collectFrameLamps()
    const enemyDt = this.slowMo > 0 ? dt * SLOW_MO_SCALE : dt
    const horde = this.horde.update(enemyDt, this.player, this.arena.blocks, lamps)
    let alive = 0
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) alive++
    }
    this.audio.swell(dt, this.horde.wave, Math.min(1, alive / 80))
    this.audio.voices(dt, enemies, this.player.x, this.player.z)
    if (horde.damage > 0) {
      this.player.hurt(horde.damage)
      this.audio.hurt()
      this.hud.hurt()
    }
    this.tickLightning(dt)
    if (horde.event === 'wave') {
      const boss = this.horde.isBossWave()
      this.hud.announce(boss ? `WAVE ${this.horde.wave} · BOSS` : `WAVE ${this.horde.wave}`)
      this.audio.wave()
    }
    if (leveled > 0 && perk) {
      let count = 1
      for (let i = 0; i < this.earned.length; i++) {
        if (this.earned[i].id === perk.id) {
          count = this.earned[i].count
          break
        }
      }
      this.hud.announce(`LEVEL ${this.progress.level}`, `${this.weapon.name} · +1 molotov`)
      this.hud.showPerk(perk.name, perk.desc, count)
    }

    this.effects.update(dt)
    this.syncHud()

    if (this.player.health <= 0) {
      this.state = 'dead'
      if (this.aliveTime > this.bestTime) {
        this.bestTime = this.aliveTime
        saveBestTime(this.bestTime)
      }
      document.exitPointerLock()
      this.hud.showDead(
        Math.max(1, this.horde.wave),
        this.kills,
        this.progress.level,
        this.earned,
        formatTime(this.aliveTime),
        formatTime(this.bestTime),
      )
    }
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.grass.update(this.player.x, this.player.z, this.frameLamps)
    const rainDt = this.slowMo > 0 ? dt * SLOW_MO_SCALE : dt
    this.rain.update(rainDt, this.player.x, this.player.z, this.camera.position.y, this.player.velX, this.player.velZ)
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.tick)
  }
}

const probe = document.createElement('canvas')
if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
  document.body.innerHTML = '<p class="fail">WebGL is not available in this browser.</p>'
} else {
    try {
    window.__horde = new Game()
  } catch (error) {
    document.documentElement.dataset.pixel = `error:${error && error.message ? error.message : error}`
    console.error(error)
  }
}
