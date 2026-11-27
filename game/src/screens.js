import { MISSIONS } from './missions.js';

function box(ctx, x, y, w, h, fill = 'rgba(12,20,20,.9)', stroke = 'rgba(188,197,154,.65)') {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
}
function label(ctx, value, x, y, size = 15, color = '#d7d0b7', align = 'left', bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
}
const controls = [
  ['W / S or Up / Down', 'Pitch down / up'], ['A / D or Left / Right', 'Roll left / right'], ['Q / E', 'Rudder left / right'], ['Shift / Ctrl', 'Throttle up / down'],
  ['X', 'Afterburner detent'], ['Space / LMB', 'Fire cannon'], ['F / RMB', 'Fire locked missile'], ['R', 'Cycle gun / missile / bomb'],
  ['G', 'Landing gear'], ['V', 'Flaps'], ['B', 'Airbrake'], ['T', 'Trim toward stick'],
  ['C', 'Chase / cockpit / cinematic'], ['Mouse / wheel', 'Look / zoom'], ['Z', 'Flares'], ['Enter / P / H / Tab / Esc', 'Start / pause / help / objectives / menu'],
  ['- / +', 'Volume down / up'],
  ['Tab', 'Objectives'],
];

export function createScreens(canvas) {
  const ctx = canvas.getContext('2d'); let view = 'title', selected = 0, help = false, objectives = false, report = null;
  const setView = (name, data = null) => { view = name; if (name === 'after') report = data; if (name !== 'flight' && name !== 'pause') { help = false; objectives = false; } };
  return {
    get view() { return view; }, get selected() { return selected; }, setView,
    update(input, mission) {
      const actions = [];
      if (view === 'title') {
        if (input.digit >= 0) selected = input.digit;
        if (input.navLeft) selected = (selected + MISSIONS.length - 1) % MISSIONS.length;
        if (input.navRight) selected = (selected + 1) % MISSIONS.length;
        if (input.startPressed) { view = 'briefing'; actions.push({ type: 'brief', mission: MISSIONS[selected] }); }
      } else if (view === 'briefing') {
        if (input.startPressed) { view = 'flight'; actions.push({ type: 'start', mission: MISSIONS[selected] }); }
        if (input.menuPressed) view = 'title';
      } else if (view === 'flight') {
        if (input.pausePressed) view = 'pause';
        if (input.helpPressed) help = !help;
        if (input.objectivesPressed) objectives = !objectives;
        if (input.menuPressed) { view = 'title'; actions.push({ type: 'menu' }); }
      } else if (view === 'pause') {
        if (input.pausePressed || input.startPressed) view = 'flight';
        if (input.helpPressed) help = !help;
        if (input.menuPressed) { view = 'title'; actions.push({ type: 'menu' }); }
      } else if (view === 'after') {
        if (input.startPressed) { view = 'title'; actions.push({ type: 'menu' }); }
        if (input.menuPressed) view = 'title';
      }
      return actions;
    },
    showAfter(data) { report = data; view = 'after'; },
    draw(width, height, missionData) {
      ctx.clearRect(0, 0, width, height);
      if (view === 'flight' && !help && !objectives) return;
      if (view === 'title') {
        ctx.fillStyle = 'rgba(9,16,17,.73)'; ctx.fillRect(0, 0, width, height);
        label(ctx, 'KESTREL REACH', width * 0.08, height * 0.105, 42, '#e3d4a8', 'left', true);
        label(ctx, 'A SORTIE OVER THE CINDER COAST', width * 0.083, height * 0.16, 17, '#caa56e');
        label(ctx, 'SELECT A SORTIE', width * 0.08, height * 0.245, 13, '#aebf88', 'left', true);
        MISSIONS.forEach((m, index) => {
          const y = height * 0.295 + index * 52, active = index === selected;
          box(ctx, width * 0.08, y, width * 0.35, 42, active ? 'rgba(106,91,57,.58)' : 'rgba(14,24,23,.68)', active ? '#e6bd70' : 'rgba(188,197,154,.4)');
          label(ctx, `${index + 1}  ${m.name}`, width * 0.1, y + 15, 15, active ? '#f0d28f' : '#c8c8b1', 'left', active);
          label(ctx, m.subtitle, width * 0.1, y + 31, 10, '#9ead8d');
        });
        label(ctx, 'CONTROLS', width * 0.51, height * 0.245, 13, '#aebf88', 'left', true);
        controls.forEach((c, i) => { const col = i < 9 ? 0 : 1, row = i < 9 ? i : i - 9; const x = width * (col ? 0.775 : 0.5); const y = height * 0.29 + row * 30; label(ctx, c[0], x, y, 10, '#e0c27c'); label(ctx, c[1], x, y + 13, 10, '#b5bdac'); });
        label(ctx, 'ENTER BRIEFING    LEFT / RIGHT OR 1-4 SELECT', width * 0.08, height * 0.645, 11, '#e6c87e', 'left', true);
        label(ctx, 'VANE FIELD  /  PORT ANVIL  /  THE NARROWS  /  BLIND MESA  /  SALT FLATS  /  CINDER RIDGE', width * 0.5, height * 0.94, 10, '#b3ad94', 'center');
        return;
      }
      if (view === 'briefing') {
        ctx.fillStyle = 'rgba(8,14,15,.78)'; ctx.fillRect(0, 0, width, height);
        const m = MISSIONS[selected]; box(ctx, width * 0.19, height * 0.22, width * 0.62, height * 0.56, 'rgba(17,27,25,.95)', '#d1b878');
        label(ctx, 'MISSION BRIEF', width * 0.23, height * 0.29, 13, '#aebf88', 'left', true);
        label(ctx, m.name.toUpperCase(), width * 0.23, height * 0.37, 30, '#ead7a9', 'left', true);
        label(ctx, m.subtitle, width * 0.23, height * 0.425, 15, '#d19c60');
        const words = m.brief.split(' '); let lineText = '', y = height * 0.51;
        for (const word of words) { if ((lineText + word).length > 58) { label(ctx, lineText, width * 0.23, y, 15, '#c4ccb8'); y += 27; lineText = ''; } lineText += `${word} `; }
        label(ctx, lineText, width * 0.23, y, 15, '#c4ccb8');
        label(ctx, 'ENTER  LAUNCH    ESC  BACK', width * 0.23, height * 0.71, 12, '#e5bd70', 'left', true);
        return;
      }
      if (view === 'after') {
        ctx.fillStyle = 'rgba(8,14,15,.85)'; ctx.fillRect(0, 0, width, height);
        box(ctx, width * 0.31, height * 0.15, width * 0.38, height * 0.7, 'rgba(17,27,25,.96)', '#d1b878');
        label(ctx, report && report.reason ? 'SORTIE LOST' : 'AFTER ACTION', width / 2, height * 0.22, 15, '#e2c27e', 'center', true);
        label(ctx, report ? report.grade : 'D', width / 2, height * 0.34, 66, '#ead7a9', 'center', true);
        label(ctx, `TOTAL  ${report ? report.total : 0}`, width / 2, height * 0.43, 19, '#c4ccb8', 'center', true);
        const rows = report ? [['Objectives', report.objectivePoints], ['Time bonus', report.timeBonus], ['Munitions', report.munitions], ['Damage', -report.damage], ['Landing', report.landing]] : [];
        rows.forEach((r, i) => { const y = height * 0.51 + i * 27; label(ctx, r[0], width * 0.37, y, 13, '#b9c1ae'); label(ctx, `${r[1] >= 0 ? '+' : ''}${r[1]}`, width * 0.63, y, 13, '#dfc37e', 'right'); });
        if (report && report.reason) label(ctx, report.reason, width / 2, height * 0.72, 12, '#df8064', 'center', true);
        label(ctx, 'ENTER  RETURN TO FLIGHT LINE', width / 2, height * 0.79, 12, '#e5bd70', 'center', true); return;
      }
      if (view === 'pause') {
        ctx.fillStyle = 'rgba(6,12,13,.68)'; ctx.fillRect(0, 0, width, height);
        box(ctx, width * 0.36, height * 0.38, width * 0.28, height * 0.2, 'rgba(16,27,25,.94)', '#d1b878');
        label(ctx, 'SORTIE PAUSED', width / 2, height * 0.44, 21, '#ead7a9', 'center', true);
        label(ctx, 'P / ENTER RESUME     ESC MENU', width / 2, height * 0.51, 12, '#c3c9b4', 'center');
      }
      if (help || objectives) {
        const w = width * 0.62, h = height * (help ? 0.69 : 0.22), x = width * 0.19, y = help ? height * 0.15 : height * 0.34;
        box(ctx, x, y, w, h, 'rgba(10,18,18,.92)', '#d1b878');
        label(ctx, help ? 'FLIGHT CONTROLS' : 'SORTIE OBJECTIVES', x + 22, y + 24, 15, '#e5bd70', 'left', true);
        if (help) controls.forEach((c, i) => { const col = i < 9 ? 0 : 1, row = i < 9 ? i : i - 9; label(ctx, `${c[0]}  ${c[1]}`, x + 24 + col * w * 0.49, y + 58 + row * 29, 11, '#c7cebd'); });
        else if (missionData) { label(ctx, missionData.current.name, x + 24, y + 62, 14, '#d9d4bd', 'left', true); label(ctx, missionData.objective, x + 24, y + 88, 12, '#b8c98e'); }
        label(ctx, help ? 'H CLOSE' : 'TAB CLOSE', x + w - 20, y + h - 20, 10, '#dfbd76', 'right');
      }
    },
  };
}

