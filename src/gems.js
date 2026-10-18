import * as THREE from 'three'
import { groundHeight } from './arena.js'
import { blocked } from './collide.js'

const PICK_RADIUS = 1.05
const MAGNET_RADIUS = 3.5
const MAGNET_ACCEL = 36
const MAGNET_MAX = 18
const HOVER = 0.34
const GRAVITY = 16
const GOLD_NEAR = 12
const GOLD_NEAR_SQ = GOLD_NEAR * GOLD_NEAR
const GOLD_CHANCE_PER = 0.02
const GOLD_CHANCE_MAX = 0.22
const GOLD_VALUE = 5
const RED_VALUE = 25
const GEM_GEO = new THREE.OctahedronGeometry(0.2, 0)
const GEM_MAT = new THREE.MeshStandardMaterial({
  color: 0x9ffcf2,
  emissive: 0x1ed4c4,
  emissiveIntensity: 1.6,
  roughness: 0.12,
  metalness: 0.25,
})
const GOLD_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd56a,
  emissive: 0xc48a12,
  emissiveIntensity: 2.1,
  roughness: 0.18,
  metalness: 0.55,
})
const RED_MAT = new THREE.MeshStandardMaterial({
  color: 0xff4a5a,
  emissive: 0xc81828,
  emissiveIntensity: 2.4,
  roughness: 0.14,
  metalness: 0.45,
})

function nearbyCount(x, z, enemies) {
  let count = 0
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    if (!enemy.alive) continue
    const dx = enemy.x - x
    const dz = enemy.z - z
    if (dx * dx + dz * dz <= GOLD_NEAR_SQ) count++
  }
  return count
}

export class Gems {
  constructor(scene) {
    this.scene = scene
    this.items = []
    this.free = []
  }

  reset() {
    this.clear()
  }

  take() {
    const item = this.free.pop()
    if (item) {
      item.mesh.visible = true
      return item
    }
    const mesh = new THREE.Mesh(GEM_GEO, GEM_MAT)
    const made = {
      mesh,
      x: 0,
      z: 0,
      y: 0,
      vy: 0,
      spin: 0,
      phase: 0,
      pull: 0,
      settled: false,
      gold: false,
      value: 1,
      size: 1,
    }
    this.scene.add(mesh)
    return made
  }

  hide(item) {
    item.mesh.visible = false
    this.free.push(item)
  }

  drop(x, z, blocks, enemies, kind = null) {
    let gx = x + (Math.random() - 0.5) * 0.7
    let gz = z + (Math.random() - 0.5) * 0.7
    if (blocked(gx, gz, 0.2, blocks)) {
      gx = x
      gz = z
    }
    let drop = kind
    if (drop === true) drop = 'gold'
    if (!drop) {
      const goldChance = Math.min(GOLD_CHANCE_MAX, nearbyCount(x, z, enemies) * GOLD_CHANCE_PER)
      if (Math.random() < goldChance) drop = 'gold'
    }
    const mat = drop === 'red' ? RED_MAT : drop === 'gold' ? GOLD_MAT : GEM_MAT
    const item = this.take()
    item.x = gx
    item.z = gz
    item.y = 0.95
    item.vy = 3.4 + Math.random() * 1.2
    item.spin = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.1)
    item.phase = Math.random() * Math.PI * 2
    item.pull = 0
    item.settled = false
    item.gold = drop === 'gold'
    item.value = drop === 'red' ? RED_VALUE : drop === 'gold' ? GOLD_VALUE : 1
    item.size = drop === 'red' ? 1.9 : drop === 'gold' ? 1.35 : 1
    item.mesh.material = mat
    this.place(item)
    this.items.push(item)
  }

  update(dt, player, collect) {
    let picked = 0
    const magnet = MAGNET_RADIUS * (player.magnetMult || 1)
    const pick2 = PICK_RADIUS * PICK_RADIUS
    const magnet2 = magnet * magnet
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]
      const toX = player.x - item.x
      const toZ = player.z - item.z
      const dist2 = toX * toX + toZ * toZ
      if (collect && dist2 < magnet2 && dist2 > pick2) {
        item.pull = Math.min(MAGNET_MAX * (player.magnetMult || 1), item.pull + MAGNET_ACCEL * dt)
        const dist = Math.sqrt(dist2)
        const step = Math.min(item.pull * dt, dist)
        item.x += (toX / dist) * step
        item.z += (toZ / dist) * step
        item.settled = true
        item.vy = 0
      } else {
        item.pull = 0
      }

      item.phase += dt * item.spin * (item.pull > 0 ? 2.4 : 1)
      if (!item.settled) {
        item.vy -= GRAVITY * dt
        item.y += item.vy * dt
        if (item.y <= HOVER) {
          item.y = HOVER
          if (item.vy < -1.4) item.vy *= -0.32
          else {
            item.vy = 0
            item.settled = true
          }
        }
      } else if (item.pull > 0) {
        item.y = HOVER + 0.28
      } else {
        item.y = HOVER + Math.sin(item.phase * 2.6) * 0.05
      }

      if (collect) {
        const dx = item.x - player.x
        const dz = item.z - player.z
        if (dx * dx + dz * dz < pick2) {
          this.hide(item)
          this.items.splice(i, 1)
          picked += item.value
          continue
        }
      }
      this.place(item)
    }
    return picked
  }

  place(item) {
    item.mesh.position.set(item.x, groundHeight(item.x, item.z) + item.y, item.z)
    item.mesh.rotation.set(0.55, item.phase, 0)
    const pulse = item.settled ? 1 + Math.sin(item.phase * 3) * 0.06 : 1
    item.mesh.scale.setScalar(item.size * pulse)
  }

  clear() {
    for (let i = 0; i < this.items.length; i++) this.hide(this.items[i])
    this.items.length = 0
  }
}
