import * as THREE from 'three'
import { SWING_TIME, poseSwing } from './swing.js'

const WOOD = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.82, metalness: 0.04 })
const DARK = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.7, metalness: 0.08 })
const METAL = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.32, metalness: 0.74 })
const STEEL = new THREE.MeshStandardMaterial({ color: 0x6e7882, roughness: 0.4, metalness: 0.58 })
const BRASS = new THREE.MeshStandardMaterial({ color: 0x8a7044, roughness: 0.38, metalness: 0.64 })
const PLASMA = new THREE.MeshStandardMaterial({
  color: 0x1a2a38,
  roughness: 0.35,
  metalness: 0.72,
})
const GLOW_CYAN = new THREE.MeshStandardMaterial({
  color: 0x66e8ff,
  emissive: 0x33c8ef,
  emissiveIntensity: 2.4,
  roughness: 0.2,
  metalness: 0.15,
})
const GLOW_MAGENTA = new THREE.MeshStandardMaterial({
  color: 0xff66cc,
  emissive: 0xcc3388,
  emissiveIntensity: 2.6,
  roughness: 0.18,
  metalness: 0.12,
})
const GLOW_LIME = new THREE.MeshStandardMaterial({
  color: 0xa8ff66,
  emissive: 0x66cc22,
  emissiveIntensity: 2.2,
  roughness: 0.22,
  metalness: 0.1,
})
const GLOW_FIRE = new THREE.MeshStandardMaterial({
  color: 0xff6a22,
  emissive: 0xff3a08,
  emissiveIntensity: 2.4,
  roughness: 0.28,
  metalness: 0.12,
})
const CHARRED = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.78, metalness: 0.08 })

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  return mesh
}

function barrel(radius, length, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), mat)
  mesh.rotation.x = Math.PI / 2
  mesh.position.set(x, y, z)
  return mesh
}

function orb(radius, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), mat)
  mesh.position.set(x, y, z)
  return mesh
}

function buildSmg(group) {
  group.add(
    box(0.046, 0.11, 0.048, DARK, 0, -0.05, 0.06),
    box(0.05, 0.048, 0.26, STEEL, 0, 0.018, 0.0),
    box(0.038, 0.036, 0.1, METAL, 0, 0.014, -0.16),
    barrel(0.012, 0.16, METAL, 0, 0.02, -0.28),
    box(0.028, 0.09, 0.04, DARK, 0, -0.05, -0.02),
    box(0.034, 0.028, 0.08, WOOD, 0, 0.0, 0.16),
    box(0.012, 0.018, 0.04, BRASS, 0, 0.05, 0.02),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -0.37)
  return muzzle
}

function buildRifle(group) {
  group.add(
    box(0.05, 0.072, 0.28, WOOD, 0, -0.02, 0.15),
    box(0.046, 0.058, 0.2, STEEL, 0, 0.012, -0.04),
    box(0.03, 0.11, 0.048, DARK, 0, -0.06, 0.01),
    box(0.042, 0.042, 0.22, WOOD, 0, 0.0, -0.2),
    barrel(0.012, 0.4, METAL, 0, 0.022, -0.36),
    box(0.01, 0.022, 0.04, METAL, 0, 0.052, -0.08),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.022, -0.57)
  return muzzle
}

function buildScatter(group) {
  group.add(
    box(0.052, 0.074, 0.24, WOOD, 0, -0.016, 0.13),
    box(0.074, 0.068, 0.17, STEEL, 0, 0.012, -0.02),
    barrel(0.016, 0.26, METAL, -0.02, 0.02, -0.18),
    barrel(0.016, 0.26, METAL, 0.02, 0.02, -0.18),
    box(0.086, 0.052, 0.11, WOOD, 0, -0.004, -0.12),
    box(0.02, 0.012, 0.03, BRASS, 0, 0.05, 0.02),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -0.32)
  return muzzle
}

function buildEnergyCannon(group) {
  group.add(
    box(0.08, 0.1, 0.34, PLASMA, 0, 0.0, 0.08),
    box(0.04, 0.14, 0.06, DARK, 0, -0.08, 0.12),
    barrel(0.045, 0.22, PLASMA, 0, 0.02, -0.2),
    barrel(0.058, 0.08, STEEL, 0, 0.02, -0.34),
    orb(0.055, GLOW_LIME, 0, 0.04, -0.02),
    box(0.02, 0.03, 0.08, GLOW_LIME, 0.05, 0.06, -0.12),
    box(0.02, 0.03, 0.08, GLOW_LIME, -0.05, 0.06, -0.12),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -0.42)
  return muzzle
}

function buildPlasmaRifle(group) {
  group.add(
    box(0.048, 0.06, 0.3, PLASMA, 0, 0.0, 0.1),
    box(0.03, 0.11, 0.045, DARK, 0, -0.07, 0.04),
    barrel(0.014, 0.36, STEEL, 0, 0.02, -0.22),
    box(0.07, 0.018, 0.22, GLOW_CYAN, 0, 0.045, -0.12),
    box(0.018, 0.018, 0.18, GLOW_CYAN, 0.04, 0.02, -0.16),
    box(0.018, 0.018, 0.18, GLOW_CYAN, -0.04, 0.02, -0.16),
    orb(0.022, GLOW_CYAN, 0, 0.05, 0.08),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -0.42)
  return muzzle
}

function buildPlasmaPistol(group) {
  group.add(
    box(0.05, 0.12, 0.05, DARK, 0, -0.05, 0.04),
    box(0.052, 0.045, 0.16, PLASMA, 0, 0.02, -0.02),
    barrel(0.02, 0.1, STEEL, 0, 0.02, -0.14),
    orb(0.038, GLOW_MAGENTA, 0, 0.04, 0.02),
    box(0.016, 0.02, 0.04, GLOW_MAGENTA, 0, 0.055, -0.08),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -0.2)
  return muzzle
}

function buildFireCrossbow(group) {
  const limbL = box(0.018, 0.018, 0.34, CHARRED, -0.17, 0.05, -0.02)
  limbL.rotation.y = 0.12
  const limbR = box(0.018, 0.018, 0.34, CHARRED, 0.17, 0.05, -0.02)
  limbR.rotation.y = -0.12
  const string = barrel(0.002, 0.32, GLOW_FIRE, 0, 0.05, -0.02)
  string.rotation.x = 0
  string.rotation.z = Math.PI / 2
  group.add(
    box(0.05, 0.07, 0.28, WOOD, 0, -0.02, 0.06),
    box(0.04, 0.11, 0.06, CHARRED, 0, 0.02, -0.02),
    limbL,
    limbR,
    string,
    box(0.028, 0.022, 0.42, WOOD, 0, 0.01, -0.22),
    barrel(0.014, 0.08, STEEL, 0, 0.04, -0.44),
    orb(0.02, GLOW_FIRE, 0, 0.05, -0.48),
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.04, -0.48)
  return muzzle
}

const SPECS = [
  {
    name: 'SMG',
    fireInterval: 0.085,
    damage: 16,
    headMultiplier: 2,
    arrowSpeed: 48,
    spread: 0.045,
    pellets: 1,
    boltSize: 0.38,
    projectile: 'bullet',
    recoil: 0.028,
    recoilTilt: 0.26,
    sound: 'smg',
    restX: 0.15,
    restY: -0.11,
    restZ: -0.34,
    rotX: 0.03,
    rotY: -0.04,
    rotZ: 0.03,
    scale: 0.68,
    build: buildSmg,
  },
  {
    name: 'RIFLE',
    fireInterval: 0.42,
    damage: 67.5,
    headMultiplier: 2,
    arrowSpeed: 78,
    spread: 0.005,
    pellets: 1,
    boltSize: 0.55,
    projectile: 'bullet',
    pierce: 2,
    recoil: 0.07,
    restX: 0.14,
    restY: -0.1,
    restZ: -0.26,
    rotX: 0.03,
    rotY: -0.05,
    rotZ: 0.015,
    scale: 0.58,
    build: buildRifle,
  },
  {
    name: 'SCATTERGUN',
    fireInterval: 0.75,
    burst: 2,
    burstGap: 0.1,
    damage: 22.5,
    headMultiplier: 2,
    arrowSpeed: 30,
    spread: 0.22,
    pellets: 5,
    boltSize: 0.36,
    projectile: 'bullet',
    recoil: 0.1,
    restX: 0.15,
    restY: -0.11,
    restZ: -0.34,
    rotX: 0.04,
    rotY: -0.05,
    rotZ: 0.02,
    scale: 0.64,
    build: buildScatter,
  },
  {
    name: 'ENERGY CANNON',
    fireInterval: 1.05,
    damage: 70,
    headMultiplier: 1.6,
    arrowSpeed: 18,
    spread: 0.01,
    pellets: 1,
    boltSize: 2.4,
    recoil: 0.12,
    projectile: 'energy',
    explodeRadius: 6.4,
    ballColor: 0xa8ff66,
    restX: 0.15,
    restY: -0.12,
    restZ: -0.32,
    rotX: 0.04,
    rotY: -0.05,
    rotZ: 0.02,
    scale: 0.62,
    build: buildEnergyCannon,
  },
  {
    name: 'PLASMA RIFLE',
    fireInterval: 0.09,
    damage: 16,
    headMultiplier: 1.8,
    arrowSpeed: 44,
    spread: 0.035,
    pellets: 1,
    boltSize: 0.85,
    recoil: 0.028,
    projectile: 'energy',
    explodeRadius: 0,
    ballColor: 0x66e8ff,
    restX: 0.14,
    restY: -0.1,
    restZ: -0.28,
    rotX: 0.03,
    rotY: -0.05,
    rotZ: 0.015,
    scale: 0.6,
    build: buildPlasmaRifle,
  },
  {
    name: 'PLASMA PISTOL',
    fireInterval: 0.4,
    damage: 48,
    headMultiplier: 1.5,
    arrowSpeed: 26,
    spread: 0.02,
    pellets: 1,
    boltSize: 1.9,
    recoil: 0.08,
    projectile: 'energy',
    explodeRadius: 0,
    pierce: 3,
    ballColor: 0xff66cc,
    restX: 0.16,
    restY: -0.11,
    restZ: -0.36,
    rotX: 0.02,
    rotY: -0.04,
    rotZ: 0.04,
    scale: 0.74,
    build: buildPlasmaPistol,
  },
  {
    name: 'FIRE CROSSBOW',
    fireInterval: 0.4,
    damage: 57,
    headMultiplier: 2,
    arrowSpeed: 34,
    spread: 0.012,
    pellets: 1,
    boltSize: 1,
    recoil: 0.04,
    sound: 'bow',
    ignite: true,
    restX: 0.2,
    restY: -0.15,
    restZ: -0.38,
    rotX: 0.04,
    rotY: -0.06,
    rotZ: 0.02,
    scale: 0.6,
    build: buildFireCrossbow,
  },
]

class Gun {
  constructor(camera, spec) {
    this.camera = camera
    this.name = spec.name
    this.magSize = 0
    this.mag = 0
    this.reserve = 0
    this.damage = spec.damage
    this.headMultiplier = spec.headMultiplier
    this.arrowSpeed = spec.arrowSpeed
    this.spread = spec.spread
    this.pellets = spec.pellets
    this.boltSize = spec.boltSize
    this.projectile = spec.projectile || 'bolt'
    this.explodeRadius = spec.explodeRadius || 0
    this.pierce = spec.pierce || 1
    this.ballColor = spec.ballColor || 0x66e8ff
    this.ignite = !!spec.ignite
    this.sound = spec.sound || (spec.projectile === 'energy' ? 'plasma' : 'shot')
    this.fireInterval = spec.fireInterval
    this.burst = spec.burst || 1
    this.burstGap = spec.burstGap || 0
    this.burstLeft = 0
    this.recoilKick = spec.recoil
    this.recoilTilt = spec.recoilTilt ?? 0.1
    this.restX = spec.restX
    this.restY = spec.restY
    this.restZ = spec.restZ
    this.rotX = spec.rotX
    this.rotY = spec.rotY
    this.rotZ = spec.rotZ
    this.cooldown = 0
    this.recoil = 0
    this.time = 0
    this.slideBlend = 0
    this.swingTime = 0
    this.muzzlePos = new THREE.Vector3()

    this.group = new THREE.Group()
    this.group.position.set(spec.restX, spec.restY, spec.restZ)
    this.group.rotation.set(spec.rotX, spec.rotY, spec.rotZ)
    this.group.scale.setScalar(spec.scale)
    this.group.frustumCulled = false
    this.group.visible = false
    this.muzzle = spec.build(this.group)
    this.group.add(this.muzzle)
    camera.add(this.group)
  }

  reset() {
    this.cooldown = 0
    this.burstLeft = 0
    this.recoil = 0
    this.slideBlend = 0
    this.swingTime = 0
    this.group.position.set(this.restX, this.restY, this.restZ)
    this.group.rotation.set(this.rotX, this.rotY, this.rotZ)
  }

  swing() {
    if (this.swingTime > 0) return false
    this.swingTime = SWING_TIME
    return true
  }

  update(dt, motion, firing) {
    this.time += dt
    if (this.cooldown > 0) this.cooldown -= dt
    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt)
      poseSwing(this.group, this.restX, this.restY, this.restZ, this.rotX, this.rotY, this.rotZ, this.swingTime)
      return null
    }
    this.recoil += (0 - this.recoil) * Math.min(1, dt * 14)

    let event = null
    const queued = this.burstLeft > 0
    if ((firing || queued) && this.cooldown <= 0) {
      const rate = motion && motion.fireRate > 0 ? motion.fireRate : 1
      if (!queued) this.burstLeft = this.burst
      this.burstLeft--
      this.cooldown = (this.burstLeft > 0 ? this.burstGap : this.fireInterval) / rate
      this.recoil = 1
      event = 'fire'
    }

    const sliding = motion && motion.sliding ? 1 : 0
    const blendRate = sliding > this.slideBlend ? 14 : 26
    this.slideBlend += (sliding - this.slideBlend) * Math.min(1, dt * blendRate)
    const sway = motion && motion.moving && this.slideBlend < 0.45 ? 0.011 : 0.004
    const speed = 7
    this.group.position.x = this.restX + Math.sin(this.time * speed) * sway
    this.group.position.y = this.restY + Math.cos(this.time * speed * 0.8) * sway * 0.5 - this.recoil * this.recoilKick - this.slideBlend * 0.09
    this.group.position.z = this.restZ + this.recoil * 0.05
    this.group.rotation.x = this.rotX + this.recoil * this.recoilTilt
    this.group.rotation.y = this.rotY
    this.group.rotation.z = this.rotZ + this.slideBlend * 0.14

    return event
  }

  muzzleWorld() {
    this.muzzle.getWorldPosition(this.muzzlePos)
    return this.muzzlePos
  }
}

export class Guns {
  constructor(camera) {
    this.list = []
    for (let i = 0; i < SPECS.length; i++) this.list.push(new Gun(camera, SPECS[i]))
  }

  roll(held) {
    let pick = Math.floor(Math.random() * this.list.length)
    if (this.list[pick] === held) {
      pick = (pick + 1 + Math.floor(Math.random() * (this.list.length - 1))) % this.list.length
    }
    return this.list[pick]
  }

  hide() {
    for (let i = 0; i < this.list.length; i++) this.list[i].group.visible = false
  }
}
