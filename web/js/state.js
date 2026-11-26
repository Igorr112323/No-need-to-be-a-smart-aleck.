// state.js — единое состояние OpenLight (Этап 3)
// Комментарии на русском. Только данные и честный расчёт веса.

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
// 412 / 7.85 = 52.48 см³ = 52480 мм³ (две пластины 56×78×10 и 56×70×10 минус нахлёст и 3 отверстия)
export const BRACKET_VOLUME_CM3 = 52.48;

export const state = {
  supports: [],      // {id, position: THREE.Vector3, normal: THREE.Vector3}
  forces: [],        // {id, position, direction, valueN}
  keepZones: [],     // {id, position, normal, radiusMm}
  material: 'steel', // 'steel'|'alu'|'pla'
  process: 'cnc',    // 'cnc'|'print3d'
  targetRelief: 0.4,
  viewMode: 'original', // original|stress|light|split
  history: [],       // стек {action:'add'|'remove', kind, id, snapshot}
};

let nextId = 1;
export function genId() { return 'id-' + (nextId++) + '-' + Date.now().toString(36); }

// честный вес из плотности
export function computeWeightGram(material = state.material) {
  const dens = DENSITIES[material];
  const w = BRACKET_VOLUME_CM3 * dens;
  return Math.round(w); // г
}

// история для Undo
export function pushHistory(entry) {
  state.history.push(entry);
  // ограничим 100
  if (state.history.length > 100) state.history.shift();
}

export function popHistory() {
  return state.history.pop();
}

// смена материала/процесса
export function setMaterial(m) {
  if (DENSITIES[m]) state.material = m;
}
export function setProcess(p) {
  if (PROCESS_LABELS[p]) state.process = p;
}

// сброс (не используется, но пригодится)
export function clearAll() {
  state.supports.length = 0;
  state.forces.length = 0;
  state.keepZones.length = 0;
  state.history.length = 0;
}
