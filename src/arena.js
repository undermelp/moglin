import * as THREE from 'three'

/** Playable radius from valley center (player / cover). */
export const ARENA_RADIUS = 440

const BOWL_RADIUS = 800
const BOWL_RISE = 280
const MESH_SIZE = 1840
const MESH_SEGS = 48
const BOWL_SINK = 0.85

/** Ground height of the valley bowl at world XZ. */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  const t = Math.min(1, r / BOWL_RADIUS)
  // Quadratic rise: flat floor near center, gradual slopes outward.
  return BOWL_RISE * t * t
}

/** Unit surface normal of the bowl heightfield into `target`. */
export function groundNormal(x, z, target) {
  const r = Math.hypot(x, z)
  if (r >= BOWL_RADIUS) return target.set(0, 1, 0)
  const k = (2 * BOWL_RISE) / (BOWL_RADIUS * BOWL_RADIUS)
  return target.set(-k * x, 1, -k * z).normalize()
}

function addMesh(scene, aim, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  scene.add(mesh)
  aim.push(mesh)
  return mesh
}

function makeBowlFloor(material) {
  const geo = new THREE.PlaneGeometry(MESH_SIZE, MESH_SIZE, MESH_SEGS, MESH_SEGS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)))
  }
  pos.needsUpdate = true
  return new THREE.Mesh(geo, material)
}

export class Arena {
  constructor(scene) {
    this.blocks = []
    this.aim = []
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a5a58, roughness: 0.82, metalness: 0.04 })
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3e4650, roughness: 0.86, metalness: 0.05 })
    // Dark ground: bowl shape is implied; lantern grass paints the lit radius.
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x050706 })

    const floor = makeBowlFloor(floorMat)
    floor.position.y = -BOWL_SINK
    scene.add(floor)
    this.aim.push(floor)

    this.crate(scene, -180, 100, 2.2, 1.4, 1.15, crateMat)
    this.crate(scene, -80, -160, 1.6, 1.6, 1.1, crateMat)
    this.crate(scene, 120, 140, 2.4, 1.5, 1.25, crateMat)
    this.crate(scene, 220, -120, 1.5, 1.5, 1.15, crateMat)
    this.crate(scene, -140, -60, 1.8, 1.2, 1.1, crateMat)
    this.crate(scene, 160, 40, 1.3, 2, 1.2, crateMat)

    // Rock outcrops on the mid-slope as distance landmarks.
    for (const [x, z, s] of [
      [360, 200, 28],
      [-320, 280, 32],
      [280, -340, 26],
      [-380, -160, 30],
      [120, 400, 24],
      [-200, -380, 29],
    ]) {
      const h = 36 + s * 0.6
      this.addSolid(scene, x, groundHeight(x, z) + h / 2, z, s, h, s, rockMat)
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.68, 64),
      new THREE.MeshBasicMaterial({ color: 0xb85a32, side: THREE.DoubleSide }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = groundHeight(0, 0) + 0.02
    scene.add(ring)

    // Dim ambient so far objects read as silhouettes; player lamp lights nearby cover.
    scene.add(new THREE.HemisphereLight(0x6a8498, 0x0a1010, 0.22))
    const sun = new THREE.DirectionalLight(0x8aa8c8, 0.18)
    sun.position.set(-320, 120, 80)
    scene.add(sun)
  }

  addSolid(scene, x, y, z, w, h, d, material) {
    addMesh(scene, this.aim, x, y, z, w, h, d, material)
    this.blocks.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    })
  }

  crate(scene, x, z, w, d, h, material) {
    this.addSolid(scene, x, groundHeight(x, z) + h / 2, z, w, h, d, material)
  }
}
