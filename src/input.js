export class Input {
  constructor(dom) {
    this.dom = dom
    this.keys = new Set()
    this.dx = 0
    this.dy = 0
    this.fireEdge = false
    this.fireHeld = false
    this.reloadEdge = false
    this.slideEdge = false
    this.jumpEdge = false
    this.meleeEdge = false
    this.throwEdge = false
    this.locked = false
    this.frame = {
      dx: 0,
      dy: 0,
      fire: false,
      fireHeld: false,
      reload: false,
      slide: false,
      jump: false,
      melee: false,
      throw: false,
      locked: false,
      keys: this.keys,
    }

    this.onKeyDown = (event) => {
      if (event.code === 'Space') event.preventDefault()
      if (event.repeat) return
      this.keys.add(event.code)
      if (event.code === 'KeyR') this.reloadEdge = true
      if (document.pointerLockElement !== dom) return
      if (event.code === 'KeyF') this.throwEdge = true
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.slideEdge = true
      if (event.code === 'Space') this.jumpEdge = true
    }

    this.onKeyUp = (event) => {
      this.keys.delete(event.code)
    }

    this.onMouseDown = (event) => {
      if (event.button === 2) event.preventDefault()
      if (document.pointerLockElement !== dom) return
      if (event.button === 0) {
        this.fireEdge = true
        this.fireHeld = true
      } else if (event.button === 2) {
        this.meleeEdge = true
      }
    }

    this.onMouseUp = (event) => {
      if (event.button !== 0) return
      this.fireHeld = false
    }

    this.onMouseMove = (event) => {
      if (document.pointerLockElement !== dom) return
      this.dx += event.movementX
      this.dy += event.movementY
    }

    this.onLockChange = () => {
      this.locked = document.pointerLockElement === dom
      if (!this.locked) {
        this.keys.clear()
        this.fireHeld = false
        this.meleeEdge = false
        this.throwEdge = false
      }
    }

    this.onBlur = () => {
      this.keys.clear()
      this.fireHeld = false
      this.meleeEdge = false
      this.throwEdge = false
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    dom.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('pointerlockchange', this.onLockChange)
    dom.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  consume() {
    const frame = this.frame
    frame.dx = this.dx
    frame.dy = this.dy
    frame.fire = this.fireEdge
    frame.fireHeld = this.fireHeld && this.locked
    frame.reload = this.reloadEdge
    frame.slide = this.slideEdge
    frame.jump = this.jumpEdge
    frame.melee = this.meleeEdge
    frame.throw = this.throwEdge
    frame.locked = this.locked
    frame.keys = this.keys
    this.dx = 0
    this.dy = 0
    this.fireEdge = false
    this.reloadEdge = false
    this.slideEdge = false
    this.jumpEdge = false
    this.meleeEdge = false
    this.throwEdge = false
    return frame
  }
}
