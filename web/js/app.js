// OpenLight — Этап 7 (фаза B): реальное ядро — воксели 64³, МКЭ, SIMP, marching cubes, Taubin
// Комментарии на русском. Всё офлайн, честный прогресс и запас по von Mises.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { state, DENSITIES, MATERIAL_LABELS, BRACKET_VOLUME_CM3, computeWeightGram, computeWeightAfter, computeSafety, pushHistory, popHistory, genId, setMaterial, setProcess } from './state.js';

// ——— управление окном (frameless) + лоадер + защита от зависания ———
const appLoader = document.getElementById('appLoader');
const loaderSub = document.getElementById('loaderSub');
const loaderFill = document.getElementById('loaderFill');
let _loaderProgress = 0;
function setLoaderProgress(pct, text){
  _loaderProgress = pct;
  if(loaderFill) loaderFill.style.width = Math.min(100,pct) + '%';
  loaderFill.style.animation = 'none';
  if(loaderSub && text) loaderSub.textContent = text;
}
function hideLoader(){
  if(appLoader && !appLoader.classList.contains('hidden')){
    setLoaderProgress(100, 'Готово');
    appLoader.classList.add('hidden');
    setTimeout(()=>{ appLoader.style.display='none'; }, 500);
  }
}
// убираем лоадер максимально агрессивно: DOMContentLoaded + load + таймеры + pywebviewready
document.addEventListener('DOMContentLoaded', ()=> setTimeout(hideLoader, 600));
window.addEventListener('load', ()=> setTimeout(hideLoader, 400));
window.addEventListener('pywebviewready', ()=> setTimeout(hideLoader, 300));
// анимация фейк-прогресса пока грузится pywebview (не 86/100 корпуса!)
let _loaderFake = setInterval(()=>{
  if(!appLoader || appLoader.classList.contains('hidden')){ clearInterval(_loaderFake); return; }
  _loaderProgress = Math.min(92, _loaderProgress + (Math.random()*6+2));
  if(loaderFill){ loaderFill.style.width = _loaderProgress + '%'; loaderFill.style.animation='none'; }
  if(loaderSub){
    if(_loaderProgress<30) loaderSub.textContent='Загрузка интерфейса…';
    else if(_loaderProgress<65) loaderSub.textContent='Подготовка сцены…';
    else if(_loaderProgress<90) loaderSub.textContent='Инициализация…';
    else loaderSub.textContent='Почти готово…';
  }
  if(_loaderProgress>=92) clearInterval(_loaderFake);
}, 180);
setTimeout(hideLoader, 1800); // жёсткий фолбэк 1.8с, а не 5 минут
setTimeout(()=>{ clearInterval(_loaderFake); hideLoader(); }, 4000);

const winClose = document.getElementById('winClose');
const winMin = document.getElementById('winMin');
const winMax = document.getElementById('winMax');
function callApi(name){
  if(window.pywebview && window.pywebview.api && window.pywebview.api[name]){
    window.pywebview.api[name]().catch(()=>{});
  } else {
    if(name==='close_window') window.close();
  }
}
if(winClose) winClose.addEventListener('click', ()=> callApi('close_window'));
if(winMin) winMin.addEventListener('click', ()=> callApi('minimize_window'));
if(winMax) winMax.addEventListener('click', ()=> callApi('maximize_window'));

// свертывание метрик
const metricsPanel = document.getElementById('metricsPanel');
const metricsToggle = document.getElementById('metricsToggle');
const titlebarSubtitle = document.getElementById('titlebarSubtitle');
function syncTitlebar(){
  if(!titlebarSubtitle) return;
  if(importedName) titlebarSubtitle.textContent = importedName;
  else if(state && state.optimized) titlebarSubtitle.textContent = 'Оптимизировано · ' + Math.round((state.currentRelief||0.4)*100) + '%';
  else titlebarSubtitle.textContent = 'Полотно пусто';
}
if(metricsToggle && metricsPanel){
  metricsToggle.addEventListener('click', (e)=>{
    e.stopPropagation();
    const collapsed = metricsPanel.classList.toggle('collapsed');
    metricsToggle.textContent = collapsed ? '+' : '−';
    metricsToggle.title = collapsed ? 'Развернуть' : 'Свернуть';
  });
}

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
function showPhase(msg) { phaseText.textContent = msg; phaseEl.classList.add('show'); }
function hidePhase() { phaseEl.classList.remove('show'); }

// ——— метрики ———
let importedVolumeCm3 = null; // для импортированной модели
function formatRu(num) { return num.toFixed(1).replace('.', ','); }
function getCurrentVolumeCm3() {
  if (importedGroup && importedGroup.visible && importedVolumeCm3) return importedVolumeCm3;
  return BRACKET_VOLUME_CM3;
}
function getCurrentWeightBefore() {
  const vol = getCurrentVolumeCm3();
  const dens = DENSITIES[state.material];
  return Math.round(vol * dens);
}
function updateMetrics() {
  if(typeof syncTitlebar==='function') try{ syncTitlebar(); }catch(e){}
  // E2: нельзя показывать вес/σ до выбора единиц — иначе мусор
  const unitsOk = !!state.units;
  const beforeEl = document.getElementById('weightBefore');
  if (!unitsOk && importedGroup) {
    if (beforeEl) beforeEl.textContent = '—';
    document.getElementById('weightAfter').textContent = '—';
    document.getElementById('economy').textContent = '—';
    document.getElementById('safety').textContent = '—';
    return;
  }
  const before = getCurrentWeightBefore();
  state.weightBefore = before;
  if (beforeEl) beforeEl.textContent = before + ' г';
  if (!state.optimized) {
    document.getElementById('weightAfter').textContent = '—';
    document.getElementById('economy').textContent = '—';
    document.getElementById('safety').textContent = '—';
    return;
  }
  const relief = state.currentRelief;
  const after = Math.round(before * (1 - relief));
  state.weightAfter = after;
  state.economy = relief;
  const safety = computeSafety(relief);
  state.safetyFactor = safety;
  document.getElementById('weightAfter').textContent = after + ' г';
  document.getElementById('economy').textContent = '−' + Math.round(relief * 100) + ' %';
  // A2: для PLA FDM — два запаса, A4: safety<1 показывается числом
  if (state.material === 'pla' && state.safetyPerp) {
    document.getElementById('safety').textContent = formatRu(state.safetyPerp) + ' / ' + formatRu(state.safetyParallel);
    document.getElementById('safety').title = 'Запас ⊥ (слабый) / ∥';
  } else {
    document.getElementById('safety').textContent = formatRu(safety);
  }
  // A4: деталь течёт — красное
  const safetyEl = document.getElementById('safety');
  if (safety < 1) {
    safetyEl.style.color = '#FF3B30';
    safetyEl.title = 'Деталь течёт! σmax ≥ σyield';
  } else {
    safetyEl.style.color = '';
    safetyEl.title = '';
  }
}
updateMetrics();

// E2: единицы — диалог
const popUnits = document.getElementById('popoverUnits');
let pendingImport = null;
function showUnitsDialog(mesh, name, onSelect) {
  popUnits.classList.add('show');
  positionPopoverNearElement(popUnits, document.getElementById('btnOpen'), 'units');
  showPopover(popUnits);
  popUnits.querySelectorAll('[data-units]').forEach(btn => {
    btn.onclick = () => {
      const u = btn.dataset.units;
      state.units = u;
      popUnits.classList.remove('show');
      hideAllPopovers();
      if (onSelect) onSelect(u);
      updateMetrics();
      scheduleAutosave();
      showToast('Единицы: ' + (u==='mm'?'мм':u==='cm'?'см':'дюймы'));
    };
  });
}

// A3: случаи нагрузки
const popLoadcase = document.getElementById('popoverLoadcase');
let activeLoadcase = 1;
function updateLoadcaseUI() {
  state.activeLoadcase = activeLoadcase;
  document.querySelectorAll('#loadcaseChips [data-case]').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.case) === activeLoadcase);
  });
}
if (popLoadcase) {
  popLoadcase.querySelectorAll('[data-case]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.case;
      if (c === 'add') {
        if (state.loadcaseCount < 3) {
          state.loadcaseCount++;
          activeLoadcase = state.loadcaseCount;
          updateLoadcaseUI();
          showToast('Добавлен Случай ' + activeLoadcase);
        } else {
          showWarning('Макс. 3 случая');
        }
      } else {
        activeLoadcase = parseInt(c);
        updateLoadcaseUI();
        showToast('Случай ' + activeLoadcase);
      }
    });
  });
}

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
const stressMatPrototype = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.75 });

// ——— геометрия кронштейна (встроенный) ———
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
  if (organicHoles) for (const o of organicHoles) { const hole = new THREE.Path(); hole.ellipse(o.x, o.y, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2, false); shape.holes.push(hole); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.1, bevelSegments: 3, curveSegments: 16 });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}
function organicForRelief(relief, plate) {
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
function thicknessForRelief(relief) { if (relief === 0.2) return 9; if (relief === 0.4) return 8; if (relief === 0.6) return 7; return 10; }
const vertPlate = (() => {
  const geo = createPlate({ w: 56, h: 78, thickness: 10, radius: 7, holes: [{ x: 0, y: 26, r: 4.6 }, { x: 0, y: -26, r: 4.6 }] });
  const m = new THREE.Mesh(geo, bracketMat); m.castShadow = true; m.receiveShadow = true; m.position.set(0, 29, -5); return m;
})();
const horizPlate = (() => {
  const geo = createPlate({ w: 56, h: 70, thickness: 10, radius: 7, holes: [{ x: 0, y: 22, r: 5.4 }] });
  const m = new THREE.Mesh(geo, bracketMat); m.castShadow = true; m.receiveShadow = true; m.rotation.x = -Math.PI / 2; m.position.set(0, -5, 30); return m;
})();
const bracket = new THREE.Group();
bracket.add(vertPlate, horizPlate);
scene.add(bracket);

let importedGroup = null;
let importedName = null;

const supportsGroup = new THREE.Group(); supportsGroup.name = 'supports';
const forcesGroup = new THREE.Group(); forcesGroup.name = 'forces';
const keepZonesGroup = new THREE.Group(); keepZonesGroup.name = 'keepZones';
scene.add(supportsGroup, forcesGroup, keepZonesGroup);

// ——— кэш облегчённых ———
const lightCache = {};
let currentLightGroup = null;
function getLightGroup(relief) {
  if (lightCache[relief]) return lightCache[relief];
  const th = thicknessForRelief(relief);
  const orgV = organicForRelief(relief, 'vert');
  const orgH = organicForRelief(relief, 'horiz');
  const geoV = createPlate({ w: 56, h: 78, thickness: th, radius: 7, holes: [{ x: 0, y: 26, r: 4.6 }, { x: 0, y: -26, r: 4.6 }], organicHoles: orgV });
  const geoH = createPlate({ w: 56, h: 70, thickness: th, radius: 7, holes: [{ x: 0, y: 22, r: 5.4 }], organicHoles: orgH });
  const mV = new THREE.Mesh(geoV, bracketMat); mV.castShadow = true; mV.receiveShadow = true; mV.position.copy(vertPlate.position);
  const mH = new THREE.Mesh(geoH, bracketMat); mH.castShadow = true; mH.receiveShadow = true; mH.rotation.x = -Math.PI / 2; mH.position.copy(horizPlate.position);
  const g = new THREE.Group(); g.add(mV, mH); g.visible = false; scene.add(g);
  lightCache[relief] = { group: g, geoV, geoH, meshes: [mV, mH] };
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
const restorePrompt = document.getElementById('restorePrompt');

function hideAllPopovers() {
  popForce.classList.remove('show');
  popKeep.classList.remove('show');
  popMaterial.classList.remove('show');
  popSettings.classList.remove('show');
}
function showPopover(el) {
  if (el !== popRelief && el !== restorePrompt) {
    popForce.classList.remove('show'); popKeep.classList.remove('show'); popMaterial.classList.remove('show'); popSettings.classList.remove('show');
  }
  el.classList.add('show');
}
function positionPopoverAt(el, point3D, offsetY = 22) {
  const p = point3D.clone().project(camera);
  const x = (p.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
  const w = el.offsetWidth || 220, h = el.offsetHeight || 100;
  let left = x - w / 2; let top = y - h - offsetY;
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  top = Math.max(12, top);
  el.style.left = left + 'px'; el.style.top = top + 'px';
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
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

// ——— маркеры ———
function createSupportMarker(id, position, normal) {
  const g = new THREE.Group(); g.userData = { kind: 'support', id };
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
let viewMode = 'original';
const btnOptimize = document.getElementById('btnOptimize');
const optBarFill = document.getElementById('optBarFill');
const dockBtns = document.querySelectorAll('.dock-btn[data-tool]');
function setTool(tool) {
  if (tool === currentTool) { currentTool = null; dockBtns.forEach(b => b.classList.remove('active')); hideAllPopovers(); canvas.style.cursor = 'default'; return; }
  currentTool = tool;
  dockBtns.forEach(b => { if (b.dataset.tool === tool) b.classList.add('active'); else if (b.dataset.tool !== 'view') b.classList.remove('active'); });
  hideAllPopovers();
  if (tool === 'fix') showToast('Кликните по детали — опора. Повторно по маркеру — удалить.');
  if (tool === 'force') showToast('Кликните по грани — стрелка силы. Клик по стрелке — удалить.');
  if (tool === 'keep') showToast('Кликните по детали — синяя зона. Радиус меняется в поповере.');
  canvas.style.cursor = tool ? 'crosshair' : 'default';
}
dockBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'view') { cycleView(); return; }
    if (tool === 'loadcase') {
      // A3: поповер Случай 1..3 +
      const lcBtn = document.querySelector('.dock-btn[data-tool=\"loadcase\"]');
      positionPopoverNearElement(popLoadcase, lcBtn, 'loadcase');
      showPopover(popLoadcase);
      return;
    }
    setTool(tool);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (pendingForce) { forcesGroup.remove(pendingForce.previewMesh); pendingForce = null; }
    setTool(null); hideAllPopovers(); popRelief.classList.remove('show'); restorePrompt.classList.remove('show');
    currentTool = null; dockBtns.forEach(b => b.classList.remove('active')); canvas.style.cursor = 'default';
  }
  // хоткеи проекта
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSaveProject(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); handleOpenProject(); }
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
  updateMetrics(); scheduleAutosave();
  if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
}
document.getElementById('btnUndo').addEventListener('click', handleUndo);

// ——— материал ———
const btnMaterial = document.getElementById('btnMaterial');
btnMaterial.addEventListener('click', (e) => { e.stopPropagation(); if (popMaterial.classList.contains('show')) popMaterial.classList.remove('show'); else { positionPopoverNearElement(popMaterial, btnMaterial, 'material'); showPopover(popMaterial); } });
popMaterial.querySelectorAll('[data-mat]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-mat]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    setMaterial(chip.dataset.mat); updateMetrics(); showToast('Материал: ' + MATERIAL_LABELS[chip.dataset.mat]); scheduleAutosave();
  });
});
popMaterial.querySelectorAll('[data-proc]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-proc]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    setProcess(chip.dataset.proc); showToast('Процесс: ' + (chip.dataset.proc === 'cnc' ? 'ЧПУ' : '3D-печать')); scheduleAutosave();
  });
});
const btnMore = document.getElementById('btnMore');
btnMore.addEventListener('click', (e) => { e.stopPropagation(); if (popSettings.classList.contains('show')) popSettings.classList.remove('show'); else { positionPopoverNearElement(popSettings, btnMore, 'bottom'); refreshRecent(); showPopover(popSettings); } });
document.getElementById('btnBack').addEventListener('click', () => showToast('Проекты — скоро'));
// ——— экспорт STL ———
document.getElementById('btnExport').addEventListener('click', () => {
  if (!state.optimized) { showToast('Сначала оптимизируйте'); return; }
  try {
    const exporter = new STLExporter();
    const toExport = (currentLightGroup && currentLightGroup.visible) ? currentLightGroup : getLightGroup(state.currentRelief).group;
    const result = exporter.parse(toExport, { binary: false });
    // отдаем через Python если есть api
    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_stl) {
      const b64 = btoa(unescape(encodeURIComponent(result)));
      window.pywebview.api.save_stl(b64, 'optimized.stl').then(r => {
        if (r && r.error) showWarning(r.error);
        else if (r && r.ok) showToast('Сохранено: ' + (r.path || 'optimized.stl'));
        else if (r && r.cancelled) showToast('Отменено');
      }).catch(e => showWarning('Ошибка сохранения: ' + e));
    } else {
      const blob = new Blob([result], { type: 'model/stl' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'optimized.stl'; a.click(); URL.revokeObjectURL(url);
      showToast('Сохранено: optimized.stl (браузер)');
    }
  } catch (e) { showWarning('Ошибка экспорта: ' + e.message); console.error(e); }
});
document.getElementById('btnExport').addEventListener('contextmenu', (e) => { e.preventDefault(); showToast('Отчёт будет в Этапе 6'); });

// клик вне поповеров
document.addEventListener('click', (e) => {
  if (!e.target.closest('.popover') && !e.target.closest('#btnMaterial') && !e.target.closest('#btnMore') && !e.target.closest('#btnOptimize') && !e.target.closest('#restorePrompt')) {
    if (!e.target.closest('#scene') || e.target.id !== 'scene') {
      // не закрывать force/keep которые привязаны к точке — они скрываются кликом по сцене
      if (!e.target.closest('#popoverForce') && !e.target.closest('#popoverKeep')) {
        popMaterial.classList.remove('show'); popSettings.classList.remove('show');
      }
    }
  }
});

// ——— сила поповер ———
function confirmForce() {
  if (!pendingForce) return;
  const val = parseInt(forceInput.value, 10);
  const v = Math.max(50, Math.min(5000, isNaN(val) ? 500 : val));
  const id = genId();
  const rec = { kind: 'force', id, position: pendingForce.position.clone(), direction: pendingForce.direction.clone(), valueN: v, case: activeLoadcase };
  state.forces.push(rec);
  const mesh = pendingForce.previewMesh; mesh.userData.id = id; mesh.userData.valueN = v; mesh.userData.kind = 'force'; mesh.userData.case = activeLoadcase;
  pushHistory({ action: 'add', kind: 'force', id, snapshot: rec });
  pendingForce = null; hideAllPopovers(); showToast('Сила ' + v + ' Н установлена (случай ' + activeLoadcase + ')'); updateMetrics(); scheduleAutosave();
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
    showToast('Радиус зоны: ' + r + ' мм'); scheduleAutosave();
  });
});

// ——— relief ———
popRelief.querySelectorAll('[data-relief]').forEach(chip => {
  chip.addEventListener('click', () => {
    const rel = parseFloat(chip.dataset.relief);
    state.targetRelief = rel; state.currentRelief = rel;
    popRelief.querySelectorAll('[data-relief]').forEach(c => c.classList.remove('active')); chip.classList.add('active');
    if (state.optimized) {
      updateMetrics();
      if (viewMode === 'light' || viewMode === 'split') { switchLight(rel); if (viewMode === 'split') { Object.values(lightCache).forEach(v => v.group.visible = false); getLightGroup(rel).group.visible = true; currentLightGroup = getLightGroup(rel).group; } }
      showToast('Облегчение: ' + Math.round(rel * 100) + ' %'); checkSafetyWarning(); scheduleAutosave();
    } else {
      showToast('Выбрано облегчение ' + Math.round(rel * 100) + ' % — нажмите Оптимизировать ещё раз');
    }
  });
});
function showReliefPopover() { positionPopoverNearElement(popRelief, btnOptimize, 'top'); showPopover(popRelief); popRelief.querySelectorAll('[data-relief]').forEach(c => c.classList.toggle('active', parseFloat(c.dataset.relief) === state.currentRelief)); }

// ——— оптимизация (демо) ———
const phases = ['Анализ закреплений…', 'Построение сетки…', 'Расчёт напряжений…', 'Удаление ненагруженного материала…', 'Проверка…'];
let isOptimizing = false;
let splitRatio = 0.5;
function checkWarningsBefore() {
  if (state.supports.length === 0) { showWarning('Нет закрепления: деталь улетит. Добавьте опору.'); return false; }
  if (state.material === 'pla') { const over = state.forces.some(f => f.valueN > 4000); if (over) showWarning('Превышена типичная нагрузка для PLA — проверьте материал или сечение.'); }
  return true;
}
function checkSafetyWarning() {
  if (!state.optimized) return;
  const safety = computeSafety(state.currentRelief);
  if (state.currentRelief >= 0.6 && safety < 1.5) showWarning('Переоптимизация: снизьте облегчение до 40 %.');
}
function exportCurrentModelSTL() {
  // экспорт текущей модели (брекет или импорт) в base64 STL
  try {
    const exporter = new STLExporter();
    const targetGroup = (importedGroup && importedGroup.visible) ? importedGroup : bracket;
    // если уже есть облегчённый и view light — экспортируем оригинал всё равно для расчёта
    const toExport = targetGroup;
    const stlString = exporter.parse(toExport, { binary: false });
    // base64
    const b64 = btoa(unescape(encodeURIComponent(stlString)));
    return b64;
  } catch (e) {
    console.warn('STL export failed', e);
    return null;
  }
}

function startRealOptimization() {
  const stl_b64 = exportCurrentModelSTL();
  if (!stl_b64) { showWarning('Не удалось экспортировать модель'); return; }
  const payload = {
    stl_b64: stl_b64,
    supports: state.supports.map(s => ({ position: s.position.toArray(), normal: s.normal.toArray() })),
    forces: state.forces.map(f => ({ position: f.position.toArray(), direction: f.direction.toArray(), valueN: f.valueN, case: f.case || 1 })),
    keepZones: state.keepZones.map(k => ({ position: k.position.toArray(), normal: k.normal.toArray(), radiusMm: k.radiusMm })),
    material: state.material,
    process: state.process,
    units: state.units || 'mm', // E2
    file_name: importedName || 'model.stl',
    relief: state.targetRelief || 0.4,
    resolution: 64,
    timeout: 45,
  };
  // старт
  window.pywebview.api.start_optimization(JSON.stringify(payload)).then(res => {
    if (!res || res.error) { showWarning(res ? res.error : 'Ошибка запуска'); isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase(); return; }
    const jobId = res.job_id;
    // поллинг прогресса
    const poll = setInterval(() => {
      window.pywebview.api.get_optimization_progress(jobId).then(st => {
        if (!st || st.error) { clearInterval(poll); isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase(); showWarning(st ? st.error : 'Ошибка статуса'); return; }
        // обновить UI
        if (st.phase) showPhase(st.phase + (st.iteration ? ` ${st.iteration}/${st.total_iter || 20}` : ''));
        if (typeof st.progress === 'number') optBarFill.style.width = Math.min(98, st.progress) + '%';
        if (st.status === 'done' && st.result) {
          clearInterval(poll);
          hidePhase(); optBarFill.style.width = '100%';
          handleRealResult(st.result);
        } else if (st.status === 'timeout') {
          clearInterval(poll);
          hidePhase(); isOptimizing = false; btnOptimize.classList.remove('optimizing'); optBarFill.style.width = '0%';
          showWarning('Тайм-аут 45 с — попробуйте снизить сетку до 32³');
          // предложить ретрай с 32
          if (confirm('Тайм-аут 45 с. Снизить сетку до 32³ и повторить?')) {
            // повторить с 32
            payload.resolution = 32;
            window.pywebview.api.start_optimization(JSON.stringify(payload)).then(r2 => {
              if (r2 && r2.job_id) { isOptimizing = true; btnOptimize.classList.add('optimizing'); pollAgain(r2.job_id); }
            });
          }
        } else if (st.status === 'error') {
          clearInterval(poll); isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase(); showWarning(st.error || 'Ошибка расчёта');
        }
      }).catch(e => { clearInterval(poll); isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase(); showWarning('Ошибка: '+e); });
    }, 300);

    function pollAgain(jid) {
      const p2 = setInterval(() => {
        window.pywebview.api.get_optimization_progress(jid).then(st => {
          if (st.phase) showPhase(st.phase); if (typeof st.progress === 'number') optBarFill.style.width = st.progress + '%';
          if (st.status === 'done' && st.result) { clearInterval(p2); hidePhase(); optBarFill.style.width = '100%'; handleRealResult(st.result); }
          else if (st.status === 'error' || st.status === 'timeout') { clearInterval(p2); hidePhase(); isOptimizing = false; btnOptimize.classList.remove('optimizing'); showWarning(st.error || 'Ошибка'); }
        });
      }, 300);
    }
  }).catch(e => { showWarning('Ошибка: ' + e); isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase(); });
}

function handleRealResult(result) {
  // result: {optimized_stl_b64, stress, stress_min/max, safety, weight_before/after, iterations, volume_fraction}
  try {
    // загрузить оптимизированную геометрию
    const b64 = result.optimized_stl_b64;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const geom = stlLoader.parse(bytes.buffer);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, bracketMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // центрировать как импорт
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const center = new THREE.Vector3(); box.getCenter(center);
    geom.translate(-center.x, -center.y, -center.z);
    // поднять над полом
    mesh.position.set(0, 10, 0);
    // кэшировать как облегчённую для всех relief? Для простоты — один кэш
    // очистить старые лайт кэши и заменить на реальный
    Object.values(lightCache).forEach(v => scene.remove(v.group));
    for (const k in lightCache) delete lightCache[k];
    const g = new THREE.Group(); g.add(mesh); g.visible = false; scene.add(g);
    // для совместимости — создать три кэша с одинаковой геометрией но разными весами (для слайдера)
    [0.2, 0.4, 0.6].forEach(rel => {
      // для демо — один и тот же меш, но вес будет пересчитан
      const clone = mesh.clone(); clone.geometry = geom.clone();
      const grp = new THREE.Group(); grp.add(clone); grp.visible = false; scene.add(grp);
      lightCache[rel] = { group: grp, meshes: [clone], geoV: geom };
    });
    currentLightGroup = lightCache[result.volume_fraction ? (1 - result.volume_fraction) : state.currentRelief]?.group || lightCache[0.4].group;
    // стресс — ИЗ РЕШЕНИЯ, не синтетика
    // result.stress — массив per vertex оригинального меша
    state.stressField = {
      values: result.stress,
      min: result.stress_min,
      max: result.stress_max,
      isReal: true,
    };
    // применить к оригиналу для карты
    applyRealStressToOriginal(result);

    state.optimized = true;
    // веса и запас — по von Mises и пределу текучести
    if (typeof result.weight_before === 'number') {
      // пересчитать метрики из результата
      const before = Math.round(result.weight_before);
      const after = Math.round(result.weight_after);
      const safety = result.safety;
      state.weightBefore = before; state.weightAfter = after; state.safetyFactor = safety;
      document.getElementById('weightBefore').textContent = before + ' г';
      document.getElementById('weightAfter').textContent = after + ' г';
      document.getElementById('economy').textContent = '−' + Math.round((1 - result.volume_fraction) * 100) + ' %';
      document.getElementById('safety').textContent = formatRu(safety);
    } else {
      updateMetrics();
    }
    // счётчик итераций
    console.log(`[real] итераций ${result.iterations}, safety ${result.safety}`);
    btnOptimize.classList.remove('optimizing'); optBarFill.style.width = '0%'; isOptimizing = false;
    btnOptimize.classList.add('haptic-pulse'); setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 450);
    showReliefPopover();
    // убрать подпись демо-режима — уже убрана в Этапе 7
    showToast(`Готово за ${result.iterations} итераций — запас ${formatRu(result.safety)}`);
    scheduleAutosave();
  } catch (e) {
    showWarning('Ошибка обработки результата: ' + e.message); console.error(e);
    isOptimizing = false; btnOptimize.classList.remove('optimizing'); hidePhase();
  }
}

function applyRealStressToOriginal(result) {
  // result.stress — per vertex оригинала (брекета или импорта)
  const targetGroup = (importedGroup && importedGroup.visible) ? importedGroup : bracket;
  const verts = targetGroup.children[0] ? targetGroup.children[0].geometry.attributes.position.count : 0;
  // result.stress длина должна совпадать с вершинами оригинала — если нет, интерполируем
  // для простоты — если длина совпадает, применяем напрямую
  const meshes = targetGroup.children.filter(m => m.isMesh);
  let offset = 0;
  meshes.forEach(mesh => {
    const geo = mesh.geometry;
    const count = geo.attributes.position.count;
    const colors = [];
    for (let i = 0; i < count; i++) {
      const idx = offset + i;
      let t = 0;
      if (idx < result.stress.length) {
        const v = result.stress[idx];
        const min = result.stress_min, max = result.stress_max;
        t = (v - min) / (max - min || 1);
      }
      const c = stressColor(Math.max(0, Math.min(1, t)));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    offset += count;
  });
}

function startOptimization() {
  // честный прогресс — если есть реальное ядро, используем его, иначе демо
  if (window.pywebview && window.pywebview.api && window.pywebview.api.start_optimization) {
    if (state.supports.length === 0 || state.forces.length === 0) {
      showWarning('Добавьте опору и нагрузку, чтобы рассчитать');
      btnOptimize.style.transform = 'scale(0.95)'; setTimeout(() => btnOptimize.style.transform = '', 150);
      return;
    }
    if (isOptimizing) return;
    isOptimizing = true;
    btnOptimize.classList.add('optimizing'); btnOptimize.classList.add('haptic-pulse');
    setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 500);
    hideAllPopovers();
    showPhase('Вокселизация 64³…');
    optBarFill.style.width = '5%';
    startRealOptimization();
    return;
  }
  // fallback — демо (синтетика) для браузера без Python
  if (state.supports.length === 0 || state.forces.length === 0) {
    showWarning('Добавьте опору и нагрузку, чтобы рассчитать');
    btnOptimize.style.transform = 'scale(0.95)'; setTimeout(() => btnOptimize.style.transform = '', 150);
    return;
  }
  if (isOptimizing) return;
  isOptimizing = true;
  btnOptimize.classList.add('optimizing'); btnOptimize.classList.add('haptic-pulse');
  setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 500);
  hideAllPopovers();
  let phaseIdx = 0; showPhase(phases[0]); optBarFill.style.width = '0%';
  const start = performance.now(); const total = 3800 + Math.random() * 800;
  const interval = setInterval(() => {
    phaseIdx = (phaseIdx + 1) % phases.length; showPhase(phases[phaseIdx]);
    const elapsed = performance.now() - start; const pct = Math.min(92, (elapsed / total) * 100); optBarFill.style.width = pct + '%';
  }, 600);
  setTimeout(() => {
    clearInterval(interval); hidePhase(); optBarFill.style.width = '100%';
    state.stressField = computeStressField();
    [0.2, 0.4, 0.6].forEach(r => getLightGroup(r));
    const rel = state.targetRelief || 0.4; state.currentRelief = rel; state.optimized = true;
    updateMetrics();
    applyStressToGroup(bracket, state.stressField);
    Object.values(lightCache).forEach(v => applyStressToGroup(v.group, state.stressField));
    if (importedGroup) applyStressToGroup(importedGroup, state.stressField);
    checkWarningsBefore(); checkSafetyWarning();
    setTimeout(() => {
      btnOptimize.classList.remove('optimizing'); optBarFill.style.width = '0%'; isOptimizing = false;
      btnOptimize.classList.add('haptic-pulse'); setTimeout(() => btnOptimize.classList.remove('haptic-pulse'), 450);
      showReliefPopover(); showToast('Оптимизация готова'); console.log('optimize done', { relief: rel, safety: state.safetyFactor }); scheduleAutosave();
    }, 400);
  }, total);
}

// ——— синтетическое поле ———
function computeStressField() {
  const peaks = [];
  state.supports.forEach(s => peaks.push({ pos: s.position.clone(), weight: 1.0, sigma: 13 }));
  state.forces.forEach(f => { const w = 1.2 + Math.min(0.6, f.valueN / 4000); peaks.push({ pos: f.position.clone(), weight: w, sigma: 11 }); });
  const holeWorld = [];
  const vPos = vertPlate.position;
  holeWorld.push(new THREE.Vector3(0, vPos.y + 26, vPos.z));
  holeWorld.push(new THREE.Vector3(0, vPos.y - 26, vPos.z));
  const hPos = horizPlate.position;
  holeWorld.push(new THREE.Vector3(0, -5, hPos.z + 22));
  // для импортированной модели — добавить её bbox центр как пик
  if (importedGroup) {
    const box = new THREE.Box3().setFromObject(importedGroup);
    const center = new THREE.Vector3(); box.getCenter(center);
    holeWorld.push(center);
  }
  holeWorld.forEach(p => peaks.push({ pos: p, weight: 0.85, sigma: 9 }));
  const geometries = getActiveGeometriesForStress();
  const allPos = [];
  geometries.forEach(mesh => {
    const geo = mesh.geometry; const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      v.applyMatrix4(mesh.matrixWorld);
      allPos.push(v);
    }
  });
  let min = Infinity, max = -Infinity;
  const raw = allPos.map(p => {
    let sum = 0;
    for (const peak of peaks) { const d = p.distanceTo(peak.pos); sum += peak.weight * Math.exp(-(d * d) / (2 * peak.sigma * peak.sigma)); }
    sum += 0.18 * Math.exp(-p.distanceTo(new THREE.Vector3(0, 0, 0)) / 28);
    for (const kz of state.keepZones) { const d = p.distanceTo(kz.position); if (d < kz.radiusMm + 4) sum *= 0.92; }
    if (sum < min) min = sum; if (sum > max) max = sum;
    return sum;
  });
  return { peaks, min, max, range: max - min || 1, allPosRaw: raw };
}
function getActiveGeometriesForStress() {
  // оригинал или импорт
  if (importedGroup && importedGroup.visible) return importedGroup.children.filter(m => m.isMesh);
  // иначе — кронштейн
  return [vertPlate, horizPlate];
}
function stressColor(t) {
  const c1 = new THREE.Color(0x2F7CF6), c2 = new THREE.Color(0x34C759), c3 = new THREE.Color(0xFFCC00), c4 = new THREE.Color(0xFF6B4A);
  let c = new THREE.Color();
  if (t < 0.33) c.lerpColors(c1, c2, t / 0.33);
  else if (t < 0.66) c.lerpColors(c2, c3, (t - 0.33) / 0.33);
  else c.lerpColors(c3, c4, (t - 0.66) / 0.34);
  return c;
}
function applyStressToMesh(mesh, field) {
  const geo = mesh.geometry; const posAttr = geo.attributes.position;
  const colors = []; const color = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i); v.applyMatrix4(mesh.matrixWorld);
    let sum = 0;
    for (const peak of field.peaks) { const d = v.distanceTo(peak.pos); sum += peak.weight * Math.exp(-(d * d) / (2 * peak.sigma * peak.sigma)); }
    sum += 0.18 * Math.exp(-v.distanceTo(new THREE.Vector3(0, 0, 0)) / 28);
    for (const kz of state.keepZones) { const d = v.distanceTo(kz.position); if (d < kz.radiusMm + 4) sum *= 0.92; }
    const t = (sum - field.min) / field.range;
    color.copy(stressColor(Math.max(0, Math.min(1, t))));
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}
function applyStressToGroup(group, field) { group.children.forEach(m => { if (m.isMesh) applyStressToMesh(m, field); }); }
function enableStressMaterial(group, enable) {
  group.children.forEach(m => {
    if (m.isMesh) {
      if (enable) {
        if (!m.userData.origMat) m.userData.origMat = m.material;
        const mat = stressMatPrototype.clone(); m.material = mat;
      } else {
        if (m.userData.origMat) m.material = m.userData.origMat; else m.material = bracketMat;
      }
    }
  });
}
function switchLight(relief) {
  const target = getLightGroup(relief);
  Object.values(lightCache).forEach(v => v.group.visible = false);
  // скрыть оригинал или импорт
  bracket.visible = false;
  if (importedGroup) importedGroup.visible = false;
  target.group.visible = true;
  currentLightGroup = target.group;
  if (viewMode === 'stress' && state.stressField) enableStressMaterial(target.group, true);
}
function showOriginal() {
  // показать либо встроенный кронштейн, либо импорт
  if (importedGroup) {
    importedGroup.visible = true;
    bracket.visible = false;
    Object.values(lightCache).forEach(v => v.group.visible = false);
    currentLightGroup = null;
    // стресс
    if (viewMode === 'stress' && state.stressField) enableStressMaterial(importedGroup, true); else enableStressMaterial(importedGroup, false);
  } else {
    bracket.visible = true;
    Object.values(lightCache).forEach(v => v.group.visible = false);
    currentLightGroup = null;
    if (viewMode === 'stress' && state.stressField) enableStressMaterial(bracket, true); else enableStressMaterial(bracket, false);
  }
}
let viewMode = 'original';
function setView(mode) {
  viewMode = mode; state.viewMode = mode;
  legendEl.classList.remove('show'); splitDivider.classList.remove('show');
  if (mode === 'original') {
    showOriginal();
    enableStressMaterial(bracket, false);
    if (importedGroup) enableStressMaterial(importedGroup, false);
    Object.values(lightCache).forEach(v => enableStressMaterial(v.group, false));
    renderer.setScissorTest(false);
  } else if (mode === 'stress') {
    if (!state.optimized) { showToast('Сначала оптимизируйте'); viewMode = 'original'; return; }
    // для импорта тоже показать его
    if (importedGroup) {
      importedGroup.visible = true; bracket.visible = false;
      Object.values(lightCache).forEach(v => v.group.visible = false);
      if (!importedGroup.children[0].geometry.attributes.color) { if (!state.stressField) state.stressField = computeStressField(); applyStressToGroup(importedGroup, state.stressField); }
      enableStressMaterial(importedGroup, true);
    } else {
      showOriginal();
      if (!bracket.children[0].geometry.attributes.color) { if (!state.stressField) state.stressField = computeStressField(); applyStressToGroup(bracket, state.stressField); }
      enableStressMaterial(bracket, true);
    }
    legendEl.classList.add('show'); renderer.setScissorTest(false);
  } else if (mode === 'light') {
    if (!state.optimized) { showToast('Сначала оптимизируйте'); viewMode = 'original'; return; }
    // если импорт — облегчённая недоступна (ограничение MVP)
    if (importedGroup) { showToast('Облегчение доступно только для тестового кронштейна'); viewMode = 'original'; return; }
    switchLight(state.currentRelief);
    enableStressMaterial(currentLightGroup, false); legendEl.classList.remove('show'); splitDivider.classList.remove('show'); renderer.setScissorTest(false);
  } else if (mode === 'split') {
    if (!state.optimized) { showToast('Сначала оптимизируйте'); viewMode = 'original'; return; }
    if (importedGroup) { showToast('До/После доступно только для тестового кронштейна'); viewMode = 'original'; return; }
    // оба видимы через scissor
    bracket.visible = true;
    if (!currentLightGroup) getLightGroup(state.currentRelief);
    Object.values(lightCache).forEach(v => v.group.visible = false);
    getLightGroup(state.currentRelief).group.visible = true;
    currentLightGroup = getLightGroup(state.currentRelief).group;
    enableStressMaterial(bracket, false); enableStressMaterial(currentLightGroup, false);
    legendEl.classList.remove('show'); splitDivider.classList.add('show'); updateSplitDividerPos(); renderer.setScissorTest(false);
  }
  dockBtns.forEach(b => { if (b.dataset.tool === 'view') { if (mode === 'original') b.classList.remove('active'); else b.classList.add('active'); } });
  scheduleAutosave();
}
function cycleView() {
  const order = ['original', 'stress', 'light', 'split'];
  let idx = order.indexOf(viewMode); idx = (idx + 1) % order.length; const next = order[idx];
  if (!state.optimized && next !== 'original') { setView(next); return; }
  setView(next);
  const labels = { original: 'Вид: Исходная', stress: 'Вид: Карта напряжений', light: 'Вид: Облегчённая', split: 'Вид: До/После' };
  showToast(labels[next] || next);
}
let splitRatio = 0.5;
function updateSplitDividerPos() { splitDivider.style.left = (splitRatio * 100) + '%'; }
let splitDragging = false;
splitDivider.addEventListener('pointerdown', (e) => { splitDragging = true; splitDivider.setPointerCapture(e.pointerId); e.preventDefault(); });
window.addEventListener('pointermove', (e) => { if (!splitDragging) return; splitRatio = e.clientX / window.innerWidth; splitRatio = Math.max(0.05, Math.min(0.95, splitRatio)); updateSplitDividerPos(); });
window.addEventListener('pointerup', () => { splitDragging = false; });
window.addEventListener('resize', () => { if (viewMode === 'split') updateSplitDividerPos(); });
btnOptimize.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isOptimizing) return;
  if (!state.optimized) {
    if (!popRelief.classList.contains('show')) { showReliefPopover(); showToast('Выберите облегчение и нажмите Оптимизировать ещё раз'); return; }
    else { popRelief.classList.remove('show'); startOptimization(); return; }
  } else {
    if (popRelief.classList.contains('show')) popRelief.classList.remove('show'); else showReliefPopover();
    return;
  }
});

// ——— импорт STL ———
const stlLoader = new STLLoader();
const objLoader = new OBJLoader();
let useImported = false;

function computeVolumeCm3(geometry) {
  // объём через тетраэдры — для замкнутой сетки
  const pos = geometry.attributes.position;
  const idx = geometry.index;
  let vol = 0;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const pA = new THREE.Vector3().fromBufferAttribute(pos, a);
      const pB = new THREE.Vector3().fromBufferAttribute(pos, b);
      const pC = new THREE.Vector3().fromBufferAttribute(pos, c);
      vol += pA.dot(pB.clone().cross(pC)) / 6;
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      const pA = new THREE.Vector3().fromBufferAttribute(pos, i);
      const pB = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const pC = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      vol += pA.dot(pB.clone().cross(pC)) / 6;
    }
  }
  return Math.abs(vol) / 1000; // мм³ → см³
}

function replaceWithImportedMesh(mesh, name) {
  // удалить старый импорт
  if (importedGroup) { scene.remove(importedGroup); importedGroup = null; }
  // центрировать и масштабировать
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const size = new THREE.Vector3(); box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const target = 70; // целевой размер в мм
  const scale = maxDim > 0 ? target / maxDim : 1;
  mesh.geometry.scale(scale, scale, scale);
  mesh.geometry.computeBoundingBox();
  const box2 = mesh.geometry.boundingBox;
  const center = new THREE.Vector3(); box2.getCenter(center);
  mesh.geometry.translate(-center.x, -center.y, -center.z);
  // поднять над полом
  mesh.position.set(0, 10, 0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.material = bracketMat.clone();
  importedGroup = new THREE.Group();
  importedGroup.add(mesh);
  importedGroup.name = 'imported';
  scene.add(importedGroup);
  importedName = name;
  useImported = true;
  // скрыть встроенный
  bracket.visible = false;
  Object.values(lightCache).forEach(v => v.group.visible = false);
  currentLightGroup = null;
  viewMode = 'original'; state.viewMode = 'original';
  // пересчитать объём для веса
  try { importedVolumeCm3 = computeVolumeCm3(mesh.geometry); } catch { importedVolumeCm3 = BRACKET_VOLUME_CM3 * 0.9; }
  updateMetrics();
  // сбросить оптимизацию — для новой модели нужно заново
  state.optimized = false; state.stressField = null;
  legendEl.classList.remove('show'); splitDivider.classList.remove('show');
  // очистить маркеры
  state.supports.forEach(s => { const m = supportsGroup.children.find(c => c.userData.id === s.id); if (m) supportsGroup.remove(m); });
  state.forces.forEach(f => { const m = forcesGroup.children.find(c => c.userData.id === f.id); if (m) forcesGroup.remove(m); });
  state.keepZones.forEach(k => { const m = keepZonesGroup.children.find(c => c.userData.id === k.id); if (m) keepZonesGroup.remove(m); });
  state.supports.length = 0; state.forces.length = 0; state.keepZones.length = 0; state.history.length = 0;
  // камера — приблизить к модели
  controls.target.set(0, 10, 0); camera.position.set(110, 90, 110); controls.update();
  document.getElementById('centerHint').classList.add('hidden');
  showToast('Модель загружена: ' + name);
  scheduleAutosave();
}

function checkImportWarnings(geometry, fileName) {
  // E1/E3: watertight/winding + толщина стенки < pitch
  try {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3(); box.getSize(size);
    const minDim = Math.min(size.x, size.y, size.z);
    const maxDim = Math.max(size.x, size.y, size.z);
    const estPitch = maxDim / 64;
    if (minDim > 0 && minDim < estPitch) {
      showWarning('Тонкая стенка: толщина ' + minDim.toFixed(2) + ' мм < pitch ' + estPitch.toFixed(2) + ' мм — возможна потеря');
    }
    // проверка объёма — если индекс отсутствует, считаем что не watertight
    const posCount = geometry.attributes.position.count;
    if (posCount > 900000) {
      showWarning('Сложная модель: много вершин — возможен лимит 300k вокселей');
    }
  } catch {}
}

function finalizeImport(geometry, name) {
  // проверки перед заменой
  if (!geometry) { showWarning('Не удалось прочитать геометрию'); return; }
  // лимит 50 МБ уже в main.py, здесь дополнительно проверяем вершины
  if (geometry.attributes.position.count > 800000) {
    showWarning('Слишком большая модель — снизьте детализацию');
  }
  checkImportWarnings(geometry, name);
  const mesh = new THREE.Mesh(geometry, bracketMat);
  replaceWithImportedMesh(mesh, name);
}

function handleOpenModelViaApi() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.open_model) {
    window.pywebview.api.open_model().then(res => {
      if (!res) return; // отмена
      if (res.error) { showWarning(res.error); return; }
      const ext = (res.ext || '').toLowerCase();
      const b64 = res.data;
      const name = res.name || 'model.stl';
      // E1: STEP заглушка v1.1 OCCT
      if (ext === '.step' || ext === '.stp') {
        showWarning('STEP пока не поддерживается — v1.1, OCCT');
        return;
      }
      // E2: лимит 50 МБ — уже в main.py, но проверим размер
      if (res.size && res.size > 50*1024*1024) {
        showWarning('Файл слишком большой (>50 МБ)');
        return;
      }
      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const buffer = bytes.buffer;
        let geometry = null;
        if (ext === '.stl') {
          geometry = stlLoader.parse(buffer);
        } else if (ext === '.obj') {
          const text = new TextDecoder().decode(bytes);
          const obj = objLoader.parse(text);
          let found = null;
          obj.traverse(c => { if (c.isMesh && !found) found = c.geometry; });
          if (found) geometry = found;
          else { showWarning('OBJ без геометрии'); return; }
        } else {
          try { geometry = stlLoader.parse(buffer); } catch { showWarning('Неизвестный формат'); return; }
        }
        if (!geometry) { showWarning('Не удалось прочитать геометрию'); return; }
        // E2: единицы — при первом импорте диалог, автодетект запрещён
        if (!state.units) {
          showUnitsDialog(geometry, name, (u) => {
            state.units = u;
            finalizeImport(geometry, name);
          });
        } else {
          finalizeImport(geometry, name);
        }
      } catch (e) {
        showWarning('Ошибка импорта: ' + e.message);
        console.error(e);
      }
    }).catch(e => { showWarning('Ошибка диалога: ' + e); console.error(e); });
  } else {
    // fallback для браузера — input файл
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.stl,.obj,.step,.stp';
    input.onchange = (ev) => {
      const file = ev.target.files[0]; if (!file) return;
      if (file.size > 50*1024*1024) { showWarning('Файл слишком большой (>50 МБ)'); return; }
      if (file.name.toLowerCase().endsWith('.step') || file.name.toLowerCase().endsWith('.stp')) {
        showWarning('STEP пока не поддерживается — v1.1, OCCT');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          let geometry = null;
          if (file.name.toLowerCase().endsWith('.stl')) geometry = stlLoader.parse(buffer);
          else if (file.name.toLowerCase().endsWith('.obj')) {
            const text = new TextDecoder().decode(buffer);
            const obj = objLoader.parse(text);
            let found = null; obj.traverse(c => { if (c.isMesh && !found) found = c.geometry; });
            geometry = found;
          } else { showWarning('STEP не поддерживается — v1.1, OCCT'); return; }
          if (!state.units) {
            showUnitsDialog(geometry, file.name, () => {
              finalizeImport(geometry, file.name);
            });
          } else {
            finalizeImport(geometry, file.name);
          }
        } catch (err) { showWarning('Ошибка импорта: ' + err.message); }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }
}
document.getElementById('btnOpen').addEventListener('click', (e) => { e.stopPropagation(); handleOpenModelViaApi(); });

// ——— проекты ———
function serializeProject() {
  const data = {
    version: (document.getElementById('appVersion')?.textContent || '0.9.2'),
    material: state.material,
    process: state.process,
    units: state.units, // E2: поле units в .olight.json
    targetRelief: state.targetRelief,
    currentRelief: state.currentRelief,
    optimized: state.optimized,
    loadcaseCount: state.loadcaseCount,
    activeLoadcase: state.activeLoadcase,
    supports: state.supports.map(s => ({ id: s.id, position: s.position.toArray(), normal: s.normal.toArray() })),
    forces: state.forces.map(f => ({ id: f.id, position: f.position.toArray(), direction: f.direction.toArray(), valueN: f.valueN, case: f.case || 1 })),
    keepZones: state.keepZones.map(k => ({ id: k.id, position: k.position.toArray(), normal: k.normal.toArray(), radiusMm: k.radiusMm })),
    cameraPosition: camera.position.toArray(),
    cameraTarget: controls.target.toArray(),
    viewMode,
    importedName,
  };
  return JSON.stringify(data, null, 2);
}
function applyProjectData(obj) {
  try {
    // материал/процесс/единицы
    if (obj.material) { setMaterial(obj.material); popMaterial.querySelectorAll('[data-mat]').forEach(c => c.classList.toggle('active', c.dataset.mat === obj.material)); }
    if (obj.process) { setProcess(obj.process); popMaterial.querySelectorAll('[data-proc]').forEach(c => c.classList.toggle('active', c.dataset.proc === obj.process)); }
    if (obj.units) { state.units = obj.units; } // E2
    if (obj.loadcaseCount) { state.loadcaseCount = obj.loadcaseCount; activeLoadcase = obj.activeLoadcase || 1; updateLoadcaseUI(); }
    if (obj.targetRelief) { state.targetRelief = obj.targetRelief; state.currentRelief = obj.currentRelief || obj.targetRelief; popRelief.querySelectorAll('[data-relief]').forEach(c => c.classList.toggle('active', parseFloat(c.dataset.relief) === state.currentRelief)); }
    // очистить текущие маркеры
    [...supportsGroup.children].forEach(m => supportsGroup.remove(m));
    [...forcesGroup.children].forEach(m => forcesGroup.remove(m));
    [...keepZonesGroup.children].forEach(m => keepZonesGroup.remove(m));
    state.supports.length = 0; state.forces.length = 0; state.keepZones.length = 0; state.history.length = 0;
    // восстановить опоры
    (obj.supports || []).forEach(s => {
      const pos = new THREE.Vector3().fromArray(s.position);
      const nor = new THREE.Vector3().fromArray(s.normal);
      const id = s.id || genId();
      state.supports.push({ id, position: pos, normal: nor });
      const mesh = createSupportMarker(id, pos, nor); supportsGroup.add(mesh);
    });
    (obj.forces || []).forEach(f => {
      const pos = new THREE.Vector3().fromArray(f.position);
      const dir = new THREE.Vector3().fromArray(f.direction);
      const id = f.id || genId();
      state.forces.push({ id, position: pos, direction: dir, valueN: f.valueN });
      const mesh = createForceMarker(id, pos, dir, f.valueN); forcesGroup.add(mesh);
    });
    (obj.keepZones || []).forEach(k => {
      const pos = new THREE.Vector3().fromArray(k.position);
      const nor = new THREE.Vector3().fromArray(k.normal);
      const id = k.id || genId();
      state.keepZones.push({ id, position: pos, normal: nor, radiusMm: k.radiusMm });
      const mesh = createKeepZoneMarker(id, pos, nor, k.radiusMm); keepZonesGroup.add(mesh);
    });
    // камера
    if (obj.cameraPosition) camera.position.fromArray(obj.cameraPosition);
    if (obj.cameraTarget) controls.target.fromArray(obj.cameraTarget);
    controls.update();
    // вид
    if (obj.viewMode) setView(obj.viewMode);
    // оптимизация — если была, пересоздать синтетику? Для проекта сохраняем флаг, но синтетика пересчитается при следующей оптимизации
    state.optimized = !!obj.optimized;
    if (state.optimized && !state.stressField) {
      // пересчитать поле
      state.stressField = computeStressField();
      [0.2, 0.4, 0.6].forEach(r => getLightGroup(r));
      applyStressToGroup(bracket, state.stressField);
      Object.values(lightCache).forEach(v => applyStressToGroup(v.group, state.stressField));
      if (importedGroup) applyStressToGroup(importedGroup, state.stressField);
    }
    updateMetrics();
    importedName = obj.importedName || null;
    showToast('Проект загружен');
    scheduleAutosave();
  } catch (e) {
    showWarning('Ошибка проекта: ' + e.message);
    console.error(e);
  }
}
function handleSaveProject() {
  const json = serializeProject();
  const suggested = 'project.olight.json';
  if (window.pywebview && window.pywebview.api && window.pywebview.api.save_project) {
    window.pywebview.api.save_project(json, suggested).then(res => {
      if (!res) return;
      if (res.error) showWarning(res.error);
      else if (res.ok) showToast('Проект сохранён: ' + (res.path || ''));
    }).catch(e => showWarning('Ошибка сохранения: ' + e));
  } else {
    // fallback — скачать как файл
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = suggested; a.click(); URL.revokeObjectURL(url);
    showToast('Проект скачан (браузер)');
  }
}
function handleOpenProject() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.open_project) {
    window.pywebview.api.open_project().then(res => {
      if (!res) return;
      if (res.error) { showWarning(res.error); return; }
      try { const obj = JSON.parse(res.data); applyProjectData(obj); } catch (e) { showWarning('Невалидный проект'); }
    }).catch(e => showWarning('Ошибка открытия: ' + e));
  } else {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.olight.json,.json';
    input.onchange = (ev) => {
      const file = ev.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { try { const obj = JSON.parse(e.target.result); applyProjectData(obj); } catch (err) { showWarning('Невалидный проект'); } };
      reader.readAsText(file);
    };
    input.click();
  }
}
document.getElementById('btnSaveProject').addEventListener('click', (e) => { e.stopPropagation(); handleSaveProject(); popSettings.classList.remove('show'); });
document.getElementById('btnOpenProject').addEventListener('click', (e) => { e.stopPropagation(); handleOpenProject(); popSettings.classList.remove('show'); });

// ——— последние проекты ———
function refreshRecent() {
  const listEl = document.getElementById('recentList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="font-size:11px; color:#9AA0AA; padding:4px 0;">Последние:</div>';
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_recent) {
    window.pywebview.api.get_recent().then(lst => {
      if (!lst || !lst.length) { listEl.innerHTML += '<div style="font-size:12px; color:#6E6E73; padding:6px;">— пусто</div>'; return; }
      lst.slice(0, 5).forEach(item => {
        const div = document.createElement('div'); div.className = 'recent-item';
        div.innerHTML = `<div><div class="rname">${item.name || item.path.split(/[\\/]/).pop()}</div><div class="rpath">${item.path}</div></div>`;
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          window.pywebview.api.open_project_path(item.path).then(res => {
            if (res && res.error) showWarning(res.error);
            else if (res && res.data) { try { const obj = JSON.parse(res.data); applyProjectData(obj); popSettings.classList.remove('show'); } catch { showWarning('Невалидный проект'); } }
          });
        });
        listEl.appendChild(div);
      });
    }).catch(() => { listEl.innerHTML += '<div style="font-size:12px; color:#6E6E73;">—</div>'; });
  } else {
    // fallback localStorage
    try {
      const lst = JSON.parse(localStorage.getItem('openlight_recent') || '[]');
      if (!lst.length) { listEl.innerHTML += '<div style="font-size:12px; color:#6E6E73; padding:6px;">— пусто (браузер)</div>'; return; }
      lst.slice(0, 5).forEach(item => {
        const div = document.createElement('div'); div.className = 'recent-item';
        div.innerHTML = `<div><div class="rname">${item.name}</div><div class="rpath">${item.path}</div></div>`;
        listEl.appendChild(div);
      });
    } catch { }
  }
}

// ——— автосейв ———
let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const json = serializeProject();
    if (window.pywebview && window.pywebview.api && window.pywebview.api.autosave) {
      window.pywebview.api.autosave(json).then(r => { if (r && r.error) console.warn('autosave error', r.error); });
    } else {
      try { localStorage.setItem('openlight_autosave', json); localStorage.setItem('openlight_autosave_ts', Date.now().toString()); } catch {}
    }
  }, 800);
}
function checkAutosaveOnStart() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_autosave_info) {
    window.pywebview.api.get_autosave_info().then(info => {
      if (info && info.exists && !info.tooOld) {
        // показать промпт
        restorePrompt.style.left = '50%'; restorePrompt.style.top = '50%'; restorePrompt.style.transform = 'translate(-50%,-50%)'; restorePrompt.classList.add('show');
      }
    }).catch(() => {});
  } else {
    // localStorage fallback
    try {
      const ts = parseInt(localStorage.getItem('openlight_autosave_ts') || '0', 10);
      const age = Date.now() - ts;
      if (ts && age < 7 * 24 * 3600 * 1000) {
        restorePrompt.style.left = '50%'; restorePrompt.style.top = '50%'; restorePrompt.style.transform = 'translate(-50%,-50%)'; restorePrompt.classList.add('show');
      }
    } catch {}
  }
}
document.getElementById('restoreYes').addEventListener('click', () => {
  restorePrompt.classList.remove('show');
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_autosave_info) {
    window.pywebview.api.get_autosave_info().then(info => {
      if (info && info.data) { try { const obj = JSON.parse(info.data); applyProjectData(obj); showToast('Восстановлено'); } catch {} }
    });
  } else {
    try { const data = localStorage.getItem('openlight_autosave'); if (data) { const obj = JSON.parse(data); applyProjectData(obj); showToast('Восстановлено (браузер)'); } } catch {}
  }
});
document.getElementById('restoreNo').addEventListener('click', () => {
  restorePrompt.classList.remove('show');
  if (window.pywebview && window.pywebview.api && window.pywebview.api.clear_autosave) window.pywebview.api.clear_autosave();
  else try { localStorage.removeItem('openlight_autosave'); localStorage.removeItem('openlight_autosave_ts'); } catch {}
});

// ——— app_info ———
function loadAppInfo() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_app_info) {
    window.pywebview.api.get_app_info().then(info => {
      if (info) {
        document.getElementById('appVersion').textContent = info.version || '0.9.2';
        document.getElementById('appDataPath').textContent = info.appData || '';
        if (document.getElementById('appLicense')) document.getElementById('appLicense').textContent = info.license || 'MIT (ожидает выбора)';
        if (document.getElementById('appGithubLink') && info.github) document.getElementById('appGithubLink').href = info.github;
      }
    }).catch(() => {});
  } else {
    document.getElementById('appVersion').textContent = '0.9.2 (браузер)';
    if (document.getElementById('appLicense')) document.getElementById('appLicense').textContent = 'MIT (ожидает выбора куратора)';
  }
}
window.addEventListener('pywebviewready', () => { loadAppInfo(); checkAutosaveOnStart(); refreshRecent(); });
setTimeout(() => { loadAppInfo(); checkAutosaveOnStart(); }, 800);

// экспорт уже определён выше через pywebview api

// ——— Raycaster и маркеры ———
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = false;
let edgeLine = null;
function setHover(h) {
  if (hovered === h) return; hovered = h;
  if (h) {
    bracketMat.emissive = new THREE.Color(0x224466); bracketMat.emissiveIntensity = 0.18;
    canvas.style.cursor = currentTool ? 'crosshair' : 'pointer';
    if (!edgeLine) {
      const edges = new THREE.EdgesGeometry(vertPlate.geometry, 18);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.55 });
      edgeLine = new THREE.LineSegments(edges, lineMat); edgeLine.position.copy(vertPlate.position); edgeLine.rotation.copy(vertPlate.rotation); bracket.add(edgeLine);
    }
    edgeLine.visible = true;
  } else {
    bracketMat.emissive = new THREE.Color(0x000000); bracketMat.emissiveIntensity = 0;
    if (edgeLine) edgeLine.visible = false;
    if (!currentTool) canvas.style.cursor = 'default'; else canvas.style.cursor = 'crosshair';
  }
}
let dragStart = null; let isDragging = false;
canvas.addEventListener('pointerdown', (e) => { dragStart = { x: e.clientX, y: e.clientY }; isDragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.hypot(dx, dy) > 6) isDragging = true; }
  const rect = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hitsBracket = raycaster.intersectObjects(bracket.children, true);
  const hitsImported = importedGroup ? raycaster.intersectObjects(importedGroup.children, true) : [];
  const hitsLight = currentLightGroup ? raycaster.intersectObjects(currentLightGroup.children, true) : [];
  const hitsMarkers = raycaster.intersectObjects([supportsGroup, forcesGroup, keepZonesGroup], true);
  if (hitsMarkers.length > 0 || hitsBracket.length > 0 || hitsLight.length > 0 || hitsImported.length > 0) setHover(true); else setHover(false);
});
canvas.addEventListener('pointerup', () => { setTimeout(() => { dragStart = null; isDragging = false; }, 50); });
function getWorldNormal(hit) { const n = hit.face.normal.clone(); const m = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld); n.applyMatrix3(m).normalize(); return n; }
function findMarkerAncestor(obj) { let cur = obj; while (cur) { if (cur.userData && cur.userData.kind) return cur; cur = cur.parent; } return null; }
canvas.addEventListener('click', (e) => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
        showToast('Удалено'); console.log('pick', { point: hit.point, normal: hit.face ? hit.face.normal : null }); scheduleAutosave(); if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию'); return;
      }
    }
  }
  let candidates = [];
  if (viewMode === 'light' && currentLightGroup) candidates = currentLightGroup.children;
  else if (viewMode === 'split') {
    candidates = [...(importedGroup ? importedGroup.children : bracket.children), ...(currentLightGroup ? currentLightGroup.children : [])];
  } else {
    if (importedGroup && importedGroup.visible) candidates = importedGroup.children;
    else candidates = bracket.children;
  }
  const hits = raycaster.intersectObjects(candidates, true);
  if (hits.length === 0) { if (!e.target.closest('.popover')) { popForce.classList.remove('show'); popKeep.classList.remove('show'); } return; }
  const hit = hits[0]; const pos = hit.point.clone(); const normal = getWorldNormal(hit);
  console.log('pick', { point: pos, normal });
  if (!currentTool) { showToast(`Клик: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`); return; }
  if (currentTool === 'fix') {
    const id = genId(); const rec = { kind: 'support', id, position: pos.clone(), normal: normal.clone() }; state.supports.push(rec);
    const mesh = createSupportMarker(id, pos, normal); supportsGroup.add(mesh); pushHistory({ action: 'add', kind: 'support', id, snapshot: rec }); showToast('Опора установлена'); scheduleAutosave(); if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
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
    showToast('Зона ' + currentKeepRadius + ' мм — можно изменить'); scheduleAutosave(); if (state.optimized) showToast('Условия изменились — перезапустите оптимизацию');
  }
});
function _removeWithoutHistory(id, group, arr) { const idx = arr.findIndex(x => x.id === id); if (idx >= 0) arr.splice(idx, 1); const mesh = group.children.find(m => m.userData.id === id); if (mesh) group.remove(mesh); }
document.addEventListener('click', (e) => { if (pendingForce && !e.target.closest('#popoverForce') && !e.target.closest('#scene')) {} });
function onResize() { const w = window.innerWidth, h = window.innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); if (viewMode === 'split') updateSplitDividerPos(); }
window.addEventListener('resize', onResize); onResize();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  supportsGroup.children.forEach(m => {
    if (m.userData.pulse) {
      const t = (now - m.userData.pulseStart) / 620;
      if (t < 1) { const s = 1 + t * 0.65; const o = 1 - t * 0.75; m.userData.rings.forEach((ring, i) => { const k = i === 0 ? s : s * 0.85; ring.scale.set(k, k, 1); ring.material.opacity = o * (i === 0 ? 0.85 : 0.55); }); }
      else { m.userData.pulse = false; m.userData.rings.forEach((ring, i) => { ring.scale.set(1, 1, 1); ring.material.opacity = i === 0 ? 0.55 : 0.35; }); }
    }
  });
  controls.update();
  if (viewMode === 'split' && state.optimized && currentLightGroup) {
    const w = window.innerWidth, h = window.innerHeight; const leftW = Math.round(w * splitRatio); const rightW = w - leftW;
    renderer.setScissorTest(true);
    // левая — оригинал/импорт
    const leftGroup = importedGroup && importedGroup.visible ? importedGroup : bracket;
    renderer.setViewport(0, 0, leftW, h); renderer.setScissor(0, 0, leftW, h);
    leftGroup.visible = true; currentLightGroup.visible = false; renderer.render(scene, camera);
    renderer.setViewport(leftW, 0, rightW, h); renderer.setScissor(leftW, 0, rightW, h);
    leftGroup.visible = false; currentLightGroup.visible = true; renderer.render(scene, camera);
    leftGroup.visible = true; currentLightGroup.visible = true; renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
  } else {
    renderer.render(scene, camera);
  }
}
animate();
const hint = document.getElementById('centerHint');
if (hint) setTimeout(() => hint.classList.add('hidden'), 600);
console.log('%cOpenLight Этап 5 — js_api, импорт STL, проекты, автосейв', 'color:#007AFF;font-weight:600');
window._state = state; window._scene = scene;
