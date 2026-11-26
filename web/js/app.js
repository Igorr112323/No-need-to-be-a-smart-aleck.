// OpenLight — Этап 4: оптимизация (демо-режим), карта напряжений, облегчённая геометрия, шторка, экспорт
// Комментарии на русском. Всё офлайн, детерминированно, без МКЭ.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { state, DENSITIES, MATERIAL_LABELS, BRACKET_VOLUME_CM3, computeWeightGram, computeWeightAfter, computeSafety, pushHistory, popHistory, genId, setMaterial, setProcess } from './state.js';

// ——— тосты ———
const toastEl = document.getElementById('toast');
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
const warningEl = document.getElementById('warningToast');
function showWarning(msg) {
  warningEl.textContent = msg;
  warningEl.classList.add('show');
  clearTimeout(showWarning._t);
  showWarning._t = setTimeout(() => warningEl.classList.remove('show'), 4000);
}
const phaseEl = document.getElementById('phaseToast');
const phaseText = document.getElementById('phaseText');
function showPhase(msg) {
  phaseText.textContent = msg;
  phaseEl.classList.add('show');
}
function hidePhase() { phaseEl.classList.remove('show'); }

// ——— метрики ———
function formatRu(num) {
  // одна цифра после запятой, запятая как разделитель
  return num.toFixed(1).replace('.', ',');
}
function updateMetrics() {
  const before = computeWeightGram();
  state.weightBefore = before;
  const beforeEl = document.getElementById('weightBefore');
  if (beforeEl) beforeEl.textContent = before + ' г';
  if (!state.optimized) {
    document.getElementById('weightAfter').textContent = '—';
    document.getElementById('economy').textContent = '—';
    document.getElementById('safety').textContent = '—';
    return;
  }
  const relief = state.currentRelief;
  const after = computeWeightAfter(before, relief);
  state.weightAfter = after;
  state.economy = relief;
  const safety = computeSafety(relief);
  state.safetyFactor = safety;
  document.getElementById('weightAfter').textContent = after + ' г';
  document.getElementById('economy').textContent = '−' + Math.round(relief * 100) + ' %';
  document.getElementById('safety').textContent = formatRu(safety);
}
updateMetrics();

// ——— сцена ———
const canvas = document.getElementById('scene');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.localClippingEnabled = true;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(115, 95, 115);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 12, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 1.0;
controls.panSpeed = 0.8;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.minDistance = 40;
controls.maxDistance = 350;
controls.update();

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(80, 120, 60);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0006;
keyLight.shadow.radius = 4;
keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 400;
keyLight.shadow.camera.left = -90; keyLight.shadow.camera.right = 90; keyLight.shadow.camera.top = 90; keyLight.shadow.camera.bottom = -90;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.42);
fillLight.position.set(-65, 45, -80);
scene.add(fillLight);
const floorGeo = new THREE.PlaneGeometry(400, 400);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.18, color: 0x0a0a14 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -10;
floor.receiveShadow = true;
scene.add(floor);

// ——— материалы ———
const bracketMat = new THREE.MeshStandardMaterial({ color: 0xC9CDD3, metalness: 0.85, roughness: 0.35 });
const origMat = bracketMat.clone(); // для возврата
// для карты напряжений — будет vertexColors
const stressMatPrototype = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.75 });

// ——— геометрия пластин ———
function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}
function createPlate({ w, h, thickness, radius, holes, organicHoles }) {
  const shape = roundedRectShape(w, h, radius);
  if (holes) for (const ho of holes) { const hole = new THREE.Path(); hole.absarc(ho.x, ho.y, ho.r, 0, Math.PI * 2, false); shape.holes.push(hole); }
  if (organicHoles) {
    for (const o of organicHoles) {
      const hole = new THREE.Path();
      // эллипс с поворотом
      // используем ellipse(a,b,rx,ry,rot)
      hole.ellipse(o.x, o.y, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2, false);
      shape.holes.push(hole);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.1, bevelSegments: 3, curveSegments: 16 });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

// органические отверстия — детерминированно по relief
function organicForRelief(relief, plate) {
  // plate: 'vert' | 'horiz'
  if (plate === 'vert') {
    if (relief === 0.2) return [{ x: 8, y: 5, rx: 5, ry: 3, rot: 0.3 }, { x: -8, y: 12, rx: 3.5, ry: 3.5, rot: 0 }, { x: -7, y: -10, rx: 4, ry: 3, rot: -0.2 }];
    if (relief === 0.4) return [{ x: 9, y: 8, rx: 6, ry: 3.8, rot: 0.4 }, { x: -9, y: 10, rx: 4.2, ry: 4, rot: -0.1 }, { x: -8, y: -6, rx: 5, ry: 3.2, rot: 0.2 }, { x: 7, y: -12, rx: 3.8, ry: 3.8, rot: 0 }];
    if (relief === 0.6) return [{ x: 10, y: 6, rx: 7, ry: 4.5, rot: 0.5 }, { x: -10, y: 12, rx: 5.2, ry: 5, rot: -0.2 }, { x: -9, y: -5, rx: 6, ry: 4, rot: 0.1 }, { x: 8, y: -13, rx: 4.8, ry: 4.2, rot: -0.3 }, { x: 0, y: -2, rx: 5.5, ry: 3, rot: 0.0 }];
  } else {
    if (relief === 0.2) return [{ x: 6, y: 8, rx: 4.5, ry: 3, rot: 0.2 }, { x: -7, y: -4, rx: 3.5, ry: 3, rot: -0.3 }, { x: 0, y: -12, rx: 3.8, ry: 2.8, rot: 0 }];
    if (relief === 0.4) return [{ x: 7, y: 10, rx: 5.5, ry: 3.5, rot: 0.3 }, { x: -8, y: -2, rx: 4.8, ry: 3.8, rot: -0.2 }, { x: 0, y: 5, rx: 4, ry: 4.2, rot: 0.1 }, { x: -6, y: -14, rx: 3.6, ry: 3, rot: 0.4 }];
    if (relief === 0.6) return [{ x: 8, y: 12, rx: 6.5, ry: 4.2, rot: 0.4 }, { x: -9, y: 0, rx: 5.5, ry: 4.5, rot: -0.3 }, { x: 2, y: 6, rx: 4.5, ry: 4.8, rot: 0.2 }, { x: -7, y: -12, rx: 4.2, ry: 3.5, rot: 0.5 }, { x: 7, y: -6, rx: 5, ry: 3, rot: -0.1 }];
  }
  return [];
}
function thicknessForRelief(relief) {
  if (relief === 0.2) return 9;
  if (relief === 0.4) return 8;
  if (relief === 0.6) return 7;
  return 10;
}

// исходные пластины
const vertPlate = (() => {
  const geo = createPlate({ w: 56, h: 78, thickness: 10, radius: 7, holes: [{ x: 0, y: 26, r: 4.6 }, { x: 0, y: -26, r: 4.6 }] });
  const m = new THREE.Mesh(geo, bracketMat);
  m.castShadow = true; m.receiveShadow = true; m.position.set(0, 29, -5);
  return m;
})();
const horizPlate = (() => {
  const geo = createPlate({ w: 56, h: 70, thickness: 10, radius: 7, holes: [{ x: 0, y: 22, r: 5.4 }] });
  const m = new THREE.Mesh(geo, bracketMat);
  m.castShadow = true; m.receiveShadow = true; m.rotation.x = -Math.PI / 2; m.position.set(0, -5, 30);
  return m;
})();
const bracket = new THREE.Group();
bracket.add(vertPlate, horizPlate);
scene.add(bracket);

// группы маркеров
const supportsGroup = new THREE.Group(); supportsGroup.name = 'supports';
const forcesGroup = new THREE.Group(); forcesGroup.name = 'forces';
const keepZonesGroup = new THREE.Group(); keepZonesGroup.name = 'keepZones';
scene.add(supportsGroup, forcesGroup, keepZonesGroup);

// ——— кэш облегчённых версий ———
const lightCache = {}; // relief -> { group, vertGeo, horizGeo }
let currentLightGroup = null;

function getLightGroup(relief) {
  if (lightCache[relief]) return lightCache[relief];
  const th = thicknessForRelief(relief);
  const orgV = organicForRelief(relief, 'vert');
  const orgH = organicForRelief(relief, 'horiz');
  const geoV = createPlate({ w: 56, h: 78, thickness: th, radius: 7, holes: [{ x: 0, y: 26, r: 4.6 }, { x: 0, y: -26, r: 4.6 }], organicHoles: orgV });
  const geoH = createPlate({ w: 56, h: 70, thickness: th, radius: 7, holes: [{ x: 0, y: 22, r: 5.4 }], organicHoles: orgH });
  const mV = new THREE.Mesh(geoV, bracketMat);
  mV.castShadow = true; mV.receiveShadow = true; mV.position.copy(vertPlate.position);
  const mH = new THREE.Mesh(geoH, bracketMat);
  mH.castShadow = true; mH.receiveShadow = true; mH.rotation.x = -Math.PI / 2; mH.position.copy(horizPlate.position);
  const g = new THREE.Group();
  g.add(mV, mH);
  g.visible = false;
  scene.add(g);
  // кэшируем также геометрии отдельно для экспорта
  lightCache[relief] = { group: g, geoV, geoH, meshes: [mV, mH] };
  // если уже есть стресс-поле — применим цвета и на лайт
  if (state.stressField) applyStressToGroup(g, state.stressField);
  return lightCache[relief];
}

// ——— поповеры ———
const popForce = document.getElementById('popoverForce');
const popKeep = document.getElementById('popoverKeep');
const popMaterial = document.getElementById('popoverMaterial');
const popSettings = document.getElementById('popoverSettings');
const popRelief = document.getElementById('popoverRelief');
const forceInput = document.getElementById('forceInput');
const legendEl = document.getElementById('legend');
const splitDivider = document.getElementById('splitDivider');

function hideAllPopovers() {
  popForce.classList.remove('show');
  popKeep.classList.remove('show');
  popMaterial.classList.remove('show');
  popSettings.classList.remove('show');
  // relief не скрываем автоматически при кликах вне — только по Esc или выбору
}
function showPopover(el) {
  // скрыть остальные кроме relief если это не relief
  if (el !== popRelief) {
    popForce.classList.remove('show');
    popKeep.classList.remove('show');
    popMaterial.classList.remove('show');
    popSettings.classList.remove('show');
  }
  el.classList.add('show');
}
function positionPopoverAt(el, point3D, offsetY = 22) {
  const p = point3D.clone().project(camera);
  const x = (p.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
  const w = el.offsetWidth || 220, h = el.offsetHeight || 100;
  let left = x - w / 2;
  let top = y - h - offsetY;
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  top = Math.max(12, top);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}
function positionPopoverNearElement(el, anchorEl, side = 'top') {
  const r = anchorEl.getBoundingClientRect();
  const w = el.offsetWidth || 240, h = el.offsetHeight || 120;
  let left, top;
  if (side === 'top') { left = r.left + r.width / 2 - w / 2; top = r.top - h - 12; }
  else if (side === 'bottom') { left = r.left + r.width / 2 - w / 2; top = r.bottom + 12; }
  else if (side === 'material') { left = r.left; top = r.top - h - 16; }
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  top = Math.max(12, Math.min(window.innerHeight - h - 12, top));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

// ——— создание маркеров (этап 3) ———
function createSupportMarker(id, position, normal) {
  const g = new THREE.Group();
  g.userData = { kind: 'support', id };
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2B2E45, metalness: 0.15, roughness: 0.65 });
  const capMat2 = new THREE.MeshStandardMaterial({ color: 0xE8EBF0, metalness: 0.05, roughness: 0.5 });
  const baseGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.8, 20);
  const base = new THREE.Mesh(baseGeo, capMat); base.castShadow = true; base.position.y = 0.4;
  const stemGeo = new THREE.CylinderGeometry(1.3, 1.3, 4.2, 16);
  const stem = new THREE.Mesh(stemGeo, capMat2); stem.position.y = 3.0;
  const headGeo = new THREE.CylinderGeometry(2.0, 2.0, 1.2, 16);
  const head = new THREE.Mesh(headGeo, capMat); head.position.y = 5.2;
  const domeGeo = new THREE.SphereGeometry(2.0, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, capMat); dome.position.y = 5.8;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(3.8, 4.6, 32);
  const ring1 = new THREE.Mesh(ringGeo, ringMat); ring1.rotation.x = -Math.PI / 2; ring1.position.y = 0.15;
  const ring2 = new THREE.Mesh(ringGeo, ringMat.clone()); ring2.material.opacity = 0.5; ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.15; ring2.scale.set(0.6, 0.6, 0.6);
  const capGroup = new THREE.Group(); capGroup.add(base, stem, head, dome, ring1, ring2); g.add(capGroup);
  const up = new THREE.Vector3(0, 1, 0); const n = normal.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(up, n); g.quaternion.copy(q);
  g.position.copy(position.clone().add(n.clone().multiplyScalar(0.6)));
  g.userData.rings = [ring1, ring2]; g.userData.pulseStart = performance.now(); g.userData.pulse = true;
  const pickGeo = new THREE.SphereGeometry(5, 12, 8); const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const pick = new THREE.Mesh(pickGeo, pickMat); g.add(pick);
  return g;
}
function createForceMarker(id, position, direction, valueN) {
  const dir = direction.clone().normalize(); const len = 14;
  const g = new THREE.Group(); g.userData = { kind: 'force', id, valueN };
  const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), len, 0xFF3B30, 3.8, 1.9); g.add(arrow);
  const pickGeo = new THREE.CylinderGeometry(2.2, 2.2, len, 10); const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const pick = new THREE.Mesh(pickGeo, pickMat); pick.position.copy(dir.clone().multiplyScalar(len / 2)); const up = new THREE.Vector3(0, 1, 0); const q = new THREE.Quaternion().setFromUnitVectors(up, dir); pick.quaternion.copy(q); g.add(pick);
  g.position.copy(position.clone().add(dir.clone().multiplyScalar(0.2))); g.userData.dir = dir.clone(); g.userData.arrow = arrow;
  return g;
}
function createKeepZoneMarker(id, position, normal, radiusMm) {
  const g = new THREE.Group(); g.userData = { kind: 'keep', id, radius: radiusMm, normal: normal.clone() };
  const holder = new THREE.Group();
  const geo = new THREE.CircleGeometry(radiusMm, 36); const mat = new THREE.MeshStandardMaterial({ color: 0x007AFF, transparent: true, opacity: 0.22, side: THREE.DoubleSide, metalness: 0, roughness: 1 }); mat.depthWrite = false;
  const disk = new THREE.Mesh(geo, mat);
  const borderGeo = new THREE.RingGeometry(radiusMm - 0.35, radiusMm + 0.35, 36); const borderMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const border = new THREE.Mesh(borderGeo, borderMat); border.position.z = 0.03; holder.add(disk, border);
  const up = new THREE.Vector3(0, 0, 1); const n = normal.clone().normalize(); const q = new THREE.Quaternion().setFromUnitVectors(up, n); holder.quaternion.copy(q);
  g.add(holder); g.position.copy(position.clone().add(n.clone().multiplyScalar(0.35))); g.userData.meshes = { disk, border, holder, mat, borderMat };
  const pickGeo = new THREE.CircleGeometry(radiusMm + 1, 16); const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
  const pick = new THREE.Mesh(pickGeo, pickMat); holder.add(pick);
  return g;
}

// ——— инструменты ———
let currentTool = null;
let pendingForce = null;
let currentKeepRadius = 12;

let viewMode = 'original'; // original|stress|light|split
const btnOptimize = document.getElementById('btnOptimize');
const optBarFill = document.getElementById('optBarFill');

const dockBtns = document.querySelectorAll('.dock-btn[data-tool]');
function setTool(tool) {
  if (tool === currentTool) {
    currentTool = null; dockBtns.forEach(b => b.classList.remove('active')); hideAllPopovers(); canvas.style.cursor = 'default'; return;
  }
  currentTool = tool;
  dockBtns.forEach(b => {
    if (b.dataset.tool === tool) b.classList.add('active');
    else if (b.dataset.tool !== 'view') b.classList.remove('active');
  });
  hideAllPopovers();
  if (tool === 'fix') showToast('Кликните по детали — опора. Повторно по маркеру — удалить.');
  if (tool === 'force') showToast('Кликните по грани — стрелка силы. Клик по стрелке — удалить.');
  if (tool === 'keep') showToast('Кликните по детали — синяя зона. Радиус меняется в поповере.');
  canvas.style.cursor = tool ? 'crosshair' : 'default';
}
dockBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'view') {
      cycleView();
      return;
    }
    setTool(tool);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (pendingForce) { forcesGroup.remove(pendingForce.previewMesh); pendingForce = null; }
    setTool(null); hideAllPopovers(); popRelief.classList.remove('show');
    currentTool = null; dockBtns.forEach(b => b.classList.remove('active')); canvas.style.cursor = 'default';
  }
});

// ——— Undo ———
function _removeWithoutHistory(id, group, arr) { const idx = arr.findIndex(x => x.id === id); if (idx >= 0) arr.splice(idx, 1); const mesh = group.children.find(m => m.userData.id === id); if (mesh) group.remove(mesh); }
function handleUndo() {
  const last = popHistory(); if (!last) { showToast('Нечего отменять'); return; }
  if (last.action === 'add') {
    if (last.kind === 'support') _removeWithoutHistory(last.id, supportsGroup, state.supports);
    if (last.kind === 'force') _removeWithoutHistory(last.id, forcesGroup, state.forces);
    if (last.kind === 'keep') _removeWithoutHistory(last.id, keepZonesGroup, state.keepZones);
    hideAllPopovers(); if (pendingForce) { forcesGroup.remove(pendingForce.previewMesh); pendingForce = null; }
    showToast('Отменено');
  } else if (last.action === 'remove') {
    if (last.kind === 'support') { state.supports.push(last.snapshot); const m = createSupportMarker(last.snapshot.id, last.snapshot.position, last.snapshot.normal); supportsGroup.add(m); }
    if (last.kind === 'force') { state.forces.push(last.snapshot); const m = createForceMarker(last.snapshot.id, last.snapshot.position, last.snapshot.direction, last.snapshot.valueN); forcesGroup.add(m); }
    if (last.kind === 'keep') { state.keepZones.push(last.snapshot); const m = createKeepZoneMarker(last.snapshot.id, last.snapshot.position, last.snapshot.normal, last.snapshot.radiusMm); keepZonesGroup.add(m); }
    showToast('Восстановлено');
  }
  updateMetrics();
  // если уже оптимизировано — подскажем что нужен пересчёт
  if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
}
document.getElementById('btnUndo').addEventListener('click', handleUndo);

// ——— материал ———
const btnMaterial = document.getElementById('btnMaterial');
btnMaterial.addEventListener('click', (e) => { e.stopPropagation(); if (popMaterial.classList.contains('show')) popMaterial.classList.remove('show'); else { positionPopoverNearElement(popMaterial, btnMaterial, 'material'); showPopover(popMaterial); } });
popMaterial.querySelectorAll('[data-mat]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-mat]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    setMaterial(chip.dataset.mat); updateMetrics(); showToast('Материал: ' + MATERIAL_LABELS[chip.dataset.mat]);
  });
});
popMaterial.querySelectorAll('[data-proc]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-proc]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    setProcess(chip.dataset.proc); showToast('Процесс: ' + (chip.dataset.proc === 'cnc' ? 'ЧПУ' : '3D-печать'));
  });
});
const btnMore = document.getElementById('btnMore');
btnMore.addEventListener('click', (e) => { e.stopPropagation(); if (popSettings.classList.contains('show')) popSettings.classList.remove('show'); else { positionPopoverNearElement(popSettings, btnMore, 'bottom'); showPopover(popSettings); } });
document.getElementById('btnBack').addEventListener('click', () => showToast('Проекты — скоро'));
document.getElementById('btnExport').addEventListener('click', () => {
  if (!state.optimized) { showToast('Сначала оптимизируйте — демо-режим'); return; }
  const exporter = new STLExporter();
  const toExport = getLightGroup(state.currentRelief).group;
  const result = exporter.parse(toExport, { binary: false });
  const blob = new Blob([result], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'optimized.stl'; a.click();
  URL.revokeObjectURL(url);
  showToast('Сохранено: optimized.stl');
  console.log('STL exported', result.length);
});
document.getElementById('btnExport').addEventListener('contextmenu', (e) => {
  // правый клик — отчёт
  e.preventDefault(); showToast('Отчёт будет в Этапе 6');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.popover') && !e.target.closest('#btnMaterial') && !e.target.closest('#btnMore') && !e.target.closest('#btnOptimize')) {
    if (!e.target.closest('#scene')) {
      popMaterial.classList.remove('show'); popSettings.classList.remove('show');
    }
  }
  // клик по документу вне relief поповера — скрыть только если клик не по optimize
  if (!e.target.closest('#popoverRelief') && !e.target.closest('#btnOptimize')) {
    // оставляем relief открытым только если в режиме split/light? скрываем через 3с? просто не автоскрываем
  }
});

// ——— сила поповер ———
function confirmForce() {
  if (!pendingForce) return;
  const val = parseInt(forceInput.value, 10);
  const v = Math.max(50, Math.min(5000, isNaN(val) ? 500 : val));
  const id = genId();
  const rec = { kind: 'force', id, position: pendingForce.position.clone(), direction: pendingForce.direction.clone(), valueN: v };
  state.forces.push(rec);
  const mesh = pendingForce.previewMesh; mesh.userData.id = id; mesh.userData.valueN = v; mesh.userData.kind = 'force';
  pushHistory({ action: 'add', kind: 'force', id, snapshot: rec });
  pendingForce = null; hideAllPopovers(); showToast('Сила ' + v + ' Н установлена'); updateMetrics();
}
document.getElementById('forceOk').addEventListener('click', confirmForce);
forceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmForce(); });
popForce.querySelectorAll('.step-btn').forEach(b => {
  b.addEventListener('click', () => {
    const step = parseInt(b.dataset.step, 10);
    let v = parseInt(forceInput.value, 10) || 500; v += step; v = Math.max(50, Math.min(5000, Math.round(v / 50) * 50)); forceInput.value = v;
  });
});
popKeep.querySelectorAll('[data-r]').forEach(chip => {
  chip.addEventListener('click', () => {
    popKeep.querySelectorAll('[data-r]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    const r = parseInt(chip.dataset.r, 10); currentKeepRadius = r;
    if (popKeep._targetId) {
      const id = popKeep._targetId; const rec = state.keepZones.find(k => k.id === id);
      if (rec) {
        rec.radiusMm = r;
        const mesh = keepZonesGroup.children.find(m => m.userData.id === id);
        if (mesh) {
          const holder = mesh.userData.meshes.holder; const oldDisk = mesh.userData.meshes.disk; const oldBorder = mesh.userData.meshes.border;
          holder.remove(oldDisk, oldBorder);
          const geo = new THREE.CircleGeometry(r, 36); const mat = new THREE.MeshStandardMaterial({ color: 0x007AFF, transparent: true, opacity: 0.22, side: THREE.DoubleSide }); mat.depthWrite = false;
          const disk = new THREE.Mesh(geo, mat);
          const borderGeo = new THREE.RingGeometry(r - 0.35, r + 0.35, 36); const borderMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
          const border = new THREE.Mesh(borderGeo, borderMat); border.position.z = 0.03; holder.add(disk, border);
          mesh.userData.meshes.disk = disk; mesh.userData.meshes.border = border; mesh.userData.radius = r;
        }
      }
    }
    showToast('Радиус зоны: ' + r + ' мм');
  });
});

// ——— relief поповер ———
popRelief.querySelectorAll('[data-relief]').forEach(chip => {
  chip.addEventListener('click', () => {
    const rel = parseFloat(chip.dataset.relief);
    state.targetRelief = rel; state.currentRelief = rel;
    popRelief.querySelectorAll('[data-relief]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    if (state.optimized) {
      updateMetrics();
      // мгновенное переключение если в режиме облегчённой/шторки
      if (viewMode === 'light' || viewMode === 'split') {
        switchLight(rel);
        // если split — обновить видимость
        if (viewMode === 'split') {
          Object.values(lightCache).forEach(v => v.group.visible = false);
          getLightGroup(rel).group.visible = true;
          currentLightGroup = getLightGroup(rel).group;
        }
      }
      showToast('Облегчение: ' + Math.round(rel * 100) + ' %');
      checkSafetyWarning();
    } else {
      showToast('Выбрано облегчение ' + Math.round(rel * 100) + ' % — нажмите Оптимизировать ещё раз');
    }
  });
});
function showReliefPopover() {
  positionPopoverNearElement(popRelief, btnOptimize, 'top');
  showPopover(popRelief);
  // подсветить активный
  popRelief.querySelectorAll('[data-relief]').forEach(c => c.classList.toggle('active', parseFloat(c.dataset.relief) === state.currentRelief));
}

// ——— оптимизация ———
const phases = ['Анализ закреплений…', 'Построение сетки…', 'Расчёт напряжений…', 'Удаление ненагруженного материала…', 'Проверка…'];
let isOptimizing = false;
let splitRatio = 0.5;

function checkWarningsBefore() {
  if (state.supports.length === 0) { showWarning('Нет закрепления: деталь улетит. Добавьте опору.'); return false; }
  // проверка PLA >4000 Н
  if (state.material === 'pla') {
    const over = state.forces.some(f => f.valueN > 4000);
    if (over) showWarning('Превышена типичная нагрузка для PLA — проверьте материал или сечение.');
  }
  return true;
}
function checkSafetyWarning() {
  if (!state.optimized) return;
  const safety = computeSafety(state.currentRelief);
  if (state.currentRelief >= 0.6 && safety < 1.5) {
    showWarning('Переоптимизация: снизьте облегчение до 40 %.');
  }
}

function startOptimization() {
  if (state.supports.length === 0 || state.forces.length === 0) {
    showWarning('Добавьте опору и нагрузку, чтобы рассчитать');
    btnOptimize.style.transform = 'scale(0.95)'; setTimeout(() => btnOptimize.style.transform = '', 150);
    return;
  }
  if (isOptimizing) return;
  isOptimizing = true;
  btnOptimize.classList.add('optimizing');
  btnOptimize.classList.add('haptic-pulse');
  setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 500);
  hideAllPopovers();
  let phaseIdx = 0;
  showPhase(phases[0]);
  optBarFill.style.width = '0%';
  const start = performance.now();
  const total = 3800 + Math.random() * 800; // 3.8-4.6с
  const interval = setInterval(() => {
    phaseIdx = (phaseIdx + 1) % phases.length;
    showPhase(phases[phaseIdx]);
    const elapsed = performance.now() - start;
    const pct = Math.min(92, (elapsed / total) * 100);
    optBarFill.style.width = pct + '%';
  }, 600);

  setTimeout(() => {
    clearInterval(interval);
    hidePhase();
    optBarFill.style.width = '100%';
    // вычислить детерминированное поле
    state.stressField = computeStressField();
    // сгенерировать кэш трёх облегчений (для мгновенного переключения <300 мс)
    [0.2, 0.4, 0.6].forEach(r => getLightGroup(r));
    const rel = state.targetRelief || 0.4;
    state.currentRelief = rel;
    state.optimized = true;
    updateMetrics();
    // остаёмся в исходном виде — пользователь сам переключит на облегчённую/карту/шторку
    // но подготовить цвета для будущего стресс-режима
    applyStressToGroup(bracket, state.stressField);
    Object.values(lightCache).forEach(v => applyStressToGroup(v.group, state.stressField));
    // проверка предупреждений автопилота
    checkWarningsBefore(); // может уже показать PLA warning
    checkSafetyWarning();

    // сбросить прогресс
    setTimeout(() => {
      btnOptimize.classList.remove('optimizing');
      optBarFill.style.width = '0%';
      isOptimizing = false;
      // пульс кнопки
      btnOptimize.classList.add('haptic-pulse');
      setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 450);
      // показать relief поповер для мгновенного переключения
      showReliefPopover();
      showToast('Оптимизация готова — демонстрационный режим');
      console.log('optimize done', { relief: rel, safety: state.safetyFactor });
    }, 400);
  }, total);
}

// ——— синтетическое поле напряжений ———
function computeStressField() {
  // собираем точки пиков: опоры, силы, отверстия
  const peaks = [];
  // опоры — вес 1.0 sigma 12
  state.supports.forEach(s => peaks.push({ pos: s.position.clone(), weight: 1.0, sigma: 13 }));
  // силы — вес 1.35 sigma 10, интенсивность зависит от valueN (500→1, 2000→1.3)
  state.forces.forEach(f => {
    const w = 1.2 + Math.min(0.6, f.valueN / 4000);
    peaks.push({ pos: f.position.clone(), weight: w, sigma: 11 });
  });
  // отверстия — фиксированные в мировых координатах
  // vert отверстия мировая позиция: vertPlate position + local hole offset
  const holeWorld = [];
  // vert holes local (0,26) и (0,-26) в плоскости верта, преобразуем
  const vPos = vertPlate.position; // (0,29,-5) в группе bracket (группа в 0)
  // вертикальная пластина локально в XY, отверстия по Y
  holeWorld.push(new THREE.Vector3(0, vPos.y + 26, vPos.z));
  holeWorld.push(new THREE.Vector3(0, vPos.y - 26, vPos.z));
  const hPos = horizPlate.position; // (0,-5,30) с поворотом -90 вокруг X
  // горизонтальная: отверстие (0,22) в локальных XY верта, после поворота Y->Z?
  // для простоты берём (0, -5, 30+22) = (0,-5,52)
  holeWorld.push(new THREE.Vector3(0, -5, hPos.z + 22));
  holeWorld.forEach(p => peaks.push({ pos: p, weight: 0.85, sigma: 9 }));

  // функция сбора вершин всех геометрий (оригинал + лайт кэш уже есть?) — считаем только оригинал, потом применим к лайтам
  // для простоты вычислим поле как функцию от расстояния, кэшируем нормализацию
  // найдём все вершины оригинала для нормализации
  const allPos = [];
  [vertPlate, horizPlate].forEach(mesh => {
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      v.applyMatrix4(mesh.matrixWorld);
      // bracket группа без трансформации
      allPos.push(v);
    }
  });
  // вычислим сырые значения и найдём min/max
  let min = Infinity, max = -Infinity;
  const raw = allPos.map(p => {
    let sum = 0;
    // гауссовы пики
    for (const peak of peaks) {
      const d = p.distanceTo(peak.pos);
      sum += peak.weight * Math.exp(-(d * d) / (2 * peak.sigma * peak.sigma));
    }
    // градиент вдоль ребра кронштейна — добавить линейный рост к стыку (0,0,0)
    const distToOrigin = p.distanceTo(new THREE.Vector3(0, 0, 0));
    sum += 0.18 * Math.exp(-distToOrigin / 28);
    // keepZones — слегка снижают напряжение (запретная зона — не трогать, напряжение ниже)
    for (const kz of state.keepZones) {
      const d = p.distanceTo(kz.position);
      if (d < kz.radiusMm + 4) sum *= 0.92;
    }
    if (sum < min) min = sum;
    if (sum > max) max = sum;
    return sum;
  });
  // нормализуем 0-1
  const range = max - min || 1;
  return { peaks, min, max, range, allPosRaw: raw };
}

// градиент цветов
function stressColor(t) {
  // t 0-1: синий #2F7CF6 → зелёный #34C759 → янтарный #FFCC00 → коралловый #FF6B4A
  const c1 = new THREE.Color(0x2F7CF6), c2 = new THREE.Color(0x34C759), c3 = new THREE.Color(0xFFCC00), c4 = new THREE.Color(0xFF6B4A);
  let c = new THREE.Color();
  if (t < 0.33) c.lerpColors(c1, c2, t / 0.33);
  else if (t < 0.66) c.lerpColors(c2, c3, (t - 0.33) / 0.33);
  else c.lerpColors(c3, c4, (t - 0.66) / 0.34);
  return c;
}
function applyStressToMesh(mesh, field) {
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    v.applyMatrix4(mesh.matrixWorld);
    let sum = 0;
    for (const peak of field.peaks) {
      const d = v.distanceTo(peak.pos);
      sum += peak.weight * Math.exp(-(d * d) / (2 * peak.sigma * peak.sigma));
    }
    sum += 0.18 * Math.exp(-v.distanceTo(new THREE.Vector3(0, 0, 0)) / 28);
    for (const kz of state.keepZones) {
      const d = v.distanceTo(kz.position);
      if (d < kz.radiusMm + 4) sum *= 0.92;
    }
    const t = (sum - field.min) / field.range;
    color.copy(stressColor(Math.max(0, Math.min(1, t))));
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}
function applyStressToGroup(group, field) {
  group.children.forEach(m => {
    if (m.isMesh) applyStressToMesh(m, field);
  });
}
function enableStressMaterial(group, enable) {
  group.children.forEach(m => {
    if (m.isMesh) {
      if (enable) {
        if (!m.userData.origMat) m.userData.origMat = m.material;
        const mat = stressMatPrototype.clone();
        // сохранить shadow
        m.material = mat;
        // vertexColors уже через атрибут
      } else {
        if (m.userData.origMat) m.material = m.userData.origMat;
        else m.material = bracketMat;
      }
    }
  });
}

// ——— переключение облегчённой ———
function switchLight(relief) {
  // скрыть оригинал, показать нужный лайт
  const target = getLightGroup(relief);
  // скрыть все лайты
  Object.values(lightCache).forEach(v => v.group.visible = false);
  bracket.visible = false;
  target.group.visible = true;
  currentLightGroup = target.group;
  // если в режиме stress — применить стресс цвета к лайту
  if (viewMode === 'stress' && state.stressField) {
    enableStressMaterial(target.group, true);
  }
}

// восстановление оригинала
function showOriginal() {
  bracket.visible = true;
  Object.values(lightCache).forEach(v => v.group.visible = false);
  currentLightGroup = null;
  if (viewMode === 'stress' && state.stressField) {
    enableStressMaterial(bracket, true);
  } else {
    enableStressMaterial(bracket, false);
  }
}

// ——— режимы вида ———
function setView(mode) {
  viewMode = mode;
  state.viewMode = mode;
  // сбросить видимость шторки/легенды
  legendEl.classList.remove('show');
  splitDivider.classList.remove('show');

  if (mode === 'original') {
    showOriginal();
    enableStressMaterial(bracket, false);
    Object.values(lightCache).forEach(v => enableStressMaterial(v.group, false));
    legendEl.classList.remove('show');
    splitDivider.classList.remove('show');
    renderer.setScissorTest(false);
  } else if (mode === 'stress') {
    if (!state.optimized) { showToast('Сначала оптимизируйте — демо-режим'); viewMode = 'original'; return; }
    showOriginal();
    // подготовить стресс-атрибуты если нет
    if (!bracket.children[0].geometry.attributes.color) {
      if (!state.stressField) state.stressField = computeStressField();
      applyStressToGroup(bracket, state.stressField);
    }
    enableStressMaterial(bracket, true);
    // скрыть лайты, убрать их стресс
    Object.values(lightCache).forEach(v => { v.group.visible = false; enableStressMaterial(v.group, false); });
    currentLightGroup = null;
    legendEl.classList.add('show');
    splitDivider.classList.remove('show');
    renderer.setScissorTest(false);
  } else if (mode === 'light') {
    if (!state.optimized) { showToast('Сначала оптимизируйте'); viewMode = 'original'; return; }
    switchLight(state.currentRelief);
    // облегчённая — обычный материал, без карты
    enableStressMaterial(currentLightGroup, false);
    legendEl.classList.remove('show');
    splitDivider.classList.remove('show');
    renderer.setScissorTest(false);
  } else if (mode === 'split') {
    if (!state.optimized) { showToast('Сначала оптимизируйте'); viewMode = 'original'; return; }
    // оба видимы, рендер через scissor
    bracket.visible = true;
    if (!currentLightGroup) getLightGroup(state.currentRelief);
    Object.values(lightCache).forEach(v => v.group.visible = false);
    getLightGroup(state.currentRelief).group.visible = true;
    currentLightGroup = getLightGroup(state.currentRelief).group;
    // в split — обычные материалы без карты
    enableStressMaterial(bracket, false);
    enableStressMaterial(currentLightGroup, false);
    legendEl.classList.remove('show');
    splitDivider.classList.add('show');
    updateSplitDividerPos();
    renderer.setScissorTest(false);
  }
  // подсветить активную кнопку вида
  dockBtns.forEach(b => {
    if (b.dataset.tool === 'view') {
      if (mode === 'original') b.classList.remove('active');
      else b.classList.add('active');
    }
  });
}
function cycleView() {
  const order = ['original', 'stress', 'light', 'split'];
  let idx = order.indexOf(viewMode);
  idx = (idx + 1) % order.length;
  const next = order[idx];
  // если не оптимизировано и next не original — показать тост и не переключать (как в этапе 3)
  if (!state.optimized && next !== 'original') {
    // показать тост как раньше, но для этапа 4 — показываем «Сначала оптимизируйте»
    setView(next);
    return;
  }
  setView(next);
  const labels = { original: 'Вид: Исходная', stress: 'Вид: Карта напряжений', light: 'Вид: Облегчённая', split: 'Вид: До/После' };
  showToast(labels[next] || next);
}

// ——— шторка split ———
function updateSplitDividerPos() {
  const pct = splitRatio * 100;
  splitDivider.style.left = pct + '%';
}
let splitDragging = false;
splitDivider.addEventListener('pointerdown', (e) => {
  splitDragging = true;
  splitDivider.setPointerCapture(e.pointerId);
  e.preventDefault();
});
window.addEventListener('pointermove', (e) => {
  if (!splitDragging) return;
  splitRatio = e.clientX / window.innerWidth;
  splitRatio = Math.max(0.05, Math.min(0.95, splitRatio));
  updateSplitDividerPos();
});
window.addEventListener('pointerup', () => { splitDragging = false; });
window.addEventListener('resize', () => { if (viewMode === 'split') updateSplitDividerPos(); });

// ——— Optimize кнопка ———
btnOptimize.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isOptimizing) return;
  if (!state.optimized) {
    // до старта — показать поповер выбора облегчения, второй клик запустит
    if (!popRelief.classList.contains('show')) {
      showReliefPopover();
      showToast('Выберите облегчение и нажмите Оптимизировать ещё раз');
      return;
    } else {
      // если поповер открыт — запустить
      popRelief.classList.remove('show');
      startOptimization();
      return;
    }
  } else {
    // после — показать поповер для мгновенного переключения
    if (popRelief.classList.contains('show')) popRelief.classList.remove('show');
    else showReliefPopover();
    return;
  }
});

// ——— Raycaster и маркеры (этап 3 логика сохранена) ———
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = false;
let edgeLine = null;
function setHover(h) {
  if (hovered === h) return;
  hovered = h;
  if (h) {
    bracketMat.emissive = new THREE.Color(0x224466); bracketMat.emissiveIntensity = 0.18;
    // также для лайт материалов если видны
    canvas.style.cursor = currentTool ? 'crosshair' : 'pointer';
    if (!edgeLine) {
      const edges = new THREE.EdgesGeometry(vertPlate.geometry, 18);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.55 });
      edgeLine = new THREE.LineSegments(edges, lineMat);
      edgeLine.position.copy(vertPlate.position); edgeLine.rotation.copy(vertPlate.rotation);
      bracket.add(edgeLine);
    }
    edgeLine.visible = true;
  } else {
    bracketMat.emissive = new THREE.Color(0x000000); bracketMat.emissiveIntensity = 0;
    if (edgeLine) edgeLine.visible = false;
    if (!currentTool) canvas.style.cursor = 'default';
    else canvas.style.cursor = 'crosshair';
  }
}
let dragStart = null; let isDragging = false;
canvas.addEventListener('pointerdown', (e) => { dragStart = { x: e.clientX, y: e.clientY }; isDragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.hypot(dx, dy) > 6) isDragging = true; }
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hitsBracket = raycaster.intersectObjects(bracket.children, true);
  const hitsLight = currentLightGroup ? raycaster.intersectObjects(currentLightGroup.children, true) : [];
  const hitsMarkers = raycaster.intersectObjects([supportsGroup, forcesGroup, keepZonesGroup], true);
  if (hitsMarkers.length > 0 || hitsBracket.length > 0 || hitsLight.length > 0) setHover(true); else setHover(false);
});
canvas.addEventListener('pointerup', () => { setTimeout(() => { dragStart = null; isDragging = false; }, 50); });
function getWorldNormal(hit) { const n = hit.face.normal.clone(); const m = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld); n.applyMatrix3(m).normalize(); return n; }
function findMarkerAncestor(obj) { let cur = obj; while (cur) { if (cur.userData && cur.userData.kind) return cur; cur = cur.parent; } return null; }

canvas.addEventListener('click', (e) => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hitsMarkers = raycaster.intersectObjects([supportsGroup, forcesGroup, keepZonesGroup], true);
  if (hitsMarkers.length > 0) {
    const hit = hitsMarkers[0]; const marker = findMarkerAncestor(hit.object);
    if (marker && marker.userData && marker.userData.id) {
      const id = marker.userData.id, kind = marker.userData.kind;
      let rec = null;
      if (kind === 'support') rec = state.supports.find(s => s.id === id);
      if (kind === 'force') rec = state.forces.find(s => s.id === id);
      if (kind === 'keep') rec = state.keepZones.find(s => s.id === id);
      if (rec) {
        if (kind === 'support') { _removeWithoutHistory(id, supportsGroup, state.supports); pushHistory({ action: 'remove', kind: 'support', id, snapshot: rec }); }
        if (kind === 'force') { _removeWithoutHistory(id, forcesGroup, state.forces); pushHistory({ action: 'remove', kind: 'force', id, snapshot: rec }); }
        if (kind === 'keep') { _removeWithoutHistory(id, keepZonesGroup, state.keepZones); pushHistory({ action: 'remove', kind: 'keep', id, snapshot: rec }); }
        showToast('Удалено'); console.log('pick', { point: hit.point, normal: hit.face ? hit.face.normal : null });
        if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
        return;
      }
    }
  }
  // клик по детали — зависит от режима вида: в split/light используем видимую геометрию
  let candidates = [];
  if (viewMode === 'light' && currentLightGroup) candidates = currentLightGroup.children;
  else if (viewMode === 'split') {
    // в split — выбирать ту сторону где клик (по splitRatio)
    const isLeft = (e.clientX / window.innerWidth) < splitRatio;
    // но для простоты — тестируем обе, берём первую
    candidates = [...bracket.children, ...(currentLightGroup ? currentLightGroup.children : [])];
  } else {
    candidates = bracket.children;
    // если после оптимизации в original — всё равно оригинал
  }
  const hits = raycaster.intersectObjects(candidates, true);
  if (hits.length === 0) {
    if (!e.target.closest('.popover')) { popForce.classList.remove('show'); popKeep.classList.remove('show'); }
    return;
  }
  const hit = hits[0]; const pos = hit.point.clone(); const normal = getWorldNormal(hit);
  console.log('pick', { point: pos, normal });
  if (!currentTool) { showToast(`Клик: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`); return; }
  if (currentTool === 'fix') {
    const id = genId(); const rec = { kind: 'support', id, position: pos.clone(), normal: normal.clone() }; state.supports.push(rec);
    const mesh = createSupportMarker(id, pos, normal); supportsGroup.add(mesh); pushHistory({ action: 'add', kind: 'support', id, snapshot: rec }); showToast('Опора установлена');
    if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
  } else if (currentTool === 'force') {
    if (pendingForce) forcesGroup.remove(pendingForce.previewMesh);
    const dir = normal.clone().negate();
    const preview = createForceMarker('preview', pos, dir, 500); preview.userData.isPreview = true; forcesGroup.add(preview);
    pendingForce = { position: pos.clone(), direction: dir.clone(), previewMesh: preview, point3D: pos.clone() };
    forceInput.value = 500; positionPopoverAt(popForce, pos, 26); showPopover(popForce); forceInput.focus(); forceInput.select();
  } else if (currentTool === 'keep') {
    const id = genId(); const rec = { kind: 'keep', id, position: pos.clone(), normal: normal.clone(), radiusMm: currentKeepRadius }; state.keepZones.push(rec);
    const mesh = createKeepZoneMarker(id, pos, normal, currentKeepRadius); keepZonesGroup.add(mesh); pushHistory({ action: 'add', kind: 'keep', id, snapshot: rec });
    popKeep._targetId = id; positionPopoverAt(popKeep, pos, 18); showPopover(popKeep);
    popKeep.querySelectorAll('[data-r]').forEach(c => c.classList.toggle('active', parseInt(c.dataset.r, 10) === currentKeepRadius));
    showToast('Зона ' + currentKeepRadius + ' мм — можно изменить');
    if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
  }
});
function _removeWithoutHistory(id, group, arr) { const idx = arr.findIndex(x => x.id === id); if (idx >= 0) arr.splice(idx, 1); const mesh = group.children.find(m => m.userData.id === id); if (mesh) group.remove(mesh); }
document.addEventListener('click', (e) => { if (pendingForce && !e.target.closest('#popoverForce') && !e.target.closest('#scene')) {} });

// ——— ресайз ———
function onResize() { const w = window.innerWidth, h = window.innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); if (viewMode === 'split') updateSplitDividerPos(); }
window.addEventListener('resize', onResize); onResize();

// ——— анимация ———
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  supportsGroup.children.forEach(m => {
    if (m.userData.pulse) {
      const t = (now - m.userData.pulseStart) / 620;
      if (t < 1) {
        const s = 1 + t * 0.65; const o = 1 - t * 0.75;
        m.userData.rings.forEach((ring, i) => { const k = i === 0 ? s : s * 0.85; ring.scale.set(k, k, 1); ring.material.opacity = o * (i === 0 ? 0.85 : 0.55); });
      } else { m.userData.pulse = false; m.userData.rings.forEach((ring, i) => { ring.scale.set(1, 1, 1); ring.material.opacity = i === 0 ? 0.55 : 0.35; }); }
    }
  });
  controls.update();

  if (viewMode === 'split' && state.optimized && currentLightGroup) {
    // scissor рендер
    const w = window.innerWidth, h = window.innerHeight;
    const leftW = Math.round(w * splitRatio);
    const rightW = w - leftW;
    renderer.setScissorTest(true);
    // левая — оригинал
    renderer.setViewport(0, 0, leftW, h); renderer.setScissor(0, 0, leftW, h);
    bracket.visible = true; currentLightGroup.visible = false;
    // скрыть лайт материалы временно
    renderer.render(scene, camera);
    // правая — облегчённая
    renderer.setViewport(leftW, 0, rightW, h); renderer.setScissor(leftW, 0, rightW, h);
    bracket.visible = false; currentLightGroup.visible = true;
    renderer.render(scene, camera);
    // восстановить
    bracket.visible = true; currentLightGroup.visible = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  } else {
    renderer.render(scene, camera);
  }
}
animate();
const hint = document.getElementById('centerHint');
if (hint) setTimeout(() => hint.classList.add('hidden'), 600);
console.log('%cOpenLight Этап 4 — демо-оптимизация готова', 'color:#007AFF;font-weight:600');
console.log('Подсказка: поставьте опоры/силу → Оптимизировать → Вид/шторка → слайдер 20/40/60 → Экспорт STL');

// экспорт для отладки
window._state = state;
window._scene = scene;
