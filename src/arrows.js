import * as THREE from 'three'
import { groundHeight } from './arena.js'
import { blocked } from './collide.js'

const POOL = 64
const GRAVITY = 19
const STICK_FADE = 1.0
const BULLET_LIGHT_FADE = 0.25
const MAX_RANGE = 520
const LIGHT_INTENSITY = 5
const LIGHT_DISTANCE = 8
const LIGHT_RADIUS = 0.45

const SHAFT_GEO = new THREE.CylinderGeometry(0.004, 0.005, 0.34, 6)
const TIP_GEO = new THREE.ConeGeometry(0.008, 0.06, 6)
const SHAFT_MAT = new THREE.MeshStandardMaterial({ color: 0x6a5040, roughness: 0.85, metalness: 0.02 })
const TIP_MAT = new THREE.MeshStandardMaterial({ color: 0x9098a0, roughness: 0.45, metalness: 0.5 })

export class Arrows {
  constructor(scene) {
    this.scene = scene
    this.pool = []
    this.lamps = []
    this.tmp = new THREE.Vector3()

    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group()
      const shaft = new THREE.Mesh(SHAFT_GEO, SHAFT_MAT)
      shaft.rotation.x = Math.PI / 2
      shaft.position.z = -0.14
      const tip = new THREE.Mesh(TIP_GEO, TIP_MAT)
      tip.rotation.x = -Math.PI / 2
      tip.position.z = -0.34
      // Same cool lantern cone as the player lamp, aimed along the bolt.
      const light = new THREE.SpotLight(0xd0e4ff, 0, LIGHT_DISTANCE, 0.5, 0.45, 2)
      const target = new THREE.Object3D()
      target.position.set(0, 0, -1)
      group.add(shaft, tip, light, target)
      light.target = target
      group.visible = false
      scene.add(group)
      this.pool.push({
        mesh: group,
        light,
        alive: false,
        stuck: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        fade: 0,
        bullet: false,
        lightLife: 0,
        dist: 0,
        size: 1,
        pierce: 1,
        hits: [],
      })
    }
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) this.deactivate(i)
  }

  deactivate(i) {
    const a = this.pool[i]
    a.alive = false
    a.stuck = false
    a.fade = 0
    a.bullet = false
    a.lightLife = 0
    a.pierce = 1
    a.hits.length = 0
    a.light.intensity = 0
    a.mesh.visible = false
  }

  // Soft ground lanterns for GrassLantern (player-style lit radius).
  collectLamps() {
    let n = 0
    for (let i = 0; i < this.pool.length; i++) {
      const a = this.pool[i]
      if (!a.alive) continue
      let lamp = this.lamps[n]
      if (!lamp) {
        lamp = { x: 0, z: 0, w: 0 }
        this.lamps[n] = lamp
      }
      lamp.x = a.x
      lamp.z = a.z
      let bright = 1
      if (a.bullet) bright = a.lightLife > 0 ? a.lightLife / BULLET_LIGHT_FADE : 0
      else if (a.stuck) bright = Math.max(0, a.fade / STICK_FADE)
      lamp.w = LIGHT_RADIUS * bright
      n += 1
    }
    this.lamps.length = n
    return this.lamps
  }

  spawn(x, y, z, dx, dy, dz, speed, size = 1, pierce = 1, bullet = false) {
    let slot = -1
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].alive) {
        slot = i
        break
      }
    }
    if (slot < 0) slot = 0

    const a = this.pool[slot]
    a.alive = true
    a.stuck = false
    a.fade = 0
    a.bullet = bullet
    a.lightLife = bullet ? BULLET_LIGHT_FADE : 0
    a.dist = 0
    a.size = size
    a.pierce = Math.max(1, pierce | 0)
    a.hits.length = 0
    a.x = x
    a.y = y
    a.z = z
    const len = Math.hypot(dx, dy, dz) || 1
    a.vx = (dx / len) * speed
    a.vy = (dy / len) * speed
    a.vz = (dz / len) * speed
    a.light.intensity = LIGHT_INTENSITY
    a.mesh.visible = true
    a.mesh.scale.setScalar(size)
    this.syncMesh(a)
  }

  syncMesh(a) {
    a.mesh.position.set(a.x, a.y, a.z)
    this.tmp.set(a.vx, a.vy, a.vz)
    if (a.stuck && this.tmp.lengthSq() < 0.01) this.tmp.set(0, -1, 0)
    if (this.tmp.lengthSq() > 1e-6) a.mesh.lookAt(a.x + this.tmp.x, a.y + this.tmp.y, a.z + this.tmp.z)
  }

  update(dt, ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      const a = this.pool[i]
      if (!a.alive) continue

      if (a.bullet) {
        if (a.lightLife > 0) a.lightLife = Math.max(0, a.lightLife - dt)
        a.light.intensity = LIGHT_INTENSITY * (a.lightLife / BULLET_LIGHT_FADE)
      }

      if (a.stuck) {
        a.fade -= dt
        if (a.fade <= 0) {
          this.deactivate(i)
        } else {
          const k = a.fade / STICK_FADE
          a.mesh.scale.setScalar(Math.max(0.001, k * a.size))
          if (!a.bullet) a.light.intensity = LIGHT_INTENSITY * k
        }
        continue
      }

      a.vy -= GRAVITY * dt
      const stepX = a.vx * dt
      const stepY = a.vy * dt
      const stepZ = a.vz * dt
      a.x += stepX
      a.y += stepY
      a.z += stepZ
      a.dist += Math.hypot(stepX, stepY, stepZ)

      if (a.dist > MAX_RANGE) {
        this.deactivate(i)
        continue
      }

      let hit = false
      const enemies = ctx.enemies
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e]
        if (!enemy.alive) continue
        let already = false
        for (let h = 0; h < a.hits.length; h++) {
          if (a.hits[h] === enemy) {
            already = true
            break
          }
        }
        if (already) continue
        const dx = a.x - enemy.x
        const dz = a.z - enemy.z
        const reach = enemy.radius + 0.22
        if (dx * dx + dz * dz > reach * reach) continue
        const rootY = groundHeight(enemy.x, enemy.z) + enemy.visualY
        if (a.y < rootY + 0.12 || a.y > rootY + enemy.hitTop) continue
        const head = a.y > rootY + enemy.hitHead
        const flat = Math.hypot(a.vx, a.vz) || 1
        const impulse = head ? 4 : 2.5
        ctx.onEnemyHit(enemy, head, a.x, a.y, a.z, (a.vx / flat) * impulse, (a.vz / flat) * impulse)
        a.hits.push(enemy)
        a.pierce -= 1
        hit = true
        break
      }
      if (hit && a.pierce <= 0) {
        this.deactivate(i)
        continue
      }

      const floor = groundHeight(a.x, a.z) + 0.04
      if (a.y <= floor) {
        a.y = floor
        a.stuck = true
        a.fade = STICK_FADE
        a.vx = 0
        a.vy = 0
        a.vz = 0
        this.syncMesh(a)
        continue
      }

      if (blocked(a.x, a.z, 0.06, ctx.blocks) && a.y < groundHeight(a.x, a.z) + 2.8) {
        a.stuck = true
        a.fade = STICK_FADE
        a.vx = 0
        a.vy = 0
        a.vz = 0
        this.syncMesh(a)
        continue
      }

      this.syncMesh(a)
    }
  }
}
