import * as THREE from 'three'
import { groundHeight } from './arena.js'
import { blocked } from './collide.js'

const POOL = 48
const GRAVITY = 4.5
const MAX_RANGE = 420
const LIGHT_INTENSITY = 6
const LIGHT_DISTANCE = 7
const LIGHT_RADIUS = 0.4
const LIGHT_DECAY = 3
const HIT_RADIUS = 0.28

const BALL_GEO = new THREE.SphereGeometry(0.12, 12, 10)
const CORE_GEO = new THREE.SphereGeometry(0.07, 8, 6)
const BALL_MAT = new THREE.MeshBasicMaterial({
  color: 0x66e8ff,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
})
const CORE_MAT = new THREE.MeshBasicMaterial({
  color: 0xe8ffff,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
})

export class EnergyBalls {
  constructor(scene) {
    this.scene = scene
    this.pool = []
    this.lamps = []
    this.tmp = new THREE.Vector3()

    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group()
      const shell = new THREE.Mesh(BALL_GEO, BALL_MAT.clone())
      const core = new THREE.Mesh(CORE_GEO, CORE_MAT.clone())
      const light = new THREE.PointLight(0x66e8ff, 0, LIGHT_DISTANCE, LIGHT_DECAY)
      group.add(shell, core, light)
      group.visible = false
      scene.add(group)
      this.pool.push({
        mesh: group,
        shell,
        core,
        light,
        alive: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        dist: 0,
        size: 1,
        explode: 0,
        pierce: 1,
        hits: [],
        spin: 0,
      })
    }
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) this.deactivate(i)
  }

  deactivate(i) {
    const ball = this.pool[i]
    ball.alive = false
    ball.pierce = 1
    ball.hits.length = 0
    ball.light.intensity = 0
    ball.mesh.visible = false
  }

  collectLamps() {
    let n = 0
    for (let i = 0; i < this.pool.length; i++) {
      const ball = this.pool[i]
      if (!ball.alive) continue
      let lamp = this.lamps[n]
      if (!lamp) {
        lamp = { x: 0, z: 0, w: 0 }
        this.lamps[n] = lamp
      }
      lamp.x = ball.x
      lamp.z = ball.z
      lamp.w = LIGHT_RADIUS
      n += 1
    }
    this.lamps.length = n
    return this.lamps
  }

  spawn(x, y, z, dx, dy, dz, speed, size = 1, explode = 0, color = 0x66e8ff, pierce = 1) {
    let slot = -1
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].alive) {
        slot = i
        break
      }
    }
    if (slot < 0) slot = 0

    const ball = this.pool[slot]
    ball.alive = true
    ball.dist = 0
    ball.size = size
    ball.explode = explode
    ball.pierce = Math.max(1, pierce | 0)
    ball.hits.length = 0
    ball.spin = 0
    ball.x = x
    ball.y = y
    ball.z = z
    const len = Math.hypot(dx, dy, dz) || 1
    ball.vx = (dx / len) * speed
    ball.vy = (dy / len) * speed
    ball.vz = (dz / len) * speed
    ball.shell.material.color.setHex(color)
    ball.core.material.color.setHex(0xffffff)
    ball.light.color.setHex(color)
    ball.light.intensity = LIGHT_INTENSITY
    ball.mesh.visible = true
    ball.mesh.scale.setScalar(size)
    this.syncMesh(ball)
  }

  syncMesh(ball) {
    ball.mesh.position.set(ball.x, ball.y, ball.z)
    ball.mesh.rotation.y = ball.spin
    ball.mesh.rotation.x = ball.spin * 0.6
  }

  update(dt, ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      const ball = this.pool[i]
      if (!ball.alive) continue

      ball.vy -= GRAVITY * dt
      const stepX = ball.vx * dt
      const stepY = ball.vy * dt
      const stepZ = ball.vz * dt
      ball.x += stepX
      ball.y += stepY
      ball.z += stepZ
      ball.dist += Math.hypot(stepX, stepY, stepZ)
      ball.spin += dt * 8

      if (ball.dist > MAX_RANGE) {
        this.deactivate(i)
        continue
      }

      let hitEnemy = null
      let hitHead = false
      const enemies = ctx.enemies
      const reachPad = HIT_RADIUS * ball.size
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e]
        if (!enemy.alive) continue
        let already = false
        for (let h = 0; h < ball.hits.length; h++) {
          if (ball.hits[h] === enemy) {
            already = true
            break
          }
        }
        if (already) continue
        const dx = ball.x - enemy.x
        const dz = ball.z - enemy.z
        const reach = enemy.radius + reachPad
        if (dx * dx + dz * dz > reach * reach) continue
        const rootY = groundHeight(enemy.x, enemy.z) + enemy.visualY
        if (ball.y < rootY + 0.12 || ball.y > rootY + enemy.hitTop) continue
        hitEnemy = enemy
        hitHead = ball.y > rootY + enemy.hitHead
        break
      }

      const floor = groundHeight(ball.x, ball.z) + 0.04
      const hitGround = ball.y <= floor
      const hitWall = blocked(ball.x, ball.z, 0.08 * ball.size, ctx.blocks) && ball.y < groundHeight(ball.x, ball.z) + 2.8

      if (hitEnemy || hitGround || hitWall) {
        const ix = ball.x
        const iy = hitGround ? floor : ball.y
        const iz = ball.z
        const explode = ball.explode
        const flat = Math.hypot(ball.vx, ball.vz) || 1
        const dirX = ball.vx / flat
        const dirZ = ball.vz / flat

        if (explode > 0) {
          this.deactivate(i)
          if (ctx.onExplode) ctx.onExplode(ix, iy, iz, explode, dirX, dirZ)
          continue
        }

        if (hitEnemy && ctx.onEnemyHit) {
          const impulse = hitHead ? 4 : 2.5
          ctx.onEnemyHit(hitEnemy, hitHead, ix, iy, iz, dirX * impulse, dirZ * impulse)
          ball.hits.push(hitEnemy)
          ball.pierce -= 1
          if (ball.pierce <= 0) {
            this.deactivate(i)
            continue
          }
        } else {
          this.deactivate(i)
          continue
        }
      }

      this.syncMesh(ball)
    }
  }
}
