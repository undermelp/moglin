export function blocked(x, z, radius, blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const closestX = Math.max(block.minX, Math.min(x, block.maxX))
    const closestZ = Math.max(block.minZ, Math.min(z, block.maxZ))
    const dx = x - closestX
    const dz = z - closestZ
    if (dx * dx + dz * dz < radius * radius) return true
  }
  return false
}

function hitsCircle(x, z, radius, circles, ignore) {
  if (!circles) return false
  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i]
    if (circle.id === ignore) continue
    const dx = x - circle.x
    const dz = z - circle.z
    const min = radius + circle.r
    if (dx * dx + dz * dz < min * min) return true
  }
  return false
}

export function moveWithCollision(x, z, radius, dx, dz, blocks, circles, ignore, out) {
  let nextX = x + dx
  let nextZ = z + dz
  if (blocked(nextX, z, radius, blocks) || hitsCircle(nextX, z, radius, circles, ignore)) nextX = x
  if (blocked(nextX, nextZ, radius, blocks) || hitsCircle(nextX, nextZ, radius, circles, ignore)) nextZ = z
  out.x = nextX
  out.z = nextZ
  return out
}

/** Keep a circle inside a circular playable radius centered at origin. */
export function clampToRadius(x, z, radius, limit, out) {
  const max = limit - radius
  const r = Math.hypot(x, z)
  if (r <= max || r < 1e-6) {
    out.x = x
    out.z = z
    return out
  }
  const s = max / r
  out.x = x * s
  out.z = z * s
  return out
}
