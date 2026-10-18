import * as THREE from 'three'
import { groundHeight, groundNormal } from './arena.js'

const COUNT = 340
const RADIUS = 14
const DIAMETER = RADIUS * 2
const CARD_W = 0.42
const CARD_H = 0.58
const TILE = 1.4
const TILE_HALF = Math.ceil(RADIUS / TILE)
const TILE_SPAN = TILE_HALF * 2 + 1
const TILE_COUNT = TILE_SPAN * TILE_SPAN
// Nearest bolt lamps drive grass/ground lighting; cap keeps cost stable after fire-rate perks.
const MAX_GRASS_LAMPS = 8
const LAMP_PATCHES = MAX_GRASS_LAMPS
const TILE_BUDGET = TILE_COUNT * (1 + LAMP_PATCHES)
const TILE_KEY_BIAS = 8192
const TILE_KEY_STRIDE = 16384
const GRASS_NEAR = new THREE.Color(0xb8d898)
const GRASS_FAR = new THREE.Color(0x1a2418)
const TILE_NEAR = new THREE.Color(0x8aaa78)
const TILE_FAR = new THREE.Color(0x0a100c)

function wrapAround(value, origin) {
  let d = value - origin + RADIUS
  d -= Math.floor(d / DIAMETER) * DIAMETER
  return origin + d - RADIUS
}

function lanternFade(dist) {
  if (dist >= RADIUS) return 0
  const t = dist / RADIUS
  return (1 - t) * (1 - t)
}

// One shared falloff from the nearest light (player or bolt).
export function nearestLanternFade(x, z, px, pz, lamps) {
  let nearest = Math.hypot(x - px, z - pz)
  if (lamps) {
    for (let i = 0; i < lamps.length; i++) {
      const lamp = lamps[i]
      if (lamp.w <= 0) continue
      // Fading bolts act farther away so intensity eases out with stick fade.
      const d = Math.hypot(x - lamp.x, z - lamp.z) / lamp.w
      if (d < nearest) nearest = d
    }
  }
  return lanternFade(nearest)
}

function makeInstances(geo, mat, count) {
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  return mesh
}

export class GrassLantern {
  constructor(scene, textures) {
    this.xs = new Float32Array(COUNT)
    this.zs = new Float32Array(COUNT)
    this.scales = new Float32Array(COUNT)
    this.dummy = new THREE.Object3D()
    this.color = new THREE.Color()
    this.up = new THREE.Vector3(0, 1, 0)
    this.normal = new THREE.Vector3()
    this.nearLamps = []
    this.lampScores = new Float32Array(MAX_GRASS_LAMPS)

    const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H)
    cardGeo.translate(0, CARD_H * 0.5, 0)
    const cardMat = new THREE.MeshBasicMaterial({
      map: textures.grass,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.grass = makeInstances(cardGeo, cardMat, COUNT)

    const tileGeo = new THREE.PlaneGeometry(TILE, TILE)
    tileGeo.rotateX(-Math.PI / 2)
    const tileMat = new THREE.MeshBasicMaterial({
      map: textures.ground,
    })
    this.tiles = makeInstances(tileGeo, tileMat, TILE_BUDGET)
    this.tileKeys = new Set()

    for (let i = 0; i < COUNT; i++) {
      const t = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * RADIUS
      this.xs[i] = Math.cos(t) * r
      this.zs[i] = Math.sin(t) * r
      this.scales[i] = 0.7 + Math.random() * 0.7
      this.grass.setColorAt(i, GRASS_FAR)
    }
    for (let i = 0; i < TILE_BUDGET; i++) this.tiles.setColorAt(i, TILE_FAR)

    this.grass.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.tiles.instanceColor.setUsage(THREE.DynamicDrawUsage)
    scene.add(this.tiles)
    scene.add(this.grass)
    this.update(0, 0)
  }

  /** Keep only the nearest active lamps so fade + tile stamps stay bounded. */
  pickNearLamps(px, pz, lamps) {
    const near = this.nearLamps
    near.length = 0
    if (!lamps || lamps.length === 0) return near
    if (lamps.length <= MAX_GRASS_LAMPS) {
      for (let i = 0; i < lamps.length; i++) {
        if (lamps[i].w > 0) near.push(lamps[i])
      }
      return near
    }

    const scores = this.lampScores
    let count = 0
    for (let i = 0; i < lamps.length; i++) {
      const lamp = lamps[i]
      if (lamp.w <= 0) continue
      const dx = lamp.x - px
      const dz = lamp.z - pz
      const score = (dx * dx + dz * dz) / (lamp.w * lamp.w)
      if (count < MAX_GRASS_LAMPS) {
        near[count] = lamp
        scores[count] = score
        count += 1
        continue
      }
      let worst = 0
      for (let j = 1; j < MAX_GRASS_LAMPS; j++) {
        if (scores[j] > scores[worst]) worst = j
      }
      if (score < scores[worst]) {
        near[worst] = lamp
        scores[worst] = score
      }
    }
    near.length = count
    return near
  }

  update(px, pz, lamps) {
    const lit = this.pickNearLamps(px, pz, lamps)
    for (let i = 0; i < COUNT; i++) {
      const x = wrapAround(this.xs[i], px)
      const z = wrapAround(this.zs[i], pz)
      this.xs[i] = x
      this.zs[i] = z

      const dist = Math.hypot(x - px, z - pz)
      const fade = nearestLanternFade(x, z, px, pz, lit)
      const y = groundHeight(x, z)
      const s = dist > RADIUS ? 0 : this.scales[i] * (0.55 + 0.45 * fade)

      this.dummy.position.set(x, y, z)
      this.dummy.rotation.set(0, Math.atan2(px - x, pz - z), 0)
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.grass.setMatrixAt(i, this.dummy.matrix)

      this.color.copy(GRASS_FAR).lerp(GRASS_NEAR, fade)
      this.grass.setColorAt(i, this.color)
    }
    this.grass.instanceMatrix.needsUpdate = true
    this.grass.instanceColor.needsUpdate = true

    const ox = Math.floor(px / TILE)
    const oz = Math.floor(pz / TILE)
    let ti = 0
    for (let iz = -TILE_HALF; iz <= TILE_HALF; iz++) {
      for (let ix = -TILE_HALF; ix <= TILE_HALF; ix++) {
        const x = (ox + ix) * TILE
        const z = (oz + iz) * TILE
        const dist = Math.hypot(x - px, z - pz)
        const fade = nearestLanternFade(x, z, px, pz, lit)
        this.paintTile(ti, x, z, fade, dist <= RADIUS ? 1 : 0)
        ti += 1
      }
    }

    // Bolts past the hero disk stamp the same lantern onto the ground around them.
    this.tileKeys.clear()
    for (let i = 0; i < lit.length; i++) {
      const lamp = lit[i]
      const reach = RADIUS * lamp.w
      const half = Math.ceil(reach / TILE)
      const lx = Math.floor(lamp.x / TILE)
      const lz = Math.floor(lamp.z / TILE)
      for (let iz = -half; iz <= half; iz++) {
        for (let ix = -half; ix <= half; ix++) {
          if (ti >= TILE_BUDGET) break
          const gx = lx + ix
          const gz = lz + iz
          const x = gx * TILE
          const z = gz * TILE
          if (Math.hypot(x - lamp.x, z - lamp.z) > reach) continue
          if (Math.hypot(x - px, z - pz) <= RADIUS) continue
          const key = (gx + TILE_KEY_BIAS) * TILE_KEY_STRIDE + (gz + TILE_KEY_BIAS)
          if (this.tileKeys.has(key)) continue
          this.tileKeys.add(key)
          const fade = nearestLanternFade(x, z, px, pz, lit)
          this.paintTile(ti, x, z, fade, 1)
          ti += 1
        }
      }
    }

    this.tiles.count = ti
    this.tiles.instanceMatrix.needsUpdate = true
    this.tiles.instanceColor.needsUpdate = true
  }

  paintTile(index, x, z, fade, scale) {
    this.dummy.position.set(x, groundHeight(x, z), z)
    groundNormal(x, z, this.normal)
    this.dummy.quaternion.setFromUnitVectors(this.up, this.normal)
    this.dummy.scale.setScalar(scale)
    this.dummy.updateMatrix()
    this.tiles.setMatrixAt(index, this.dummy.matrix)
    this.color.copy(TILE_FAR).lerp(TILE_NEAR, fade)
    this.tiles.setColorAt(index, this.color)
  }
}
