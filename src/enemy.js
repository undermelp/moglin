import * as THREE from 'three'
import { groundHeight } from './arena.js'
import { blocked, clampToRadius, moveWithCollision } from './collide.js'
import { nearestLanternFade } from './grass.js'

const MOVE_LIMIT = 640

const RADIUS = 0.46
const ATTACK_RANGE = 1.42
const ATTACK_WINDUP = 0.42
const ATTACK_COOLDOWN = 0.95
const SPAWN_TIME = 0.4
const DEATH_TIME = 0.5
const BURN_LIFE = 2
const BAR_W = 0.7
const HIT_TOP = 1.95
const HIT_HEAD = 1.05
/** Feet above enemy ground must clear this to pass over / avoid melee. */
export const ENEMY_CLEAR_HEIGHT = 1.25

const FLAME_OUTER = new THREE.MeshBasicMaterial({
  color: 0xff6a22,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
})
const FLAME_INNER = new THREE.MeshBasicMaterial({
  color: 0xffe08a,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
})
const FLAME_OUTER_GEO = new THREE.ConeGeometry(0.11, 0.34, 5)
const FLAME_INNER_GEO = new THREE.ConeGeometry(0.055, 0.2, 5)

function buildFlame() {
  const group = new THREE.Group()
  const outer = new THREE.Mesh(FLAME_OUTER_GEO, FLAME_OUTER.clone())
  outer.position.y = 0.16
  const inner = new THREE.Mesh(FLAME_INNER_GEO, FLAME_INNER.clone())
  inner.position.y = 0.1
  group.add(outer, inner)
  group.position.y = 1.28
  group.visible = false
  return group
}

export const ENEMY_FORMS = {
  normal: {
    scaleX: 1,
    scaleY: 1,
    radius: RADIUS,
    clear: ENEMY_CLEAR_HEIGHT,
    hp: 1,
    speed: 1,
    damage: 1,
    gold: false,
  },
  tall: {
    scaleX: 0.88,
    scaleY: 2.05,
    radius: RADIUS * 1.12,
    clear: 2.55,
    hp: 1.4,
    speed: 0.9,
    damage: 1.2,
    gold: true,
  },
  bulky: {
    scaleX: 2.05,
    scaleY: 1.2,
    radius: RADIUS * 2.05,
    clear: 1.55,
    hp: 1.85,
    speed: 0.72,
    damage: 1.45,
    gold: true,
  },
  boss: {
    scaleX: 3.6,
    scaleY: 3.4,
    radius: RADIUS * 3.4,
    clear: 4.1,
    hp: 20,
    speed: 0.5,
    damage: 2.4,
    gold: false,
    boss: true,
    drop: 'red',
  },
}

const BODY_GEO = new THREE.PlaneGeometry(1.15, 1.86)
const SHADOW_GEO = new THREE.CircleGeometry(0.42, 14)
const BAR_GEO = new THREE.PlaneGeometry(BAR_W, 0.045)
const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
})
const BAR_BG = new THREE.MeshBasicMaterial({
  color: 0x140c0c,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})

export const ENEMY_RADIUS = RADIUS

export class Enemy {
  constructor(x, z, frames, options) {
    this.material = new THREE.MeshBasicMaterial({
      map: frames[0],
      transparent: true,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    })
    this.frames = frames
    this.billboard = new THREE.Mesh(BODY_GEO, this.material)
    this.billboard.position.y = 0.93
    this.billboard.rotation.order = 'YXZ'
    this.billboard.userData.enemy = this

    this.hpMat = new THREE.MeshBasicMaterial({ color: 0xd24b3a, depthWrite: false })
    this.hpFill = new THREE.Mesh(BAR_GEO, this.hpMat)
    this.hpFill.position.z = 0.02
    const hpBg = new THREE.Mesh(BAR_GEO, BAR_BG)
    hpBg.position.z = 0.01
    this.bar = new THREE.Group()
    this.bar.position.y = 1.05
    this.bar.add(hpBg, this.hpFill)
    this.flame = buildFlame()
    this.billboard.add(this.bar, this.flame)

    this.shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT)
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.y = 0.025

    this.root = new THREE.Group()
    this.root.add(this.shadow, this.billboard)
    this.step = { x: 0, z: 0 }
    this.reset(x, z, frames, options)
  }

  reset(x, z, frames, options) {
    const form = ENEMY_FORMS[options.form] || ENEMY_FORMS.normal
    this.x = x
    this.z = z
    this.maxHp = options.hp
    this.hp = options.hp
    this.baseSpeed = options.speed
    this.speed = options.speed
    this.attackDamage = options.damage
    this.radius = form.radius
    this.clearHeight = form.clear
    this.hitTop = HIT_TOP * form.scaleY
    this.hitHead = HIT_HEAD * form.scaleY
    this.gold = form.gold
    this.boss = !!form.boss
    this.drop = form.drop || (form.gold ? 'gold' : null)
    this.scaleX = form.scaleX
    this.scaleY = form.scaleY
    this.alive = true
    this.gone = false
    this.spawn = SPAWN_TIME
    this.death = 0
    this.flash = 0
    this.attackCd = ATTACK_WINDUP
    this.phase = Math.random() * Math.PI * 2
    this.frame = 0
    this.frameT = 0
    this.knockX = 0
    this.knockZ = 0
    this.side = Math.random() < 0.5 ? -1 : 1
    this.baseScale = 0.94 + Math.random() * 0.18
    this.visualY = 0
    this.visualScale = 1
    this.burnLife = 0
    this.burnDps = 0

    this.frames = frames
    this.material.map = frames[0]
    this.material.opacity = 1
    this.material.alphaTest = 0.45
    this.material.depthWrite = true
    this.material.color.setRGB(1, 1, 1)
    this.shadow.visible = true
    this.bar.visible = false
    this.flame.visible = false
    this.root.visible = true
    this.syncBar()
    this.place()
  }

  alphaAt(uv) {
    const image = this.material.map && this.material.map.userData.alpha
    if (!uv || !image) return 255
    const x = Math.min(image.width - 1, Math.max(0, (uv.x * image.width) | 0))
    const y = Math.min(image.height - 1, Math.max(0, ((1 - uv.y) * image.height) | 0))
    return image.data[(y * image.width + x) * 4 + 3]
  }

  damage(amount, knockX, knockZ) {
    if (!this.alive) return false
    this.hp -= amount
    this.flash = 1
    this.knockX += knockX
    this.knockZ += knockZ
    this.x += knockX * 0.07
    this.z += knockZ * 0.07
    this.syncBar()
    if (this.hp > 0) return false
    this.hp = 0
    this.alive = false
    this.death = DEATH_TIME
    this.bar.visible = false
    this.extinguish()
    return true
  }

  ignite(dps) {
    if (!this.alive || dps <= 0) return
    const wasBurning = this.burnLife > 0
    this.burnLife = BURN_LIFE
    this.burnDps = dps
    this.flame.visible = true
    if (!wasBurning) this.flash = 1
  }

  extinguish() {
    this.burnLife = 0
    this.burnDps = 0
    this.flame.visible = false
  }

  tickBurn(dt) {
    if (!this.alive || this.burnLife <= 0) return false
    this.burnLife -= dt
    const flicker = 0.82 + Math.sin(this.phase * 14) * 0.14 + Math.sin(this.phase * 31) * 0.08
    const lean = Math.sin(this.phase * 11) * 0.18
    this.flame.scale.set(flicker, 0.9 + flicker * 0.25, flicker)
    this.flame.rotation.z = lean
    this.flame.children[0].material.opacity = 0.7 + flicker * 0.25
    this.flame.children[1].material.opacity = 0.75 + flicker * 0.2
    this.flame.children[1].scale.y = 0.85 + flicker * 0.3

    this.hp -= this.burnDps * dt
    this.syncBar()
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
      this.death = DEATH_TIME
      this.bar.visible = false
      this.extinguish()
      return true
    }
    if (this.burnLife <= 0) this.extinguish()
    return false
  }

  face(camera) {
    const dx = camera.position.x - this.x
    const dz = camera.position.z - this.z
    this.billboard.rotation.set(0, Math.atan2(dx, dz), Math.sin(this.phase) * 0.04)
  }

  present(dt, camera) {
    this.phase += dt * 2.2
    this.face(camera)
    this.visualY = Math.sin(this.phase) * 0.02
    this.visualScale = 1
    this.place()
  }

  update(dt, ctx) {
    this.face(ctx.camera)
    if (!this.alive) {
      this.death -= dt
      const t = 1 - Math.max(this.death, 0) / DEATH_TIME
      this.visualY = -1.15 * t
      this.visualScale = 1 - 0.4 * t
      this.material.opacity = 1 - t
      this.material.alphaTest = 0.05
      this.material.depthWrite = false
      this.shadow.visible = false
      this.place()
      if (this.death <= 0) this.gone = true
      return 0
    }

    if (this.spawn > 0) {
      this.spawn -= dt
      const rise = 1 - Math.max(this.spawn, 0) / SPAWN_TIME
      this.visualY = (1 - rise) * -0.55
      this.visualScale = 0.62 + 0.38 * rise
      const lit = 0.1 + 0.9 * nearestLanternFade(this.x, this.z, ctx.px, ctx.pz, ctx.lamps)
      this.material.color.setRGB(lit, lit, lit)
      this.place()
      return 0
    }

    const toX = ctx.px - this.x
    const toZ = ctx.pz - this.z
    const dist = Math.hypot(toX, toZ) || 1
    let dirX = toX / dist
    let dirZ = toZ / dist
    for (let i = 0; i < ctx.circles.length; i++) {
      const other = ctx.circles[i]
      if (!other.id || other.id === this) continue
      const ox = this.x - other.x
      const oz = this.z - other.z
      const d = Math.hypot(ox, oz)
      if (d > 0 && d < 1.3) {
        dirX += (ox / d) * (1.3 - d) * 1.7
        dirZ += (oz / d) * (1.3 - d) * 1.7
      }
    }
    const dirLen = Math.hypot(dirX, dirZ) || 1
    dirX /= dirLen
    dirZ /= dirLen

    const stepSpeed = dist < ATTACK_RANGE ? this.speed * 0.35 : this.speed
    let dx = dirX * stepSpeed * dt + this.knockX * dt
    let dz = dirZ * stepSpeed * dt + this.knockZ * dt
    this.knockX *= Math.exp(-dt * 8)
    this.knockZ *= Math.exp(-dt * 8)

    const step = this.step
    moveWithCollision(this.x, this.z, this.radius, dx, dz, ctx.blocks, ctx.circles, this, step)
    const travel = Math.hypot(step.x - this.x, step.z - this.z)
    if (travel < stepSpeed * dt * 0.3 && dist > ATTACK_RANGE) {
      moveWithCollision(
        this.x,
        this.z,
        this.radius,
        -dirZ * this.speed * dt * this.side,
        dirX * this.speed * dt * this.side,
        ctx.blocks,
        ctx.circles,
        this,
        step,
      )
      clampToRadius(step.x, step.z, this.radius, MOVE_LIMIT, step)
    } else {
      clampToRadius(step.x, step.z, this.radius, MOVE_LIMIT, step)
    }
    this.x = step.x
    this.z = step.z

    let dealt = 0
    const reach = ATTACK_RANGE * (this.radius / RADIUS)
    const midBlocked = blocked((this.x + ctx.px) * 0.5, (this.z + ctx.pz) * 0.5, 0.25, ctx.blocks)
    const cleared = ctx.py >= groundHeight(this.x, this.z) + this.clearHeight
    if (dist < reach && !midBlocked && !cleared) {
      this.attackCd -= dt
      if (this.attackCd <= 0) {
        this.attackCd = ATTACK_COOLDOWN
        dealt = this.attackDamage
      }
    } else {
      this.attackCd = ATTACK_WINDUP
    }

    const movedNow = Math.hypot(this.x - ctx.px, this.z - ctx.pz) < dist - 0.001 || travel > 0.002
    const pace = this.baseSpeed > 0 ? this.speed / this.baseSpeed : 1
    this.phase += dt * (movedNow ? 9 * pace : 2)
    this.visualY = Math.abs(Math.sin(this.phase)) * (movedNow ? 0.045 : 0.015)
    this.visualScale = 1
    if (movedNow) {
      this.frameT += dt
      if (this.frameT > 0.18 / pace) {
        this.frameT = 0
        this.frame ^= 1
        this.material.map = this.frames[this.frame]
      }
    }
    this.flash = Math.max(0, this.flash - dt * 6)
    const blow = 1 + this.flash * 2
    const warning = this.attackCd < 0.16 && dist < reach ? 0.35 : 0
    // Soft silhouette floor so distant foes still read against the dark bowl.
    const lit = 0.1 + 0.9 * nearestLanternFade(this.x, this.z, ctx.px, ctx.pz, ctx.lamps)
    this.material.color.setRGB(
      blow * lit,
      blow * (1 - warning) * lit,
      blow * (1 - warning * 0.6) * lit,
    )
    this.place()
    return dealt
  }

  syncBar() {
    const ratio = Math.max(0, this.hp / this.maxHp)
    this.bar.visible = this.alive && ratio < 1
    this.hpFill.scale.x = Math.max(0.001, ratio)
    this.hpFill.position.x = (-BAR_W / 2) * (1 - ratio)
    this.hpMat.color.setRGB(0.86, 0.22 + ratio * 0.55, 0.16)
  }

  place() {
    this.root.position.set(this.x, groundHeight(this.x, this.z) + this.visualY, this.z)
    const s = this.baseScale * this.visualScale
    this.root.scale.set(this.scaleX * s, this.scaleY * s, this.scaleX * s)
  }

  dispose() {
    this.material.dispose()
    this.hpMat.dispose()
    this.flame.children[0].material.dispose()
    this.flame.children[1].material.dispose()
  }
}
