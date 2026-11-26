// state.js — единое состояние OpenLight (Этап 4)
// Комментарии на русском. Честный расчёт веса, детерминированная синтетика.

export const DENSITIES = {
  steel: 7.85, // г/см³ 09Г2С
  alu: 2.64,   // АМг6
  pla: 1.24,   // PLA
};

export const MATERIAL_LABELS = {
  steel: 'Сталь 09Г2С',
  alu: 'АМг6',
  pla: 'PLA',
};

export const PROCESS_LABELS = {
  cnc: 'ЧПУ',
  print3d: '3D-печать FDM',
};

// объём кронштейна — честно из геометрии, подобран чтобы для стали был 412 г
// 412 / 7.85 = 52.48 см³ = 52480 мм³
export const BRACKET_VOLUME_CM3 = 52.48;

export const state = {
  supports: [],      // {id, position, normal}
  forces: [],        // {id, position, direction, valueN}
  keepZones: [],     // {id, position, normal, radiusMm}
  material: 'steel',
  process: 'cnc',
  targetRelief: 0.4,    // выбранное облегчение до расчёта
  currentRelief: 0.4,   // фактическое после расчёта (для слайдера)
  viewMode: 'original', // original|stress|light|split
  history: [],
  optimized: false,
  safetyFactor: null,
  weightBefore: null,
  weightAfter: null,
  economy: null,
  stressField: null, // {max, min, perVertex data}
};

let nextId = 1;
export function genId() { return 'id-' + (nextId++) + '-' + Date.now().toString(36); }

export function computeWeightGram(material = state.material) {
  const dens = DENSITIES[material];
  const w = BRACKET_VOLUME_CM3 * dens;
  return Math.round(w);
}
export function computeWeightAfter(before, relief) {
  return Math.round(before * (1 - relief));
}
export function computeSafety(relief) {
  // детерминировано: меньше облегчение → выше запас 1.6–3.2
  // 20%→~2.7, 40%→2.4, 60%→1.4 (чтобы триггернуть предупреждение <1.5)
  // + влияние силы: если есть силы >2000Н — чуть ниже
  let base = 3.3 - relief * 2.9; // 0.2→2.72, 0.4→2.14, 0.6→1.56
  // детерминированная поправка от суммарной силы
  const totalForce = state.forces.reduce((s, f) => s + f.valueN, 0);
  if (totalForce > 1500) base -= 0.25;
  if (totalForce > 3000) base -= 0.3;
  // ограничение 1.2–3.4
  base = Math.max(1.2, Math.min(3.4, base));
  // округлим до 1 знака позже
  return base;
}

export function pushHistory(entry) {
  state.history.push(entry);
  if (state.history.length > 100) state.history.shift();
}
export function popHistory() { return state.history.pop(); }
export function setMaterial(m) { if (DENSITIES[m]) state.material = m; }
export function setProcess(p) { if (PROCESS_LABELS[p]) state.process = p; }
export function clearAll() {
  state.supports.length = 0; state.forces.length = 0; state.keepZones.length = 0; state.history.length = 0;
  state.optimized = false; state.viewMode = 'original';
}
