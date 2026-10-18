import * as THREE from 'three'
import { groundHeight } from './arena.js'

const POOL = 16
const WAVE_POOL = 3
const WAVE_LIFE = 0.42
const BLAST_POOL = 6
const BLAST_LIFE = 0.28
const BOLT_POOL = 4
const BOLT_POINTS = 8
const BOLT_LIFE = 0.2

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.tracers = []
    this.sparks = []
    this.shells = []
    this.decals = []
    this.waves = []
    this.blasts = []
    this.bolts = []
    this.sparkCursor = 0
    this.shellCursor = 0
    this.decalCursor = 0
    this.waveCursor = 0
    this.blastCursor = 0
    this.boltCursor = 0
    this.blast = new THREE.PointLight(0xffc27a, 0, 7, 2)
    scene.add(this.blast)

    const waveGeo = new THREE.RingGeometry(0.82, 1, 48)
    for (let i = 0; i < WAVE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7ef6e4,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(waveGeo, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      scene.add(mesh)
      this.waves.push({ mesh, life: 0, radius: 12 })
    }

    const blastGeo = new THREE.SphereGeometry(1, 16, 12)
    for (let i = 0; i < BLAST_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa8ff66,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(blastGeo, mat)
      mesh.visible = false
      scene.add(mesh)
      this.blasts.push({ mesh, life: 0, radius: 1 })
    }

    for (let i = 0; i < BOLT_POOL; i++) {
      const positions = new Float32Array(BOLT_POINTS * 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({
        color: 0xd6ecff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const line = new THREE.Line(geo, mat)
      line.visible = false
      line.frustumCulled = false
      scene.add(line)
      const flashMat = new THREE.SpriteMaterial({
        color: 0xeaf6ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const flash = new THREE.Sprite(flashMat)
      flash.visible = false
      scene.add(flash)
      this.bolts.push({ line, flash, life: 0 })
    }

    const decalGeo = new THREE.CircleGeometry(0.045, 8)
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x1a1614, transparent: true, opacity: 0.85, depthWrite: false })
    for (let i = 0; i < POOL; i++) {
      const positions = new Float32Array(6)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({ color: 0xffe1a8, transparent: true, opacity: 0 })
      const line = new THREE.Line(geo, mat)
      line.visible = false
      line.frustumCulled = false
      scene.add(line)
      this.tracers.push({ line, life: 0 })

      const sparkMat = new THREE.SpriteMaterial({
        color: 0xfff1d2,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const spark = new THREE.Sprite(sparkMat)
      spark.visible = false
      scene.add(spark)
      this.sparks.push({ sprite: spark, life: 0, base: 0.2 })

      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.018, 0.028),
        new THREE.MeshBasicMaterial({ color: 0xd4b06a }),
      )
      shell.visible = false
      scene.add(shell)
      this.shells.push({ mesh: shell, life: 0, velocity: new THREE.Vector3() })

      const decal = new THREE.Mesh(decalGeo, decalMat)
      decal.visible = false
      scene.add(decal)
      this.decals.push(decal)
    }
  }

  tracer(from, to) {
    const item = this.tracers.find((entry) => entry.life <= 0) || this.tracers[0]
    const attr = item.line.geometry.attributes.position
    attr.setXYZ(0, from.x, from.y, from.z)
    attr.setXYZ(1, to.x, to.y, to.z)
    attr.needsUpdate = true
    item.line.geometry.computeBoundingSphere()
    item.life = 0.05
    item.line.visible = true
    item.line.material.opacity = 1
  }

  spark(point, color, normal) {
    const item = this.sparks[this.sparkCursor]
    this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length
    item.sprite.position.copy(point)
    if (normal) item.sprite.position.addScaledVector(normal, 0.05)
    item.sprite.material.color.set(color)
    item.sprite.material.opacity = 1
    item.life = 0.16
    item.base = 0.16 + Math.random() * 0.14
    item.sprite.visible = true
    item.sprite.scale.setScalar(item.base)
  }

  shell(origin, camera) {
    const item = this.shells[this.shellCursor]
    this.shellCursor = (this.shellCursor + 1) % this.shells.length
    item.mesh.position.copy(origin)
    item.mesh.visible = true
    item.life = 0.9
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1.3, 0)
    const back = new THREE.Vector3()
    camera.getWorldDirection(back).multiplyScalar(-0.35)
    item.velocity.copy(right).multiplyScalar(1.6 + Math.random() * 0.4).add(up).add(back)
    item.mesh.rotation.set(Math.random(), Math.random(), Math.random())
  }

  decal(point, normal) {
    const mesh = this.decals[this.decalCursor]
    this.decalCursor = (this.decalCursor + 1) % this.decals.length
    mesh.position.copy(point).addScaledVector(normal, 0.025)
    mesh.lookAt(point.clone().add(normal))
    mesh.visible = true
  }

  blastAt(point) {
    this.blast.distance = 7
    this.blast.position.copy(point)
    this.blast.intensity = 14
  }

  blastBurst(x, y, z, radius, color) {
    const item = this.blasts[this.blastCursor]
    this.blastCursor = (this.blastCursor + 1) % this.blasts.length
    item.mesh.position.set(x, y, z)
    item.mesh.material.color.setHex(color)
    item.mesh.material.opacity = 0.85
    item.mesh.scale.setScalar(radius * 0.2)
    item.mesh.visible = true
    item.life = BLAST_LIFE
    item.radius = radius
    this.blast.color.setHex(color)
    this.blast.distance = Math.max(7, radius * 2)
    this.blast.position.set(x, y, z)
    this.blast.intensity = 22
  }

  lightning(x, y, z) {
    const item = this.bolts[this.boltCursor]
    this.boltCursor = (this.boltCursor + 1) % this.bolts.length
    const attr = item.line.geometry.attributes.position
    const height = 16
    const ox = (Math.random() - 0.5) * 3.2
    const oz = (Math.random() - 0.5) * 3.2
    let jx = 0
    let jz = 0
    const last = BOLT_POINTS - 1
    for (let i = 0; i <= last; i++) {
      const t = i / last
      if (i !== 0 && i !== last) {
        jx += (Math.random() - 0.5) * 1.7
        jz += (Math.random() - 0.5) * 1.7
      }
      const jag = i === last ? 0 : 1 - t * 0.35
      attr.setXYZ(i, x + ox * (1 - t) + jx * jag, y + height * (1 - t), z + oz * (1 - t) + jz * jag)
    }
    attr.needsUpdate = true
    item.line.geometry.computeBoundingSphere()
    item.life = BOLT_LIFE
    item.line.material.opacity = 1
    item.line.visible = true
    item.flash.position.set(x, y + 0.55, z)
    item.flash.material.opacity = 1
    item.flash.scale.setScalar(2.6)
    item.flash.visible = true
    this.blast.color.setHex(0xcfe6ff)
    this.blast.distance = 22
    this.blast.position.set(x, y + 0.8, z)
    this.blast.intensity = 42
  }

  shockwave(x, y, z, radius = 12, color = 0x7ef6e4) {
    const item = this.waves[this.waveCursor]
    this.waveCursor = (this.waveCursor + 1) % this.waves.length
    item.mesh.position.set(x, y, z)
    item.mesh.material.color.setHex(color)
    item.mesh.material.opacity = 0.95
    item.mesh.scale.setScalar(0.35)
    item.mesh.visible = true
    item.life = WAVE_LIFE
    item.radius = radius
    this.blast.color.setHex(color)
    this.blast.distance = 7
    this.blast.position.set(x, y + 0.6, z)
    this.blast.intensity = 28
  }

  waterSpray(origin, forward, count) {
    const right = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    right.crossVectors(forward, up).normalize()
    if (right.lengthSq() < 0.01) right.set(1, 0, 0)
    up.crossVectors(right, forward).normalize()
    for (let i = 0; i < count; i++) {
      const item = this.sparks[this.sparkCursor]
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length
      const spread = 0.35 + Math.random() * 0.55
      const ox = (Math.random() - 0.5) * spread
      const oy = (Math.random() - 0.5) * spread * 0.7
      item.sprite.position.copy(origin)
      item.sprite.position.addScaledVector(right, ox)
      item.sprite.position.addScaledVector(up, oy)
      item.sprite.position.addScaledVector(forward, 0.08 + Math.random() * 0.12)
      item.sprite.material.color.set(0x9ec8ff)
      item.sprite.material.opacity = 0.85
      item.life = 0.22 + Math.random() * 0.08
      item.base = 0.06 + Math.random() * 0.05
      item.sprite.visible = true
      item.sprite.scale.setScalar(item.base)
    }
    this.blast.color.set(0xa8d4ff)
    this.blastAt(origin)
    this.blast.intensity = 8
  }

  clear() {
    for (const item of this.tracers) item.life = 0
    for (const item of this.sparks) item.life = 0
    for (const item of this.shells) item.life = 0
    for (const item of this.waves) item.life = 0
    for (const item of this.blasts) item.life = 0
    for (const item of this.bolts) item.life = 0
    for (const mesh of this.decals) mesh.visible = false
    this.blast.intensity = 0
    this.update(0)
  }

  update(dt) {
    this.blast.intensity = Math.max(0, this.blast.intensity - dt * 90)
    for (const item of this.waves) {
      if (item.life <= 0) {
        item.mesh.visible = false
        continue
      }
      item.life -= dt
      const t = 1 - Math.max(item.life, 0) / WAVE_LIFE
      const scale = 0.35 + item.radius * t
      item.mesh.scale.setScalar(scale)
      item.mesh.material.opacity = Math.max(0, (1 - t) * 0.95)
      item.mesh.visible = item.life > 0
    }
    for (const item of this.blasts) {
      if (item.life <= 0) {
        item.mesh.visible = false
        continue
      }
      item.life -= dt
      const t = 1 - Math.max(item.life, 0) / BLAST_LIFE
      item.mesh.scale.setScalar(item.radius * (0.2 + 0.8 * t))
      item.mesh.material.opacity = Math.max(0, (1 - t) * 0.85)
      item.mesh.visible = item.life > 0
    }
    for (const item of this.bolts) {
      if (item.life <= 0) {
        item.line.visible = false
        item.flash.visible = false
        continue
      }
      item.life -= dt
      const k = Math.max(0, item.life / BOLT_LIFE)
      item.line.material.opacity = k
      item.line.visible = item.life > 0
      item.flash.material.opacity = k
      item.flash.scale.setScalar(1.4 + (1 - k) * 2.4)
      item.flash.visible = item.life > 0
    }
    for (const item of this.tracers) {
      if (item.life <= 0) {
        item.line.visible = false
        continue
      }
      item.life -= dt
      item.line.material.opacity = Math.max(0, item.life / 0.05)
      item.line.visible = item.life > 0
    }
    for (const item of this.sparks) {
      if (item.life <= 0) {
        item.sprite.visible = false
        continue
      }
      item.life -= dt
      const k = Math.max(0, item.life / 0.16)
      item.sprite.material.opacity = k
      item.sprite.scale.setScalar(item.base * (1.5 - k))
      item.sprite.position.y += dt * 0.35
      item.sprite.visible = item.life > 0
    }
    for (const item of this.shells) {
      if (item.life <= 0) {
        item.mesh.visible = false
        continue
      }
      item.life -= dt
      item.velocity.y -= 9.8 * dt
      item.mesh.position.addScaledVector(item.velocity, dt)
      item.mesh.rotation.x += dt * 8
      item.mesh.rotation.z += dt * 6
      const floorY = groundHeight(item.mesh.position.x, item.mesh.position.z) + 0.02
      if (item.mesh.position.y < floorY) {
        item.mesh.position.y = floorY
        item.velocity.y *= -0.25
        item.velocity.x *= 0.6
        item.velocity.z *= 0.6
      }
      item.mesh.visible = item.life > 0
    }
  }
}
