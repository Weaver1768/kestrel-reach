export function createAudio() {
  let ctx = null, master = null, engineGain = null, engineFilter = null, noiseGain = null, windGain = null, burnerGain = null, musicGain = null, volume = 0.55, started = false;
  const active = [];
  const makeNoise = (context, seconds = 2) => {
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate), data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + 0.018 * (Math.random() * 2 - 1)) / 1.018; data[i] = last * 3.5; }
    const src = context.createBufferSource(); src.buffer = buffer; src.loop = true; return src;
  };
  const start = () => {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    ctx = new Ctx(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0001; engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 700; engineFilter.connect(engineGain); engineGain.connect(master);
    for (const detune of [-7, 6]) { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.detune.value = detune; osc.frequency.value = 75; osc.connect(engineFilter); osc.start(); }
    const n = makeNoise(ctx, 2), nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 480; noiseGain = ctx.createGain(); noiseGain.gain.value = 0.02; n.connect(nf); nf.connect(noiseGain); noiseGain.connect(master); n.start();
    windGain = ctx.createGain(); windGain.gain.value = 0.0001; const wn = makeNoise(ctx, 2), wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 850; wn.connect(wf); wf.connect(windGain); windGain.connect(master); wn.start();
    burnerGain = ctx.createGain(); burnerGain.gain.value = 0.0001; const bn = makeNoise(ctx, 2), bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 1300; bn.connect(bf); bf.connect(burnerGain); burnerGain.connect(master); bn.start();
    musicGain = ctx.createGain(); musicGain.gain.value = 0.018; musicGain.connect(master);
    for (const freq of [110, 164.81, 220]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = Math.random() * 5 - 2.5; g.gain.value = 0.24; o.connect(g); g.connect(musicGain); o.start(); active.push(o, g); }
    started = true;
  };
  const play = (kind) => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (kind === 'gun') {
      const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(104, now); osc.frequency.exponentialRampToValueAtTime(48, now + 0.055); g.gain.setValueAtTime(0.13, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.065); osc.connect(g); g.connect(master); osc.start(); osc.stop(now + 0.07);
    } else if (kind === 'launch') {
      const n = makeNoise(ctx, 1), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(2100, now); f.frequency.exponentialRampToValueAtTime(300, now + 0.7); g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.8); n.loop = false; n.connect(f); f.connect(g); g.connect(master); n.start(); n.stop(now + 0.82);
    } else if (kind === 'explosion') {
      const n = makeNoise(ctx, 1), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, now); f.frequency.exponentialRampToValueAtTime(90, now + 1.2); g.gain.setValueAtTime(0.38, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.35); n.loop = false; n.connect(f); f.connect(g); g.connect(master); n.start(); n.stop(now + 1.4);
    } else if (kind === 'lock' || kind === 'warning') {
      const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = kind === 'lock' ? 880 : 520; g.gain.setValueAtTime(0.001, now); g.gain.linearRampToValueAtTime(0.15, now + 0.02); g.gain.setValueAtTime(0.15, now + 0.16); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22); osc.connect(g); g.connect(master); osc.start(); osc.stop(now + 0.23);
    } else if (kind === 'servo' || kind === 'touchdown') {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = kind === 'servo' ? 230 : 640; g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'servo' ? 0.17 : 0.28)); o.connect(g); g.connect(master); o.start(); o.stop(now + 0.3);
    }
  };
  return {
    start, play,
    update(state) {
      if (!started || !ctx) return;
      const speed = state.velocity.length(), rpm = 0.6 + state.throttle * 0.85;
      engineFilter.frequency.setTargetAtTime(270 + rpm * 740, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + rpm * 0.14, ctx.currentTime, 0.12);
      noiseGain.gain.setTargetAtTime(0.018 + speed / 1800, ctx.currentTime, 0.16);
      windGain.gain.setTargetAtTime(Math.min(0.2, speed * speed / 180000), ctx.currentTime, 0.18);
      burnerGain.gain.setTargetAtTime(state.afterburner ? 0.16 : 0.0001, ctx.currentTime, 0.13);
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
    },
    adjust(delta) { volume = Math.max(0, Math.min(1, volume + delta)); return volume; },
    get volume() { return volume; },
    dispose() { if (ctx) ctx.close(); },
  };
}

