import * as THREE from 'three'
import { groundHeight } from './arena.js'
import { blocked } from './collide.js'

const BOTTLE_POOL = 8
const FIRE_POOL = 8
const GRAVITY = 22
const THROW_SPEED = 22
const MAX_RANGE = 80
const FIRE_RADIUS = 5.2
const FIRE_LIFE = 3.4
export const BURN_DPS = 19
const BOTTLE_RADIUS = 0.12
const SPREAD_GAP = 0.9
const SPREAD_RATE = 2.2

const GLASS = new THREE.MeshStandardMaterial({
  color: 0x2a6a3a,
  roughness: 0.28,
  metalness: 0.18,
  transparent: true,
  opacity: 0.82,
})
const CORK = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.9, metalness: 0.02 })
const RAG = new THREE.MeshStandardMaterial({ color: 0xc45a28, roughness: 0.7, metalness: 0.05, emissive: 0x3a1408 })
const FIRE_MAT = new THREE.MeshBasicMaterial({
  color: 0xff6a22,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: THREE.DoubleSide,
})

function buildBottle() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.18, 8), GLASS)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.08, 6), GLASS)
  neck.position.y = 0.12
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), CORK)
  cork.position.y = 0.17
  const rag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), RAG)
  rag.position.y = 0.21
  group.add(body, neck, cork, rag)
  return group
}

export class Molotovs {
  constructor(scene) {
    this.scene = scene
    this.bottles = []
    this.fires = []
    this.tmp = new THREE.Vector3()

    for (let i = 0; i < BOTTLE_POOL; i++) {
      const mesh = buildBottle()
      mesh.visible = false
      scene.add(mesh)
      this.bottles.push({
        mesh,
        alive: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        dist: 0,
        spin: 0,
      })
    }

    const fireGeo = new THREE.SphereGeometry(1, 20, 14)
    for (let i = 0; i < FIRE_POOL; i++) {
      const sphere = new THREE.Mesh(fireGeo, FIRE_MAT.clone())
      sphere.visible = false
      sphere.renderOrder = 2
      const light = new THREE.PointLight(0xff6a28, 0, 18, 2)
      light.visible = false
      scene.add(sphere)
      scene.add(light)
      this.fires.push({
        mesh: sphere,
        light,
        alive: false,
        x: 0,
        z: 0,
        life: 0,
        radius: FIRE_RADIUS,
      })
    }
  }

  clear() {
    for (let i = 0; i < this.bottles.length; i++) this.killBottle(i)
    for (let i = 0; i < this.fires.length; i++) this.killFire(i)
  }

  killBottle(i) {
    const b = this.bottles[i]
    b.alive = false
    b.mesh.visible = false
  }

  killFire(i) {
    const f = this.fires[i]
    f.alive = false
    f.life = 0
    f.mesh.visible = false
    f.light.intensity = 0
    f.light.visible = false
  }

  throw(x, y, z, dx, dy, dz) {
    let slot = -1
    for (let i = 0; i < this.bottles.length; i++) {
      if (!this.bottles[i].alive) {
        slot = i
        break
      }
    }
    if (slot < 0) slot = 0

    const b = this.bottles[slot]
    b.alive = true
    b.x = x
    b.y = y
    b.z = z
    b.dist = 0
    b.spin = 0
    const len = Math.hypot(dx, dy, dz) || 1
    b.vx = (dx / len) * THROW_SPEED
    b.vy = (dy / len) * THROW_SPEED + 2.4
    b.vz = (dz / len) * THROW_SPEED
    b.mesh.visible = true
    this.syncBottle(b)
  }

  ignite(x, z) {
    let slot = -1
    for (let i = 0; i < this.fires.length; i++) {
      if (!this.fires[i].alive) {
        slot = i
        break
      }
    }
    if (slot < 0) {
      slot = 0
      let oldest = this.fires[0].life
      for (let i = 1; i < this.fires.length; i++) {
        if (this.fires[i].life < oldest) {
          oldest = this.fires[i].life
          slot = i
        }
      }
    }

    const f = this.fires[slot]
    f.alive = true
    f.x = x
    f.z = z
    f.life = FIRE_LIFE
    f.radius = FIRE_RADIUS
    const y = groundHeight(x, z) + FIRE_RADIUS * 0.45
    f.mesh.position.set(x, y, z)
    f.mesh.scale.setScalar(FIRE_RADIUS)
    f.mesh.visible = true
    f.mesh.material.opacity = 0.42
    f.light.position.set(x, y, z)
    f.light.intensity = 4.5
    f.light.visible = true
  }

  syncBottle(b) {
    b.mesh.position.set(b.x, b.y, b.z)
    b.mesh.rotation.x = b.spin
    b.mesh.rotation.z = b.spin * 0.7
    this.tmp.set(b.vx, b.vy, b.vz)
    if (this.tmp.lengthSq() > 1e-6) b.mesh.lookAt(b.x + this.tmp.x, b.y + this.tmp.y, b.z + this.tmp.z)
  }

  update(dt, ctx) {
    for (let i = 0; i < this.bottles.length; i++) {
      const b = this.bottles[i]
      if (!b.alive) continue

      b.vy -= GRAVITY * dt
      const stepX = b.vx * dt
      const stepY = b.vy * dt
      const stepZ = b.vz * dt
      b.x += stepX
      b.y += stepY
      b.z += stepZ
      b.dist += Math.hypot(stepX, stepY, stepZ)
      b.spin += dt * 10

      if (b.dist > MAX_RANGE) {
        this.killBottle(i)
        continue
      }

      const floor = groundHeight(b.x, b.z) + 0.04
      const hitGround = b.y <= floor
      const hitWall = blocked(b.x, b.z, BOTTLE_RADIUS, ctx.blocks) && b.y < groundHeight(b.x, b.z) + 2.8
      if (hitGround || hitWall) {
        const ix = b.x
        const iz = b.z
        this.killBottle(i)
        this.ignite(ix, iz)
        if (ctx.onIgnite) ctx.onIgnite(ix, iz)
        continue
      }

      this.syncBottle(b)
    }

    const enemies = ctx.enemies
    const burnDps = BURN_DPS * (ctx.damageMult || 1)
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i]
      if (!f.alive) continue

      f.life -= dt
      if (f.life <= 0) {
        this.killFire(i)
        continue
      }

      const k = Math.min(1, f.life / FIRE_LIFE)
      const flicker = 0.75 + Math.sin(f.life * 28 + i) * 0.18 + Math.random() * 0.08
      f.mesh.material.opacity = 0.25 + 0.4 * k * flicker
      f.mesh.scale.setScalar(f.radius * (0.92 + 0.08 * flicker))
      f.light.intensity = 5.2 * k * flicker

      if (burnDps <= 0) continue
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e]
        if (!enemy.alive) continue
        const dx = enemy.x - f.x
        const dz = enemy.z - f.z
        const reach = f.radius + enemy.radius
        if (dx * dx + dz * dz > reach * reach) continue
        enemy.ignite(burnDps)
      }
    }

    for (let e = 0; e < enemies.length; e++) {
      const enemy = enemies[e]
      if (!enemy.alive || enemy.burnLife <= 0) continue
      const killed = enemy.tickBurn(dt)
      if (ctx.onBurn) ctx.onBurn(enemy, killed)
    }

    for (let e = 0; e < enemies.length; e++) {
      const src = enemies[e]
      if (!src.alive || src.burnLife <= 0) continue
      if (Math.random() >= SPREAD_RATE * dt) continue
      for (let o = 0; o < enemies.length; o++) {
        if (o === e) continue
        const dst = enemies[o]
        if (!dst.alive || dst.burnLife > 0) continue
        const dx = dst.x - src.x
        const dz = dst.z - src.z
        const reach = src.radius + dst.radius + SPREAD_GAP
        if (dx * dx + dz * dz > reach * reach) continue
        dst.ignite(src.burnDps)
        break
      }
    }
  }
}
