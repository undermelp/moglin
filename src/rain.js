import * as THREE from 'three'
import { groundHeight } from './arena.js'

const COUNT = 5600
const SPAWN_RADIUS = 48
const KEEP_RADIUS = 68
const KEEP_RADIUS_SQ = KEEP_RADIUS * KEEP_RADIUS
const LEAD_TIME = 0.7
const MAX_LEAD = 22
const TOP = 46
const BAND = 16
const STREAK = 0.42
const WIND_X = 0.55
const WIND_Z = 1.25

function spawnDrop(xs, zs, ys, driftX, driftZ, falls, i, px, pz, ceiling, gustX, gustZ, fill) {
  const angle = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random()) * SPAWN_RADIUS
  const x = px + Math.cos(angle) * radius
  const z = pz + Math.sin(angle) * radius
  xs[i] = x
  zs[i] = z
  const floor = groundHeight(x, z) + 0.15
  if (fill) ys[i] = floor + Math.random() * Math.max(1, ceiling - floor)
  else ys[i] = ceiling - Math.random() * BAND
  const wind = Math.atan2(gustZ, gustX) + (Math.random() - 0.5) * 1.1
  const gust = Math.hypot(gustX, gustZ)
  const speed = gust * (0.55 + Math.random() * 0.95)
  driftX[i] = Math.cos(wind) * speed
  driftZ[i] = Math.sin(wind) * speed
  falls[i] = 12 + Math.random() * 9
}

export class Rain {
  constructor(scene) {
    this.time = 0
    this.seeded = false
    this.xs = new Float32Array(COUNT)
    this.zs = new Float32Array(COUNT)
    this.ys = new Float32Array(COUNT)
    this.driftX = new Float32Array(COUNT)
    this.driftZ = new Float32Array(COUNT)
    this.falls = new Float32Array(COUNT)
    this.positions = new Float32Array(COUNT * 6)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0x2a323c,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.lines = new THREE.LineSegments(geo, mat)
    this.lines.frustumCulled = false
    scene.add(this.lines)
  }

  update(dt, px, pz, anchorY, vx = 0, vz = 0) {
    this.time += dt
    let leadX = vx * LEAD_TIME
    let leadZ = vz * LEAD_TIME
    const lead = Math.hypot(leadX, leadZ)
    if (lead > MAX_LEAD) {
      const scale = MAX_LEAD / lead
      leadX *= scale
      leadZ *= scale
    }
    const sx = px + leadX
    const sz = pz + leadZ
    const ceiling = anchorY + 10 + TOP
    const gustX =
      WIND_X + Math.sin(this.time * 0.19) * 0.55 + Math.sin(this.time * 0.61) * 0.22
    const gustZ =
      WIND_Z + Math.cos(this.time * 0.23) * 0.65 + Math.cos(this.time * 0.47) * 0.28

    if (!this.seeded) {
      for (let i = 0; i < COUNT; i++) {
        spawnDrop(this.xs, this.zs, this.ys, this.driftX, this.driftZ, this.falls, i, sx, sz, ceiling, gustX, gustZ, true)
      }
      this.seeded = true
    }

    for (let i = 0; i < COUNT; i++) {
      let dx = this.driftX[i] + gustX * 0.35
      let dz = this.driftZ[i] + gustZ * 0.35
      let fall = this.falls[i]

      let x = this.xs[i] + dx * dt
      let z = this.zs[i] + dz * dt
      let y = this.ys[i] - fall * dt

      const ox = x - px
      const oz = z - pz
      const lx = x - sx
      const lz = z - sz
      const floor = groundHeight(x, z) + 0.15
      const nearHero = ox * ox + oz * oz <= KEEP_RADIUS_SQ
      const nearLead = lx * lx + lz * lz <= KEEP_RADIUS_SQ
      if (y < floor || (!nearHero && !nearLead)) {
        spawnDrop(
          this.xs,
          this.zs,
          this.ys,
          this.driftX,
          this.driftZ,
          this.falls,
          i,
          sx,
          sz,
          ceiling,
          gustX,
          gustZ,
          y >= floor,
        )
        x = this.xs[i]
        y = this.ys[i]
        z = this.zs[i]
        dx = this.driftX[i] + gustX * 0.35
        dz = this.driftZ[i] + gustZ * 0.35
        fall = this.falls[i]
      } else {
        this.xs[i] = x
        this.ys[i] = y
        this.zs[i] = z
      }

      const len = Math.hypot(dx, fall, dz) || 1
      const j = i * 6
      this.positions[j] = x
      this.positions[j + 1] = y
      this.positions[j + 2] = z
      this.positions[j + 3] = x - (dx / len) * STREAK
      this.positions[j + 4] = y + (fall / len) * STREAK
      this.positions[j + 5] = z - (dz / len) * STREAK
    }
    this.lines.geometry.attributes.position.needsUpdate = true
  }
}
