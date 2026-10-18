const XP_PER_GEM = 100
const FIRST_LEVEL_XP = 700

export class Progress {
  constructor() {
    this.xp = 0
    this.level = 0
    this.need = FIRST_LEVEL_XP
  }

  reset() {
    this.xp = 0
    this.level = 0
    this.need = FIRST_LEVEL_XP
  }

  addGems(count, xpMult = 1) {
    this.xp += count * XP_PER_GEM * xpMult
    let gained = 0
    while (this.xp >= this.need) {
      this.xp -= this.need
      this.level += 1
      gained += 1
      this.need = FIRST_LEVEL_XP * (this.level + 1)
    }
    return gained
  }
}
