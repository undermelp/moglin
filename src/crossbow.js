import * as THREE from 'three'
import { SWING_TIME, poseSwing } from './swing.js'

const FIRE_INTERVAL = 0.55
const REST_X = 0.2
const REST_Y = -0.15
const REST_Z = -0.38

export class Crossbow {
  constructor(camera) {
    this.camera = camera
    this.name = 'CROSSBOW'
    this.magSize = 0
    this.mag = 0
    this.reserve = 0
    this.damage = 57
    this.headMultiplier = 2
    this.arrowSpeed = 34
    this.spread = 0.012
    this.pellets = 1
    this.boltSize = 1
    this.sound = 'bow'
    this.fireInterval = FIRE_INTERVAL
    this.cooldown = 0
    this.recoil = 0
    this.time = 0
    this.slideBlend = 0
    this.swingTime = 0
    this.muzzlePos = new THREE.Vector3()

    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.82, metalness: 0.04 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.75, metalness: 0.06 })
    const metal = new THREE.MeshStandardMaterial({ color: 0x7a828a, roughness: 0.4, metalness: 0.58 })

    this.group = new THREE.Group()
    this.group.position.set(REST_X, REST_Y, REST_Z)
    this.group.rotation.set(0.04, -0.06, 0.02)
    this.group.scale.setScalar(0.6)

    this.stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.28), wood)
    this.stock.position.set(0, -0.02, 0.06)

    this.riser = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.06), dark)
    this.riser.position.set(0, 0.02, -0.02)

    this.limbL = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.34), dark)
    this.limbL.position.set(-0.17, 0.05, -0.02)
    this.limbL.rotation.y = 0.12
    this.limbR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.34), dark)
    this.limbR.position.set(0.17, 0.05, -0.02)
    this.limbR.rotation.y = -0.12

    this.string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.32, 4), metal)
    this.string.rotation.z = Math.PI / 2
    this.string.position.set(0, 0.05, -0.02)
    this.stringBaseX = this.string.scale.x

    this.rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.42), wood)
    this.rail.position.set(0, 0.01, -0.22)

    this.prod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), metal)
    this.prod.rotation.x = Math.PI / 2
    this.prod.position.set(0, 0.04, -0.44)

    this.muzzle = new THREE.Object3D()
    this.muzzle.position.set(0, 0.04, -0.48)

    this.group.frustumCulled = false
    this.group.add(this.stock, this.riser, this.limbL, this.limbR, this.string, this.rail, this.prod, this.muzzle)
    camera.add(this.group)

    const viewLight = new THREE.PointLight(0xfff0e0, 0.38, 2.2, 2)
    viewLight.position.set(0.02, 0.02, -0.14)
    camera.add(viewLight)
  }

  reset() {
    this.cooldown = 0
    this.recoil = 0
    this.slideBlend = 0
    this.swingTime = 0
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
      poseSwing(this.group, REST_X, REST_Y, REST_Z, 0.04, -0.06, 0.02, this.swingTime)
      return null
    }
    this.recoil += (0 - this.recoil) * Math.min(1, dt * 18)

    let event = null
    if (firing && this.cooldown <= 0) {
      const rate = motion && motion.fireRate > 0 ? motion.fireRate : 1
      this.cooldown = this.fireInterval / rate
      this.recoil = 1
      event = 'fire'
    }

    const pull = 1 - this.recoil * 0.35
    this.string.scale.x = pull
    this.string.position.x = this.recoil * 0.018

    const sliding = motion && motion.sliding ? 1 : 0
    const blendRate = sliding > this.slideBlend ? 14 : 26
    this.slideBlend += (sliding - this.slideBlend) * Math.min(1, dt * blendRate)
    const sway = motion && motion.moving && this.slideBlend < 0.45 ? 0.011 : 0.004
    const speed = 7
    this.group.position.x = REST_X + Math.sin(this.time * speed) * sway
    this.group.position.y = REST_Y + Math.cos(this.time * speed * 0.8) * sway * 0.5 - this.recoil * 0.01 - this.slideBlend * 0.09
    this.group.position.z = REST_Z + this.recoil * 0.025
    this.group.rotation.x = 0.04 + this.recoil * 0.08
    this.group.rotation.y = -0.06
    this.group.rotation.z = 0.02 + this.slideBlend * 0.14

    return event
  }

  muzzleWorld() {
    this.muzzle.getWorldPosition(this.muzzlePos)
    return this.muzzlePos
  }
}
