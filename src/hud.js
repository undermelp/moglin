export class Hud {
  constructor() {
    this.screen = document.getElementById('screen')
    this.prompt = document.getElementById('prompt')
    this.sub = document.getElementById('sub')
    this.stats = document.getElementById('stats')
    this.timeRun = document.getElementById('time-run')
    this.timeBest = document.getElementById('time-best')
    this.hud = document.getElementById('hud')
    this.announceEl = document.getElementById('announce')
    this.announceTitle = document.getElementById('announce-title')
    this.announceDesc = document.getElementById('announce-desc')
    this.perkCard = document.getElementById('perk-card')
    this.perkCardName = document.getElementById('perk-card-name')
    this.perkCardDesc = document.getElementById('perk-card-desc')
    this.perksEl = document.getElementById('perks')
    this.runPerksEl = document.getElementById('run-perks')
    this.waveEl = document.getElementById('wave')
    this.killsEl = document.getElementById('kills')
    this.levelEl = document.getElementById('level')
    this.xpEl = document.getElementById('xp')
    this.healthNum = document.getElementById('health-num')
    this.healthFill = document.getElementById('health-fill')
    this.health = document.getElementById('health')
    this.magEl = document.getElementById('mag')
    this.reserveEl = document.getElementById('reserve')
    this.weaponEl = document.getElementById('weapon')
    this.molotovEl = document.getElementById('molotov')
    this.molotovCount = document.getElementById('molotov-count')
    this.reloadEl = document.getElementById('reload-label')
    this.ammo = document.getElementById('ammo')
    this.hit = document.getElementById('hit')
    this.hurtEl = document.getElementById('hurt')
    this.announceTimer = 0
    this.perkTimer = 0
    this.hitTimer = 0
    this.hurtTimer = 0
    this.screenMode = ''
    this.menuBest = null
    this.deadKey = null
    this.last = {
      health: null,
      healthPct: null,
      low: null,
      mag: null,
      reserve: null,
      weapon: null,
      molotovs: null,
      molotovEmpty: null,
      wave: null,
      kills: null,
      level: null,
      xp: null,
      xpNeed: null,
      reloading: null,
      infinite: null,
    }
  }

  fillPerks(el, perks) {
    el.replaceChildren()
    for (let i = 0; i < perks.length; i++) {
      const perk = perks[i]
      const row = document.createElement('li')
      const name = document.createElement('span')
      name.className = 'perk-name'
      name.textContent = perk.count > 1 ? `${perk.name} ×${perk.count}` : perk.name
      const desc = document.createElement('span')
      desc.className = 'perk-desc'
      desc.textContent = perk.desc
      row.append(name, desc)
      el.appendChild(row)
    }
  }

  setPerks(perks) {
    this.fillPerks(this.perksEl, perks)
  }

  setSub(text) {
    if (this.sub) this.sub.textContent = text
  }

  showMenu(bestTime = '') {
    if (this.screenMode === 'menu' && this.menuBest === bestTime) return
    this.screenMode = 'menu'
    this.menuBest = bestTime
    this.deadKey = null
    this.screen.className = 'menu'
    this.prompt.textContent = 'Click to begin'
    this.setSub('A crossbow. Hold click. Arrows fall.')
    this.stats.textContent = bestTime && bestTime !== '0:00' ? `Best survival ${bestTime}` : ''
    this.runPerksEl.replaceChildren()
    this.hidePerk()
    this.hud.hidden = true
  }

  showPause() {
    if (this.screenMode === 'pause') return
    this.screenMode = 'pause'
    this.deadKey = null
    this.screen.className = 'pause'
    this.prompt.textContent = this.sub ? 'Paused' : 'Paused — click to resume'
    this.setSub('Click to resume')
    this.hud.hidden = false
  }

  showDead(wave, kills, level, perks, time = '', bestTime = '') {
    const key = `${wave}|${kills}|${level}|${time}|${bestTime}|${perks ? '1' : '0'}`
    if (this.screenMode === 'dead' && this.deadKey === key) return
    this.screenMode = 'dead'
    this.deadKey = key
    this.screen.className = 'dead'
    this.prompt.textContent = this.sub ? 'You died' : 'You died — press R to try again'
    this.setSub('Press R to try again')
    this.timeRun.textContent = time || '0:00'
    this.timeBest.textContent = bestTime || '0:00'
    this.stats.textContent = `wave ${wave}  ·  ${kills} kills  ·  level ${level}`
    if (perks) this.fillPerks(this.runPerksEl, perks)
    this.hidePerk()
    this.hud.hidden = true
  }

  hideScreen() {
    if (this.screenMode === 'hide') return
    this.screenMode = 'hide'
    this.deadKey = null
    this.screen.className = 'hide'
    this.hud.hidden = false
  }

  announce(text, detail = '') {
    this.announceTitle.textContent = text
    this.announceDesc.textContent = detail
    this.announceEl.classList.add('on')
    clearTimeout(this.announceTimer)
    this.announceTimer = setTimeout(() => this.announceEl.classList.remove('on'), detail ? 2400 : 1600)
  }

  showPerk(name, desc, count = 1) {
    this.perkCardName.textContent = count > 1 ? `${name} ×${count}` : name
    this.perkCardDesc.textContent = desc
    const card = this.perkCard
    card.classList.remove('on')
    void card.offsetWidth
    card.classList.add('on')
    clearTimeout(this.perkTimer)
    this.perkTimer = setTimeout(() => card.classList.remove('on'), 3400)
  }

  hidePerk() {
    clearTimeout(this.perkTimer)
    this.perkCard.classList.remove('on')
  }

  markHit(head) {
    this.hit.classList.toggle('head', head)
    this.hit.classList.remove('on')
    void this.hit.offsetWidth
    this.hit.classList.add('on')
    clearTimeout(this.hitTimer)
    this.hitTimer = setTimeout(() => this.hit.classList.remove('on'), 80)
  }

  hurt() {
    this.hurtEl.classList.remove('on')
    void this.hurtEl.offsetWidth
    this.hurtEl.classList.add('on')
    clearTimeout(this.hurtTimer)
    this.hurtTimer = setTimeout(() => this.hurtEl.classList.remove('on'), 70)
  }

  sync(state) {
    const health = Math.max(0, Math.round(state.health))
    const maxHealth = Math.max(1, state.maxHealth || 100)
    const healthPct = Math.min(100, (health / maxHealth) * 100)
    const low = health <= maxHealth * 0.3 && health > 0
    const molotovEmpty = state.molotovs <= 0
    const infinite = state.mag === '∞'
    const last = this.last

    if (last.health !== health) {
      last.health = health
      this.healthNum.textContent = String(health)
    }
    if (last.healthPct !== healthPct) {
      last.healthPct = healthPct
      this.healthFill.style.width = `${healthPct}%`
    }
    if (last.low !== low) {
      last.low = low
      this.health.classList.toggle('low', low)
    }
    if (last.mag !== state.mag) {
      last.mag = state.mag
      this.magEl.textContent = String(state.mag)
    }
    if (last.reserve !== state.reserve) {
      last.reserve = state.reserve
      this.reserveEl.textContent = String(state.reserve)
    }
    if (last.weapon !== state.weapon) {
      last.weapon = state.weapon
      this.weaponEl.textContent = state.weapon
    }
    if (last.molotovs !== state.molotovs) {
      last.molotovs = state.molotovs
      this.molotovCount.textContent = String(state.molotovs)
    }
    if (last.molotovEmpty !== molotovEmpty) {
      last.molotovEmpty = molotovEmpty
      this.molotovEl.classList.toggle('empty', molotovEmpty)
    }
    if (last.wave !== state.wave) {
      last.wave = state.wave
      this.waveEl.textContent = `WAVE ${state.wave}`
    }
    if (last.kills !== state.kills) {
      last.kills = state.kills
      this.killsEl.textContent = `${state.kills} KILLS`
    }
    if (last.level !== state.level) {
      last.level = state.level
      this.levelEl.textContent = `LV ${state.level}`
    }
    if (last.xp !== state.xp || last.xpNeed !== state.xpNeed) {
      last.xp = state.xp
      last.xpNeed = state.xpNeed
      this.xpEl.textContent = `${state.xp}/${state.xpNeed} XP`
    }
    if (last.reloading !== state.reloading) {
      last.reloading = state.reloading
      this.ammo.classList.toggle('reloading', state.reloading)
    }
    if (last.infinite !== infinite) {
      last.infinite = infinite
      this.ammo.classList.toggle('infinite', infinite)
    }
    this.reloadEl.textContent = ''
  }
}
