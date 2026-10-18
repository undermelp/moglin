const POOL = [
  {
    id: 'vitality',
    name: 'VITALITY',
    desc: '+25 max health and heal 25',
    apply(player) {
      player.maxHealth += 25
      player.health = Math.min(player.maxHealth, player.health + 25)
    },
  },
  {
    id: 'fortitude',
    name: 'FORTITUDE',
    desc: '+40 max health and heal 20',
    apply(player) {
      player.maxHealth += 40
      player.health = Math.min(player.maxHealth, player.health + 20)
    },
  },
  {
    id: 'might',
    name: 'MIGHT',
    desc: '+15% weapon damage',
    apply(player) {
      player.damageMult *= 1.15
    },
  },
  {
    id: 'savagery',
    name: 'SAVAGERY',
    desc: '+25% weapon damage',
    apply(player) {
      player.damageMult *= 1.25
    },
  },
  {
    id: 'swift',
    name: 'SWIFT',
    desc: '+12% move speed',
    apply(player) {
      player.moveMult *= 1.12
    },
  },
  {
    id: 'haste',
    name: 'HASTE',
    desc: '+18% move speed',
    apply(player) {
      player.moveMult *= 1.18
    },
  },
  {
    id: 'quickLoad',
    name: 'QUICK LOAD',
    desc: '+22% fire rate',
    apply(player) {
      player.fireRateMult *= 1.22
    },
  },
  {
    id: 'rapidFire',
    name: 'RAPID FIRE',
    desc: '+16% fire rate',
    apply(player) {
      player.fireRateMult *= 1.16
    },
  },
  {
    id: 'brutalSwing',
    name: 'BRUTAL SWING',
    desc: '+50% melee damage',
    apply(player) {
      player.meleeMult *= 1.5
    },
  },
  {
    id: 'cleaver',
    name: 'CLEAVER',
    desc: '+20% melee damage, +15% melee range',
    apply(player) {
      player.meleeMult *= 1.2
      player.meleeRangeMult *= 1.15
    },
  },
  {
    id: 'secondWind',
    name: 'SECOND WIND',
    desc: '+45% health regen',
    apply(player) {
      player.regenMult *= 1.45
    },
  },
  {
    id: 'thickSkin',
    name: 'THICK SKIN',
    desc: 'Take 12% less damage',
    apply(player) {
      player.armor = Math.min(0.55, player.armor + 0.12)
    },
  },
  {
    id: 'sprinter',
    name: 'SPRINTER',
    desc: '+18% slide speed',
    apply(player) {
      player.slideMult *= 1.18
    },
  },
  {
    id: 'leap',
    name: 'LEAP',
    desc: '+22% jump height',
    apply(player) {
      player.jumpMult *= 1.22
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET',
    desc: 'Pull gems from farther away',
    apply(player) {
      player.magnetMult *= 1.35
    },
  },
  {
    id: 'deadeye',
    name: 'DEADEYE',
    desc: 'Headshots hit much harder',
    apply(player) {
      player.headBonus += 0.45
    },
  },
  {
    id: 'hotBolts',
    name: 'HOT BOLTS',
    desc: '+22% projectile speed',
    apply(player) {
      player.arrowSpeedMult *= 1.22
    },
  },
  {
    id: 'impact',
    name: 'IMPACT',
    desc: '+35% knockback',
    apply(player) {
      player.knockMult *= 1.35
    },
  },
  {
    id: 'bloodlust',
    name: 'BLOODLUST',
    desc: 'Heal 8 on every kill',
    apply(player) {
      player.lifesteal += 8
    },
  },
  {
    id: 'greed',
    name: 'GREED',
    desc: '+25% XP from gems',
    apply(player) {
      player.xpMult *= 1.25
    },
  },
  {
    id: 'wideArc',
    name: 'WIDE ARC',
    desc: 'Melee hits a wider cone',
    apply(player) {
      player.meleeArcMult *= 1.2
    },
  },
  {
    id: 'kindling',
    name: 'KINDLING',
    desc: '20% chance to ignite enemies on hit',
    apply(player) {
      player.igniteChance += 0.2
    },
  },
  {
    id: 'storm',
    name: 'STORM',
    desc: 'Lightning strikes a nearby moglin every 4s',
    apply(player) {
      player.lightning += 1
    },
  },
]

export function rollPerk() {
  return POOL[Math.floor(Math.random() * POOL.length)]
}
