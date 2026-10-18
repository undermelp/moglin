import { groundHeight } from './arena.js'
import { blocked } from './collide.js'
import { Enemy, ENEMY_CLEAR_HEIGHT, ENEMY_FORMS } from './enemy.js'

const PREVIEW = [
  [90, -40],
  [-70, 95],
  [160, 120],
  [-140, -150],
  [220, -80],
  [-200, 60],
  [40, 250],
  [-260, -180],
  [310, 140],
  [-90, -280],
  [180, -240],
  [-320, 200],
]

const SPAWN_NEAR = 70
const SPAWN_MID = 160
const SPAWN_FAR = 280
const SPAWN_MAX_DIST = 380
const ARENA_EDGE = 600
const MIN_PLAYER_DIST = 55
const SPEED_GAIN = 0.02
const SPEED_MAX = 13
const WAVE_SECONDS = 30
const SPAWN_EVERY = 0.4
const SPAWN_BATCH = 5
const OPENING_COUNT = 140
const ENEMY_CAP = 200
const SPAWN_GAP = 2.6
const SPAWN_GAP_SQ = SPAWN_GAP * SPAWN_GAP
const GROUP_RADIUS = 4
const GROUP_RADIUS_SQ = GROUP_RADIUS * GROUP_RADIUS
const GROUP_MAX_NEIGHBORS = 12
const DESPAWN_LIMIT = 8
const ELITE_CHANCE_PER = 0.07
const ELITE_CHANCE_MAX = 0.48
const BOSS_FIRST_WAVE = 4
const BOSS_SPAWN_NEAR = 16
const BOSS_SPAWN_FAR = 28

function pickDist() {
  const roll = Math.random()
  if (roll < 0.3) return SPAWN_NEAR + Math.random() * (SPAWN_MID - SPAWN_NEAR)
  if (roll < 0.65) return SPAWN_MID + Math.random() * (SPAWN_FAR - SPAWN_MID)
  return SPAWN_FAR + Math.random() * (SPAWN_MAX_DIST - SPAWN_FAR)
}

function occupied(x, z, enemies) {
  let count = 0
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    if (!enemy.alive) continue
    const dx = enemy.x - x
    const dz = enemy.z - z
    const distSq = dx * dx + dz * dz
    if (distSq < SPAWN_GAP_SQ) return true
    if (distSq <= GROUP_RADIUS_SQ) count++
  }
  return count >= GROUP_MAX_NEIGHBORS
}

function findSpawn(px, pz, blocks, enemies, clear = 0.75, near = 0, far = 0) {
  const close = far > near
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = close ? near + Math.random() * (far - near) : pickDist()
    const x = px + Math.cos(angle) * dist
    const z = pz + Math.sin(angle) * dist
    if (Math.hypot(x, z) > ARENA_EDGE) continue
    if (!close && Math.hypot(x - px, z - pz) < MIN_PLAYER_DIST) continue
    if (blocked(x, z, clear, blocks)) continue
    if (occupied(x, z, enemies)) continue
    return { x, z }
  }
  const away = Math.random() * Math.PI * 2
  const dist = close
    ? near + Math.random() * (far - near)
    : SPAWN_MID + Math.random() * (SPAWN_FAR - SPAWN_MID)
  return {
    x: px + Math.cos(away) * dist,
    z: pz + Math.sin(away) * dist,
  }
}

export class Horde {
  constructor(scene, enemyFrames) {
    this.scene = scene
    this.enemyFrames = enemyFrames
    this.enemies = []
    this.free = []
    this.wave = 0
    this.spawnCd = 0
    this.time = 0
    this.previewing = false
    this.circles = []
    this.bumps = []
    this.playerCircle = { x: 0, z: 0, r: 0, id: null }
    this.circleCount = 0
    this.ctx = {
      px: 0,
      pz: 0,
      py: 0,
      camera: null,
      blocks: null,
      circles: this.circles,
      lamps: null,
    }
    this.result = { damage: 0, event: null }
    this.neighbors = new Array(ENEMY_CAP)
    this.aliveFlags = new Array(ENEMY_CAP)
  }

  writeEnemyCircles() {
    const enemies = this.enemies
    const circles = this.circles
    const playerCircle = this.playerCircle
    let n = 0
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      if (!enemy.alive) continue
      let circle = circles[n]
      if (!circle || circle === playerCircle) {
        circle = { x: 0, z: 0, r: 0, id: null }
        circles[n] = circle
      }
      circle.x = enemy.x
      circle.z = enemy.z
      circle.r = enemy.radius
      circle.id = enemy
      n += 1
    }
    this.circleCount = n
    circles.length = n
    return n
  }

  prepareCircles(player) {
    const n = this.writeEnemyCircles()
    const circles = this.circles
    const bumps = this.bumps
    let p = 0
    for (let i = 0; i < n; i++) {
      const circle = circles[i]
      const enemy = circle.id
      if (player.feetY >= groundHeight(enemy.x, enemy.z) + enemy.clearHeight) continue
      bumps[p] = circle
      p += 1
    }
    bumps.length = p
    return bumps
  }

  preview(blocks) {
    this.clear()
    this.previewing = true
    this.wave = 0
    PREVIEW.forEach((spot, index) => {
      if (blocked(spot[0], spot[1], 0.7, blocks)) return
      const enemy = this.make(spot[0], spot[1], index % this.enemyFrames.length, 100, 0, 0)
      enemy.spawn = 0
      this.enemies.push(enemy)
    })
  }

  begin(player, blocks) {
    this.clear()
    this.previewing = false
    this.wave = 1
    this.time = 0
    this.spawnCd = SPAWN_EVERY
    for (let i = 0; i < OPENING_COUNT; i++) this.spawnOne(player, blocks)
  }

  reset() {
    this.clear()
    this.wave = 0
    this.spawnCd = 0
    this.time = 0
    this.previewing = false
  }

  make(x, z, variant, hp, speed, damage, form = 'normal') {
    const frames = this.enemyFrames[variant]
    const options = { hp, speed, damage, form }
    let enemy = this.free.pop()
    if (enemy) {
      enemy.reset(x, z, frames, options)
    } else {
      enemy = new Enemy(x, z, frames, options)
      this.scene.add(enemy.root)
    }
    return enemy
  }

  release(enemy) {
    enemy.root.visible = false
    enemy.gone = true
    enemy.alive = false
    this.free.push(enemy)
  }

  pickForm() {
    if (this.wave < 2) return 'normal'
    const chance = Math.min(ELITE_CHANCE_MAX, (this.wave - 1) * ELITE_CHANCE_PER)
    if (Math.random() >= chance) return 'normal'
    return Math.random() < 0.5 ? 'tall' : 'bulky'
  }

  spawnOne(player, blocks, form = null, near = 0, far = 0) {
    const kind = form || this.pickForm()
    const stats = ENEMY_FORMS[kind]
    const spot = findSpawn(
      player.x,
      player.z,
      blocks,
      this.enemies,
      Math.max(0.75, stats.radius),
      near,
      far,
    )
    const hp = (100 + (this.wave - 1) * 22) * stats.hp
    const speed = Math.min(8.6, 4.4 + (this.wave - 1) * 0.28) * stats.speed
    const damage = (12 + (this.wave - 1) * 1.5) * stats.damage
    const variant = (Math.random() * this.enemyFrames.length) | 0
    this.enemies.push(this.make(spot.x, spot.z, variant, hp, speed, damage, kind))
  }

  spawnBoss(player, blocks) {
    this.spawnOne(player, blocks, 'boss', BOSS_SPAWN_NEAR, BOSS_SPAWN_FAR)
  }

  isBossWave(wave = this.wave) {
    return wave >= BOSS_FIRST_WAVE && wave % 2 === 0
  }

  present(dt, camera) {
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].present(dt, camera)
  }

  update(dt, player, blocks, lamps) {
    let event = null
    if (!this.previewing) {
      const before = this.wave
      this.time += dt
      this.wave = 1 + Math.floor(this.time / WAVE_SECONDS)
      if (this.wave !== before) {
        event = 'wave'
        if (this.isBossWave()) this.spawnBoss(player, blocks)
      }
      this.spawnCd -= dt
      if (this.spawnCd <= 0) {
        let alive = 0
        for (let i = 0; i < this.enemies.length; i++) {
          if (this.enemies[i].alive) alive++
        }
        for (let n = 0; n < SPAWN_BATCH && alive < ENEMY_CAP; n++) {
          this.spawnOne(player, blocks)
          alive++
        }
        this.spawnCd = SPAWN_EVERY
      }
      this.thinCrowds()
    }
    const bonus = this.time * SPEED_GAIN
    const n = this.writeEnemyCircles()
    const circles = this.circles
    const playerAir = player.feetY - groundHeight(player.x, player.z)
    if (playerAir < ENEMY_CLEAR_HEIGHT) {
      const playerCircle = this.playerCircle
      playerCircle.x = player.x
      playerCircle.z = player.z
      playerCircle.r = player.radius
      playerCircle.id = null
      circles[n] = playerCircle
      circles.length = n + 1
    }

    let damage = 0
    const ctx = this.ctx
    ctx.px = player.x
    ctx.pz = player.z
    ctx.py = player.feetY
    ctx.camera = player.camera
    ctx.blocks = blocks
    ctx.circles = circles
    ctx.lamps = lamps
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.alive) enemy.speed = Math.min(SPEED_MAX, enemy.baseSpeed + bonus)
      damage += enemy.update(dt, ctx)
      if (enemy.gone) {
        this.release(enemy)
        this.enemies.splice(i, 1)
      }
    }

    const result = this.result
    result.damage = damage
    result.event = event
    return result
  }

  thinCrowds() {
    const list = this.enemies
    const count = list.length
    if (count <= GROUP_MAX_NEIGHBORS) return
    const neighbors = this.neighbors
    const alive = this.aliveFlags
    for (let i = 0; i < count; i++) {
      neighbors[i] = 0
      alive[i] = list[i].alive
    }

    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue
      const ax = list[i].x
      const az = list[i].z
      for (let j = i + 1; j < count; j++) {
        if (!alive[j]) continue
        const dx = ax - list[j].x
        const dz = az - list[j].z
        if (dx * dx + dz * dz <= GROUP_RADIUS_SQ) {
          neighbors[i]++
          neighbors[j]++
        }
      }
    }

    let removed = 0
    while (removed < DESPAWN_LIMIT) {
      let worst = -1
      let worstCount = GROUP_MAX_NEIGHBORS
      for (let i = 0; i < count; i++) {
        if (!alive[i] || list[i].gold || list[i].boss) continue
        if (neighbors[i] > worstCount) {
          worst = i
          worstCount = neighbors[i]
        }
      }
      if (worst < 0) break
      const enemy = list[worst]
      alive[worst] = false
      for (let j = 0; j < count; j++) {
        if (!alive[j]) continue
        const dx = enemy.x - list[j].x
        const dz = enemy.z - list[j].z
        if (dx * dx + dz * dz <= GROUP_RADIUS_SQ) neighbors[j]--
      }
      this.release(enemy)
      list[worst] = null
      removed++
    }
    if (removed === 0) return
    let write = 0
    for (let i = 0; i < list.length; i++) {
      if (list[i]) list[write++] = list[i]
    }
    list.length = write
  }

  collectAims(into) {
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) into.push(this.enemies[i].billboard)
    }
  }

  clear() {
    for (let i = 0; i < this.enemies.length; i++) this.release(this.enemies[i])
    this.enemies.length = 0
  }
}
