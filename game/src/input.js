export function createInput(canvas) {
  const held = Object.create(null);
  const edge = Object.create(null);
  const state = { pitch: 0, roll: 0, rudder: 0, throttle: 0, burner: false, gun: false, fire: false, flare: false, mouseX: 0, mouseY: 0, wheel: 0, clickGun: false, clickFire: false };
  let burnerToggle = false;
  const keyName = (e) => e.code;
  const down = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!held[keyName(e)]) edge[keyName(e)] = true;
    held[keyName(e)] = true;
  };
  const up = (e) => { held[keyName(e)] = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', (e) => { state.mouseX = e.movementX; state.mouseY = e.movementY; });
  canvas.addEventListener('wheel', (e) => { state.wheel += Math.sign(e.deltaY); }, { passive: true });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) state.clickGun = true; if (e.button === 2) state.clickFire = true; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    update(dt) {
      state.pitch = (held.KeyS || held.ArrowDown ? 1 : 0) - (held.KeyW || held.ArrowUp ? 1 : 0);
      state.roll = (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0);
      state.rudder = (held.KeyE ? 1 : 0) - (held.KeyQ ? 1 : 0);
      state.throttle = (held.ShiftLeft || held.ShiftRight ? 1 : 0) - (held.ControlLeft || held.ControlRight ? 1 : 0);
      state.burner = !!held.KeyX; state.gun = !!held.Space || state.clickGun; state.fire = !!held.KeyF || state.clickFire; state.flare = !!held.KeyZ;
      state.brake = !!held.KeyB; state.dt = dt;
      if (edge.KeyX) burnerToggle = !burnerToggle;
      state.burner = burnerToggle;
      state.pitchTrim = !!held.KeyT; state.trimPressed = !!edge.KeyT;
      state.gPressed = !!edge.KeyG; state.vPressed = !!edge.KeyV; state.cameraPressed = !!edge.KeyC;
      state.weaponPressed = !!edge.KeyR; state.startPressed = !!edge.Enter; state.pausePressed = !!edge.KeyP;
      state.helpPressed = !!edge.KeyH; state.objectivesPressed = !!edge.Tab; state.menuPressed = !!edge.Escape;
      state.navLeft = !!edge.ArrowLeft; state.navRight = !!edge.ArrowRight;
      state.digit = edge.Digit1 ? 0 : edge.Digit2 ? 1 : edge.Digit3 ? 2 : edge.Digit4 ? 3 : -1;
      state.volumeDown = !!edge.Minus; state.volumeUp = !!edge.Equal;
      state.mouseDown = !!(held.Mouse0 || state.clickGun); state.shiftHeld = !!held.ShiftLeft || !!held.ShiftRight;
      for (const k in edge) edge[k] = false;
      state.clickGun = false; state.clickFire = false; state.mouseX = 0; state.mouseY = 0; state.wheel = 0;
      return state;
    },
    held(code) { return !!held[code]; },
    dispose() { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); },
  };
}

