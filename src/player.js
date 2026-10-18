import * as THREE from 'three'
import { ARENA_RADIUS, groundHeight } from './arena.js'
import { clampToRadius, moveWithCollision } from './collide.js'

const WALK_SPEED = 5.15
const SLIDE_SPEED = 17
const SLIDE_CHAIN = 6
const SLIDE_MAX = 28
const SLIDE_TIME = 0.62
const SLIDE_COOLDOWN = 0.4
const SLIDE_BUFFER = 0.22
const SLIDE_DRAG = 0.4
const AIR_DRAG = 0.3
const GROUND_BLEED = 3.4
const CHAIN_TIME = 1.15
const SLIDE_EYE = 0.78
const JUMP_SPEED = 8.6
const GRAVITY = 24
const EYE_HEIGHT = 1.62
const MAX_HEALTH = 100
const REGEN_DELAY = 3.4
const REGEN_RATE = 12
const MOUSE_SENS = 0.00215
const PITCH_LIMIT = 1.35
const BASE_FOV = 95

export const PLAYER_RADIUS = 0.38

export class Player {
  constructor(camera) {
    this.camera = camera
    this.x = 0
    this.z = 0
    this.yaw = 0
    this.pitch = 0
    this.pitchKick = 0
    this.maxHealth = MAX_HEALTH
    this.health = MAX_HEALTH
    this.sinceHurt = REGEN_DELAY
    this.shake = 0
    this.time = 0
    this.bobPhase = 0
    this.bobAmp = 0
    this.moving = false
    this.feetY = 0
    this.vy = 0
    this.sliding = false
    this.slideTime = 0
    this.slideCooldown = 0
    this.slideDirX = 0
    this.slideDirZ = 0
    this.velX = 0
    this.velZ = 0
    this.slideBuffer = 0
    this.chainTime = 0
    this.eyeDrop = 0
    this.slideDip = 0
    this.landDrop = 0
    this.slid = false
    this.jumped = false
    this.radius = PLAYER_RADIUS
    this.step = { x: 0, z: 0 }
    this.fov = BASE_FOV
    this.molotovs = 0
    this.resetBoosts()

    camera.rotation.order = 'YXZ'
    camera.fov = BASE_FOV
    camera.updateProjectionMatrix()

    this.lamp = new THREE.SpotLight(0xd0e4ff, 10, 24, 0.62, 0.45, 1)
    this.lamp.position.set(0, 0, 0)
    this.lamp.target.position.set(0, 0, -1)
    camera.add(this.lamp)
    camera.add(this.lamp.target)
  }

  resetBoosts() {
    this.maxHealth = MAX_HEALTH
    this.damageMult = 1
    this.meleeMult = 1
    this.meleeRangeMult = 1
    this.meleeArcMult = 1
    this.fireRateMult = 1
    this.moveMult = 1
    this.slideMult = 1
    this.jumpMult = 1
    this.regenMult = 1
    this.armor = 0
    this.magnetMult = 1
    this.headBonus = 0
    this.arrowSpeedMult = 1
    this.knockMult = 1
    this.lifesteal = 0
    this.xpMult = 1
    this.igniteChance = 0
    this.lightning = 0
  }

  reset() {
    this.x = 0
    this.z = 0
    this.yaw = 0
    this.pitch = 0
    this.pitchKick = 0
    this.resetBoosts()
    this.molotovs = 0
    this.health = this.maxHealth
    this.sinceHurt = REGEN_DELAY
    this.shake = 0
    this.bobAmp = 0
    this.feetY = 0
    this.vy = 0
    this.sliding = false
    this.slideTime = 0
    this.slideCooldown = 0
    this.slideDirX = 0
    this.slideDirZ = 0
    this.velX = 0
    this.velZ = 0
    this.slideBuffer = 0
    this.chainTime = 0
    this.eyeDrop = 0
    this.slideDip = 0
    this.landDrop = 0
    this.slid = false
    this.jumped = false
    this.fov = BASE_FOV
    this.place(0)
  }

  heal(amount) {
    if (this.health <= 0) return
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  addKick() {
    this.pitchKick = Math.min(0.035, this.pitchKick + 0.014)
    this.shake = Math.min(0.6, this.shake + 0.12)
  }

  hurt(amount) {
    if (this.health <= 0) return
    const taken = amount * (1 - this.armor)
    this.health = Math.max(0, this.health - taken)
    this.sinceHurt = 0
    this.shake = Math.min(1, this.shake + 0.75)
  }

  update(dt, input, blocks, circles) {
    this.time += dt
    this.yaw -= input.dx * MOUSE_SENS
    this.pitch -= input.dy * MOUSE_SENS
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch))
    this.pitchKick *= Math.exp(-dt * 16)
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt)
    if (this.chainTime > 0) this.chainTime = Math.max(0, this.chainTime - dt)
    this.slid = false
    this.jumped = false

    let inputX = 0
    let inputZ = 0
    if (input.keys.has('KeyW')) inputZ += 1
    if (input.keys.has('KeyS')) inputZ -= 1
    if (input.keys.has('KeyD')) inputX += 1
    if (input.keys.has('KeyA')) inputX -= 1
    const inputLen = Math.hypot(inputX, inputZ)
    this.moving = inputLen > 0
    if (this.moving) {
      inputX /= inputLen
      inputZ /= inputLen
    }

    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)
    const wishX = forwardX * inputZ + rightX * inputX
    const wishZ = forwardZ * inputZ + rightZ * inputX

    const walk = WALK_SPEED * this.moveMult
    const slide = SLIDE_SPEED * this.slideMult
    const slideMax = SLIDE_MAX * this.slideMult
    const floorNow = groundHeight(this.x, this.z)
    const grounded = this.vy <= 0 && this.feetY <= floorNow + 0.06

    if (input.slide) this.slideBuffer = SLIDE_BUFFER
    else if (this.slideBuffer > 0) this.slideBuffer = Math.max(0, this.slideBuffer - dt)

    if (this.slideBuffer > 0 && grounded && this.slideCooldown <= 0) {
      const carried = Math.hypot(this.velX, this.velZ)
      let dirX = forwardX
      let dirZ = forwardZ
      if (this.moving) {
        dirX = wishX
        dirZ = wishZ
      } else if (carried > 1) {
        dirX = this.velX / carried
        dirZ = this.velZ / carried
      }
      const along = this.velX * dirX + this.velZ * dirZ
      const chain = this.chainTime > 0 && along > walk + 2 ? SLIDE_CHAIN * this.slideMult : 0
      const speed = Math.min(slideMax, Math.max(slide, along + chain))
      this.velX = dirX * speed
      this.velZ = dirZ * speed
      this.slideDirX = dirX
      this.slideDirZ = dirZ
      this.slideTime = SLIDE_TIME
      this.slideCooldown = SLIDE_COOLDOWN
      this.slideBuffer = 0
      this.chainTime = 0
      this.sliding = true
      this.slid = true
    }

    if (input.jump && grounded) {
      if (this.sliding || Math.hypot(this.velX, this.velZ) > walk + 2) this.chainTime = CHAIN_TIME
      this.vy = JUMP_SPEED * this.jumpMult
      this.jumped = true
      this.sliding = false
    }

    if (this.sliding) {
      if (this.moving) {
        const steer = Math.min(1, dt * 2.6)
        this.slideDirX += (wishX - this.slideDirX) * steer
        this.slideDirZ += (wishZ - this.slideDirZ) * steer
        const len = Math.hypot(this.slideDirX, this.slideDirZ)
        if (len > 1e-5) {
          this.slideDirX /= len
          this.slideDirZ /= len
        }
        const spd = Math.hypot(this.velX, this.velZ)
        this.velX = this.slideDirX * spd
        this.velZ = this.slideDirZ * spd
      }
      this.slideTime -= dt
      if (this.slideTime <= 0) {
        this.slideTime = 0
        this.sliding = false
      }
    }

    let spd = Math.hypot(this.velX, this.velZ)
    if (!grounded || this.jumped) {
      if (this.moving) {
        const keep = Math.max(spd, walk)
        const steer = Math.min(1, dt * 1.8)
        const nx = this.velX + (wishX * keep - this.velX) * steer
        const nz = this.velZ + (wishZ * keep - this.velZ) * steer
        const len = Math.hypot(nx, nz) || 1
        this.velX = (nx / len) * keep
        this.velZ = (nz / len) * keep
        spd = keep
      }
      if (spd > walk) {
        const next = walk + (spd - walk) * Math.exp(-dt * AIR_DRAG)
        this.velX *= next / spd
        this.velZ *= next / spd
      }
    } else if (this.sliding) {
      if (spd > walk) {
        const next = walk + (spd - walk) * Math.exp(-dt * SLIDE_DRAG)
        this.velX *= next / spd
        this.velZ *= next / spd
      }
    } else if (spd <= walk + 0.35) {
      this.velX = wishX * walk
      this.velZ = wishZ * walk
    } else {
      const bleed = Math.min(1, dt * GROUND_BLEED)
      this.velX += (wishX * walk - this.velX) * bleed
      this.velZ += (wishZ * walk - this.velZ) * bleed
    }

    const dx = this.velX * dt
    const dz = this.velZ * dt
    const slices = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (this.radius * 0.6)))
    const step = this.step
    let x = this.x
    let z = this.z
    for (let i = 0; i < slices; i++) {
      moveWithCollision(x, z, this.radius, dx / slices, dz / slices, blocks, circles, null, step)
      x = step.x
      z = step.z
    }
    clampToRadius(x, z, this.radius, ARENA_RADIUS, step)
    this.x = step.x
    this.z = step.z

    const floor = groundHeight(this.x, this.z)
    if (grounded && !this.jumped) {
      this.feetY = floor
      this.vy = 0
    } else {
      this.vy -= GRAVITY * dt
      this.feetY += this.vy * dt
      if (this.feetY <= floor) {
        if (this.vy < -5) this.landDrop = Math.min(0.1, -this.vy * 0.005)
        this.feetY = floor
        this.vy = 0
      }
    }

    this.sinceHurt += dt
    if (this.sinceHurt > REGEN_DELAY && this.health > 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_RATE * this.regenMult * dt)
    }

    const stepping = this.moving && !this.sliding && this.vy === 0
    const ampTarget = stepping ? 0.65 : 0
    this.bobAmp += (ampTarget - this.bobAmp) * Math.min(1, dt * 8)
    if (stepping) this.bobPhase += dt * 9.5
    this.place(dt)

    const targetFov = BASE_FOV + (this.sliding ? 11 : 0)
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 12)
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  place(dt) {
    const dropTarget = this.sliding ? SLIDE_EYE : 0
    const standRate = this.sliding ? 16 : 28
    this.eyeDrop += (dropTarget - this.eyeDrop) * Math.min(1, dt * standRate)
    const dipTarget = this.sliding ? 0.08 : 0
    this.slideDip += (dipTarget - this.slideDip) * Math.min(1, dt * standRate)
    this.landDrop *= Math.exp(-dt * 14)

    const bobY = Math.sin(this.bobPhase) * 0.04 * this.bobAmp
    const bobX = Math.cos(this.bobPhase * 0.5) * 0.014 * this.bobAmp
    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)
    this.camera.position.set(
      this.x + rightX * bobX,
      this.feetY + EYE_HEIGHT - this.eyeDrop - this.landDrop + bobY,
      this.z + rightZ * bobX,
    )
    if (this.shake > 0) {
      this.camera.position.x += Math.sin(this.time * 48) * this.shake * 0.035
      this.camera.position.y += Math.cos(this.time * 37) * this.shake * 0.025
      this.shake = Math.max(0, this.shake - dt * 2.4)
    }
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch + this.pitchKick - this.slideDip + Math.sin(this.time * 40) * this.shake * 0.012
    this.camera.rotation.z = 0
  }
}
