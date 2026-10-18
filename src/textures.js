import * as THREE from 'three'

const W = 256
const H = 512

const VARIANTS = [
  {
    skin: '#8fd63a',
    skinShade: '#6aad28',
    skinDark: '#4f8a1c',
    hair: '#c43c2e',
    sweater: '#8e8e8e',
    sweaterLight: '#b4b4b4',
    cuff: '#5a5a5a',
    pants: '#f4f4f4',
    shoe: '#3f3f3f',
    line: '#1a1a1a',
    bulk: 0,
  },
  {
    skin: '#7bcf4a',
    skinShade: '#5aa832',
    skinDark: '#3f7a22',
    hair: '#a83228',
    sweater: '#7a8894',
    sweaterLight: '#a8b4be',
    cuff: '#4a5560',
    pants: '#ececec',
    shoe: '#2e2e2e',
    line: '#141414',
    bulk: -6,
  },
  {
    skin: '#a8e04a',
    skinShade: '#7ab828',
    skinDark: '#5a9018',
    hair: '#d4542a',
    sweater: '#9a9088',
    sweaterLight: '#c0b8b0',
    cuff: '#5e5650',
    pants: '#f8f8f8',
    shoe: '#454545',
    line: '#181818',
    bulk: 8,
  },
]

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeatX !== 1 || repeatY !== 1) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
  }
  return texture
}

function drawWigglePattern(ctx, x, y, w, h, color, seed) {
  const rng = mulberry32(seed)
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = 4.5
  const count = Math.max(8, ((w * h) / 220) | 0)
  for (let i = 0; i < count; i++) {
    const px = x + 4 + rng() * (w - 8)
    const py = y + 6 + rng() * (h - 12)
    const len = 10 + rng() * 14
    const ang = rng() * Math.PI * 2
    const bend = (rng() - 0.5) * 10
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.quadraticCurveTo(
      px + Math.cos(ang) * len * 0.5 + Math.cos(ang + 1.2) * bend,
      py + Math.sin(ang) * len * 0.5 + Math.sin(ang + 1.2) * bend,
      px + Math.cos(ang) * len,
      py + Math.sin(ang) * len,
    )
    ctx.stroke()
  }
}

function pathRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, w, h, r) {
  pathRoundRect(ctx, x, y, w, h, r)
  ctx.fill()
}

function drawSleeve(ctx, variant, seed, x, y, swing) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(swing * (Math.PI / 180))
  ctx.fillStyle = variant.sweater
  fillRoundRect(ctx, -11, 0, 22, 88, 9)
  ctx.save()
  pathRoundRect(ctx, -11, 0, 22, 68, 9)
  ctx.clip()
  drawWigglePattern(ctx, -11, 0, 22, 68, variant.sweaterLight, seed)
  ctx.restore()
  ctx.fillStyle = variant.cuff
  fillRoundRect(ctx, -11, 68, 22, 14, 3)
  ctx.fillStyle = variant.skin
  ctx.beginPath()
  ctx.ellipse(0, 90, 13, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawEnemy(frame, variant, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const bulk = variant.bulk
  const cx = 128
  const legSpread = frame === 0 ? 18 : -18
  const armSwing = frame === 0 ? 8 : -8

  // Big head on a short body — matches the reference silhouette.
  const headY = 155
  const headRx = 88 + bulk * 0.45
  const headRy = 105
  const bodyTop = 268
  const bodyH = 78
  const bodyW = 58 + bulk * 0.35
  const legTop = 338
  const legH = 88

  // Legs / pants
  ctx.fillStyle = variant.pants
  fillRoundRect(ctx, cx - 26 + legSpread * 0.2, legTop, 22, legH, 7)
  fillRoundRect(ctx, cx + 4 - legSpread * 0.2, legTop, 22, legH, 7)

  // Shoes
  ctx.fillStyle = variant.shoe
  fillRoundRect(ctx, cx - 30 + legSpread * 0.25, legTop + legH - 8, 30, 18, 4)
  fillRoundRect(ctx, cx + 2 - legSpread * 0.25, legTop + legH - 8, 30, 18, 4)

  // Torso sweater
  ctx.fillStyle = variant.sweater
  fillRoundRect(ctx, cx - bodyW * 0.5, bodyTop, bodyW, bodyH, 14)
  ctx.save()
  pathRoundRect(ctx, cx - bodyW * 0.5, bodyTop, bodyW, bodyH, 14)
  ctx.clip()
  drawWigglePattern(ctx, cx - bodyW * 0.5, bodyTop, bodyW, bodyH, variant.sweaterLight, seed)
  ctx.restore()

  // Head — wide dome tapering to a thin chin
  ctx.fillStyle = variant.skin
  ctx.beginPath()
  ctx.moveTo(cx, headY - headRy)
  ctx.bezierCurveTo(
    cx + headRx * 1.08,
    headY - headRy,
    cx + headRx * 1.02,
    headY + headRy * 0.05,
    cx + headRx * 0.55,
    headY + headRy * 0.55,
  )
  ctx.quadraticCurveTo(cx + headRx * 0.28, headY + headRy * 0.88, cx, headY + headRy * 1.08)
  ctx.quadraticCurveTo(cx - headRx * 0.28, headY + headRy * 0.88, cx - headRx * 0.55, headY + headRy * 0.55)
  ctx.bezierCurveTo(
    cx - headRx * 1.02,
    headY + headRy * 0.05,
    cx - headRx * 1.08,
    headY - headRy,
    cx,
    headY - headRy,
  )
  ctx.fill()

  // Ears (horizontal elf tips)
  ctx.fillStyle = variant.skin
  ctx.beginPath()
  ctx.moveTo(cx - headRx * 0.82, headY - 4)
  ctx.lineTo(cx - headRx - 28, headY - 14)
  ctx.lineTo(cx - headRx * 0.78, headY + 28)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + headRx * 0.82, headY - 4)
  ctx.lineTo(cx + headRx + 28, headY - 14)
  ctx.lineTo(cx + headRx * 0.78, headY + 28)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = variant.skinShade
  ctx.beginPath()
  ctx.moveTo(cx - headRx * 0.8, headY + 2)
  ctx.lineTo(cx - headRx - 12, headY - 4)
  ctx.lineTo(cx - headRx * 0.78, headY + 18)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + headRx * 0.8, headY + 2)
  ctx.lineTo(cx + headRx + 12, headY - 4)
  ctx.lineTo(cx + headRx * 0.78, headY + 18)
  ctx.closePath()
  ctx.fill()

  // Three hairs popping from the crown center
  const hairRootX = cx
  const hairRootY = headY - headRy + 10
  ctx.strokeStyle = variant.hair
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const hairs = [
    [-10, -34, -16, -22],
    [1, -42, 0, -24],
    [12, -34, 16, -22],
  ]
  for (const [tipX, tipY, midX, midY] of hairs) {
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.moveTo(hairRootX, hairRootY)
    ctx.quadraticCurveTo(hairRootX + midX, hairRootY + midY, hairRootX + tipX, hairRootY + tipY)
    ctx.stroke()
  }

  // Eye sockets
  const eyeX = 46
  const eyeY = headY + 14
  ctx.fillStyle = variant.skinDark
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.ellipse(cx - eyeX, eyeY, 15, 13, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + eyeX, eyeY, 15, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Eyes
  ctx.fillStyle = variant.line
  ctx.beginPath()
  ctx.ellipse(cx - eyeX, eyeY, 4.5, 3.8, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + eyeX, eyeY, 4.5, 3.8, 0, 0, Math.PI * 2)
  ctx.fill()

  // Eyebrows — high on the forehead
  const browY = headY - 28
  ctx.strokeStyle = variant.line
  ctx.lineWidth = 3.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - eyeX - 14, browY)
  ctx.quadraticCurveTo(cx - eyeX, browY - 16, cx - eyeX + 16, browY + 2)
  ctx.moveTo(cx + eyeX - 16, browY + 2)
  ctx.quadraticCurveTo(cx + eyeX, browY - 16, cx + eyeX + 14, browY)
  ctx.stroke()

  // Forehead wrinkles
  ctx.strokeStyle = variant.skinDark
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.45
  ctx.beginPath()
  ctx.moveTo(cx - 22, headY - 52)
  ctx.quadraticCurveTo(cx - 6, headY - 47, cx + 10, headY - 54)
  ctx.moveTo(cx - 18, headY - 64)
  ctx.quadraticCurveTo(cx, headY - 59, cx + 16, headY - 66)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Nose — bulbous hook, set lower on the face
  ctx.strokeStyle = variant.line
  ctx.lineWidth = 4.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + 2, headY + 12)
  ctx.lineTo(cx + 2, headY + 40)
  ctx.quadraticCurveTo(cx + 20, headY + 52, cx + 17, headY + 34)
  ctx.stroke()

  // Open mouth + peeking tooth
  const mouthY = headY + 56
  ctx.fillStyle = variant.line
  ctx.beginPath()
  ctx.moveTo(cx - 18, mouthY)
  ctx.quadraticCurveTo(cx + 4, mouthY + 4, cx + 28, mouthY - 6)
  ctx.quadraticCurveTo(cx + 6, mouthY + 28, cx - 18, mouthY)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(cx + 8, mouthY, 9, 14)
  ctx.strokeStyle = variant.line
  ctx.lineWidth = 2.2
  ctx.strokeRect(cx + 8, mouthY, 9, 14)

  // Arms in front of the body, hanging at the sides
  drawSleeve(ctx, variant, seed + 3, cx - bodyW * 0.5 - 14, bodyTop + 8, -4 + armSwing)
  drawSleeve(ctx, variant, seed + 9, cx + bodyW * 0.5 + 14, bodyTop + 8, 4 - armSwing)

  const texture = canvasTexture(canvas)
  texture.userData.alpha = ctx.getImageData(0, 0, W, H)
  return texture
}

function drawGrass() {
  const w = 64
  const h = 96
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const rng = mulberry32(42)
  for (let i = 0; i < 14; i++) {
    const x = 8 + rng() * (w - 16)
    const tip = 6 + rng() * 28
    const lean = (rng() - 0.5) * 18
    const mid = 0.35 + rng() * 0.25
    ctx.strokeStyle = rng() > 0.4 ? 'rgba(120, 168, 110, 0.95)' : 'rgba(78, 120, 86, 0.9)'
    ctx.lineWidth = 1.4 + rng() * 1.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.quadraticCurveTo(x + lean * mid, h * (0.45 + rng() * 0.15), x + lean, tip)
    ctx.stroke()
  }
  return canvasTexture(canvas)
}

function drawGround() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3a5244'
  ctx.fillRect(0, 0, size, size)
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  const rng = mulberry32(7)
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 28
    const blade = rng() * 18
    data[i] = Math.max(0, Math.min(255, 52 + n * 0.5 + blade * 0.12))
    data[i + 1] = Math.max(0, Math.min(255, 78 + n + blade * 0.8))
    data[i + 2] = Math.max(0, Math.min(255, 62 + n * 0.65 + blade * 0.3))
  }
  ctx.putImageData(image, 0, 0)
  return canvasTexture(canvas)
}

export function createTextures() {
  const enemyFrames = VARIANTS.map((variant, index) => [
    drawEnemy(0, variant, 1000 + index * 17),
    drawEnemy(1, variant, 1000 + index * 17),
  ])
  return {
    grass: drawGrass(),
    ground: drawGround(),
    enemyFrames,
  }
}
