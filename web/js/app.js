// OpenLight — Этап 3: логика опор/сил/запретных зон + состояние
// Комментарии на русском. Локально, без CDN.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, DENSITIES, MATERIAL_LABELS, BRACKET_VOLUME_CM3, computeWeightGram, pushHistory, popHistory, genId, setMaterial, setProcess } from './state.js';

// ——— тост ———
const toastEl = document.getElementById('toast');
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ——— метрики ———
function updateMetrics() {
  const w = computeWeightGram();
  const elBefore = document.getElementById('weightBefore');
  if (elBefore) elBefore.textContent = w + ' г';
  // после оптимизации пока прочерки
}
updateMetrics();

// ——— сцена (из Этапа 2) ———
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
keyLight.shadow.camera.left = -90; keyLight.shadow.camera.right = 90;
keyLight.shadow.camera.top = 90; keyLight.shadow.camera.bottom = -90;
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

// материал кронштейна
const bracketMat = new THREE.MeshStandardMaterial({ color: 0xC9CDD3, metalness: 0.85, roughness: 0.35 });

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
function createPlate({ w, h, thickness, radius, holes }) {
  const shape = roundedRectShape(w, h, radius);
  if (holes) for (const ho of holes) { const hole = new THREE.Path(); hole.absarc(ho.x, ho.y, ho.r, 0, Math.PI * 2, false); shape.holes.push(hole); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.1, bevelSegments: 3, curveSegments: 16 });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, bracketMat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
const vertPlate = createPlate({ w: 56, h: 78, thickness: 10, radius: 7, holes: [{ x: 0, y: 26, r: 4.6 }, { x: 0, y: -26, r: 4.6 }] });
const horizPlate = createPlate({ w: 56, h: 70, thickness: 10, radius: 7, holes: [{ x: 0, y: 22, r: 5.4 }] });
const bracket = new THREE.Group();
vertPlate.position.set(0, 29, -5);
horizPlate.rotation.x = -Math.PI / 2;
horizPlate.position.set(0, -5, 30);
bracket.add(vertPlate, horizPlate);
scene.add(bracket);

// группы маркеров
const supportsGroup = new THREE.Group(); supportsGroup.name = 'supports';
const forcesGroup = new THREE.Group(); forcesGroup.name = 'forces';
const keepZonesGroup = new THREE.Group(); keepZonesGroup.name = 'keepZones';
scene.add(supportsGroup, forcesGroup, keepZonesGroup);

// ——— поповеры ———
const popForce = document.getElementById('popoverForce');
const popKeep = document.getElementById('popoverKeep');
const popMaterial = document.getElementById('popoverMaterial');
const popSettings = document.getElementById('popoverSettings');
const forceInput = document.getElementById('forceInput');

function hideAllPopovers() {
  popForce.classList.remove('show');
  popKeep.classList.remove('show');
  popMaterial.classList.remove('show');
  popSettings.classList.remove('show');
}
function showPopover(el) {
  hideAllPopovers();
  el.classList.add('show');
}
// позиционирование поповера над 3D-точкой
function positionPopoverAt(el, point3D, offsetY = 22) {
  const p = point3D.clone().project(camera);
  const x = (p.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
  // ограничить чтобы не выйти за края
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
  const w = el.offsetWidth || 220, h = el.offsetHeight || 100;
  let left, top;
  if (side === 'top') { left = r.left + r.width / 2 - w / 2; top = r.top - h - 12; }
  else if (side === 'bottom') { left = r.left + r.width / 2 - w / 2; top = r.bottom + 12; }
  else if (side === 'material') { left = r.left; top = r.top - h - 16; }
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  top = Math.max(12, Math.min(window.innerHeight - h - 12, top));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

// ——— создание маркеров ———
// опора — капсула-замок + кольца с пульсацией
function createSupportMarker(id, position, normal) {
  const g = new THREE.Group();
  g.userData = { kind: 'support', id };
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2B2E45, metalness: 0.15, roughness: 0.65 });
  const capMat2 = new THREE.MeshStandardMaterial({ color: 0xE8EBF0, metalness: 0.05, roughness: 0.5 });
  // основание — диск
  const baseGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.8, 20);
  const base = new THREE.Mesh(baseGeo, capMat);
  base.castShadow = true; base.position.y = 0.4;
  // ножка
  const stemGeo = new THREE.CylinderGeometry(1.3, 1.3, 4.2, 16);
  const stem = new THREE.Mesh(stemGeo, capMat2);
  stem.position.y = 3.0;
  // головка — полусфера + цилиндр
  const headGeo = new THREE.CylinderGeometry(2.0, 2.0, 1.2, 16);
  const head = new THREE.Mesh(headGeo, capMat);
  head.position.y = 5.2;
  const domeGeo = new THREE.SphereGeometry(2.0, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, capMat);
  dome.position.y = 5.8;
  // кольца — плоские
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(3.8, 4.6, 32);
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.15;
  const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
  ring2.material.opacity = 0.5;
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.15;
  ring2.scale.set(0.6, 0.6, 0.6);

  const capGroup = new THREE.Group();
  capGroup.add(base, stem, head, dome, ring1, ring2);
  g.add(capGroup);

  // ориентируем Y → нормаль
  const up = new THREE.Vector3(0, 1, 0);
  const n = normal.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(up, n);
  g.quaternion.copy(q);
  g.position.copy(position.clone().add(n.clone().multiplyScalar(0.6)));

  g.userData.rings = [ring1, ring2];
  g.userData.pulseStart = performance.now();
  g.userData.pulse = true;

  // для raycast — добавим невидимый шар-помощник
  const pickGeo = new THREE.SphereGeometry(5, 12, 8);
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const pick = new THREE.Mesh(pickGeo, pickMat);
  pick.userData.kind = 'support-pick';
  g.add(pick);

  return g;
}

// сила — ArrowHelper + невидимый объём для клика
function createForceMarker(id, position, direction, valueN) {
  const dir = direction.clone().normalize();
  const len = 14; // мм
  const g = new THREE.Group();
  g.userData = { kind: 'force', id, valueN };
  const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), len, 0xFF3B30, 3.8, 1.9);
  // линия и конус ArrowHelper внутри
  g.add(arrow);
  // подложка для клика — цилиндр вдоль стрелки
  const pickGeo = new THREE.CylinderGeometry(2.2, 2.2, len, 10);
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const pick = new THREE.Mesh(pickGeo, pickMat);
  // ориентировать pick вдоль dir: ArrowHelper смотрит по Y? Нужно повернуть
  // ArrowHelper по умолчанию смотрит по +Y? На самом деле ArrowHelper создаёт объект повернутый по dir, так что просто сместим
  pick.position.copy(dir.clone().multiplyScalar(len / 2));
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
  pick.quaternion.copy(q);
  g.add(pick);

  g.position.copy(position.clone().add(dir.clone().multiplyScalar(0.2)));
  // сохраним направление
  g.userData.dir = dir.clone();
  g.userData.arrow = arrow;

  // текст-подпись (спрайт) — опционально
  return g;
}

// запретная зона — синий диск/капля
function createKeepZoneMarker(id, position, normal, radiusMm) {
  const g = new THREE.Group();
  g.userData = { kind: 'keep', id, radius: radiusMm, normal: normal.clone() };
  const holder = new THREE.Group();
  const geo = new THREE.CircleGeometry(radiusMm, 36);
  const mat = new THREE.MeshStandardMaterial({ color: 0x007AFF, transparent: true, opacity: 0.22, side: THREE.DoubleSide, metalness: 0, roughness: 1 });
  mat.depthWrite = false;
  const disk = new THREE.Mesh(geo, mat);
  const borderGeo = new THREE.RingGeometry(radiusMm - 0.35, radiusMm + 0.35, 36);
  const borderMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = 0.03;
  holder.add(disk, border);
  // ориентируем Z → нормаль
  const up = new THREE.Vector3(0, 0, 1);
  const n = normal.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(up, n);
  holder.quaternion.copy(q);
  g.add(holder);
  g.position.copy(position.clone().add(n.clone().multiplyScalar(0.35)));
  g.userData.meshes = { disk, border, holder, mat, borderMat };
  // pick helper — тот же диск но прозрачный
  const pickGeo = new THREE.CircleGeometry(radiusMm + 1, 16);
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
  const pick = new THREE.Mesh(pickGeo, pickMat);
  holder.add(pick);
  return g;
}

// ——— состояние инструментов ———
let currentTool = null; // 'fix' | 'force' | 'keep' | null
let pendingForce = null; // {position, direction, previewMesh, point3D}
let currentKeepRadius = 12;
let viewModeIdx = 0;
const viewModes = ['original', 'stress', 'light', 'split'];

// ——— UI: док ———
const dockBtns = document.querySelectorAll('.dock-btn[data-tool]');
function setTool(tool) {
  if (tool === currentTool) {
    // повторный клик — снять
    currentTool = null;
    dockBtns.forEach(b => b.classList.remove('active'));
    hideAllPopovers();
    canvas.style.cursor = 'default';
    return;
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
      // вид — цикл
      viewModeIdx = (viewModeIdx + 1) % viewModes.length;
      const mode = viewModes[viewModeIdx];
      if (mode !== 'original') {
        viewModeIdx = 0;
        showToast('Появится после Этапа 4');
        btn.classList.remove('active');
      } else {
        showToast('Вид: Исходная');
      }
      return;
    }
    setTool(tool);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (pendingForce) {
      forcesGroup.remove(pendingForce.previewMesh);
      pendingForce = null;
    }
    setTool(null);
    hideAllPopovers();
    currentTool = null;
    dockBtns.forEach(b => b.classList.remove('active'));
    canvas.style.cursor = 'default';
  }
});

// ——— Undo ———
function _removeWithoutHistory(id, group, arr) {
  const idx = arr.findIndex(x => x.id === id);
  if (idx >= 0) arr.splice(idx, 1);
  const mesh = group.children.find(m => m.userData.id === id);
  if (mesh) group.remove(mesh);
}
function _reAdd(snapshot) {
  if (!snapshot) return;
  if (snapshot.kind === 'support') {
    state.supports.push(snapshot);
    const m = createSupportMarker(snapshot.id, snapshot.position, snapshot.normal);
    supportsGroup.add(m);
  } else if (snapshot.kind === 'force') {
    state.forces.push(snapshot);
    const m = createForceMarker(snapshot.id, snapshot.position, snapshot.direction, snapshot.valueN);
    forcesGroup.add(m);
  } else if (snapshot.kind === 'keep') {
    state.keepZones.push(snapshot);
    const m = createKeepZoneMarker(snapshot.id, snapshot.position, snapshot.normal, snapshot.radiusMm);
    keepZonesGroup.add(m);
  }
}
function handleUndo() {
  const last = popHistory();
  if (!last) { showToast('Нечего отменять'); return; }
  if (last.action === 'add') {
    if (last.kind === 'support') _removeWithoutHistory(last.id, supportsGroup, state.supports);
    if (last.kind === 'force') _removeWithoutHistory(last.id, forcesGroup, state.forces);
    if (last.kind === 'keep') _removeWithoutHistory(last.id, keepZonesGroup, state.keepZones);
    // закрыть поповеры которые могли остаться
    hideAllPopovers();
    if (pendingForce) { forcesGroup.remove(pendingForce.previewMesh); pendingForce = null; }
    showToast('Отменено');
  } else if (last.action === 'remove') {
    // восстановить
    if (last.kind === 'support') { state.supports.push(last.snapshot); const m = createSupportMarker(last.snapshot.id, last.snapshot.position, last.snapshot.normal); supportsGroup.add(m); }
    if (last.kind === 'force') { state.forces.push(last.snapshot); const m = createForceMarker(last.snapshot.id, last.snapshot.position, last.snapshot.direction, last.snapshot.valueN); forcesGroup.add(m); }
    if (last.kind === 'keep') { state.keepZones.push(last.snapshot); const m = createKeepZoneMarker(last.snapshot.id, last.snapshot.position, last.snapshot.normal, last.snapshot.radiusMm); keepZonesGroup.add(m); }
    showToast('Восстановлено');
  }
  updateMetrics();
}
document.getElementById('btnUndo').addEventListener('click', handleUndo);

// ——— материал ———
const btnMaterial = document.getElementById('btnMaterial');
btnMaterial.addEventListener('click', (e) => {
  e.stopPropagation();
  if (popMaterial.classList.contains('show')) hideAllPopovers();
  else { positionPopoverNearElement(popMaterial, btnMaterial, 'material'); showPopover(popMaterial); }
});
popMaterial.querySelectorAll('[data-mat]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-mat]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    setMaterial(chip.dataset.mat);
    updateMetrics();
    showToast('Материал: ' + MATERIAL_LABELS[chip.dataset.mat]);
  });
});
popMaterial.querySelectorAll('[data-proc]').forEach(chip => {
  chip.addEventListener('click', () => {
    popMaterial.querySelectorAll('[data-proc]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    setProcess(chip.dataset.proc);
    showToast('Процесс: ' + (chip.dataset.proc === 'cnc' ? 'ЧПУ' : '3D-печать'));
  });
});

// ——— настройки (… ) ———
const btnMore = document.getElementById('btnMore');
btnMore.addEventListener('click', (e) => {
  e.stopPropagation();
  if (popSettings.classList.contains('show')) hideAllPopovers();
  else { positionPopoverNearElement(popSettings, btnMore, 'bottom'); showPopover(popSettings); }
});
document.getElementById('btnBack').addEventListener('click', () => showToast('Проекты — скоро'));
document.getElementById('btnExport').addEventListener('click', () => showToast('Экспорт .STL — после оптимизации'));

// клик вне поповера — закрыть (кроме force/keep которые позиционируются у точки)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.popover') && !e.target.closest('#btnMaterial') && !e.target.closest('#btnMore')) {
    // не закрывать force/keep если клик по canvas (они закрываются логикой клика)
    if (!e.target.closest('#scene')) {
      popMaterial.classList.remove('show');
      popSettings.classList.remove('show');
    }
  }
});

// ——— сила — поповер логика ———
function confirmForce() {
  if (!pendingForce) return;
  const val = parseInt(forceInput.value, 10);
  const v = Math.max(50, Math.min(5000, isNaN(val) ? 500 : val));
  const id = genId();
  const rec = { kind: 'force', id, position: pendingForce.position.clone(), direction: pendingForce.direction.clone(), valueN: v };
  state.forces.push(rec);
  // превращаем предпросмотр в постоянный
  const mesh = pendingForce.previewMesh;
  mesh.userData.id = id;
  mesh.userData.valueN = v;
  mesh.userData.kind = 'force';
  // уже в forcesGroup, оставляем
  pushHistory({ action: 'add', kind: 'force', id, snapshot: rec });
  pendingForce = null;
  hideAllPopovers();
  showToast('Сила ' + v + ' Н установлена');
}
document.getElementById('forceOk').addEventListener('click', confirmForce);
forceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmForce(); });
popForce.querySelectorAll('.step-btn').forEach(b => {
  b.addEventListener('click', () => {
    const step = parseInt(b.dataset.step, 10);
    let v = parseInt(forceInput.value, 10) || 500;
    v += step;
    v = Math.max(50, Math.min(5000, Math.round(v / 50) * 50));
    forceInput.value = v;
  });
});

// ——— запретная зона — радиус ———
popKeep.querySelectorAll('[data-r]').forEach(chip => {
  chip.addEventListener('click', () => {
    popKeep.querySelectorAll('[data-r]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const r = parseInt(chip.dataset.r, 10);
    currentKeepRadius = r;
    // если есть последняя созданная зона и поповер был для неё — обновить её радиус
    if (popKeep._targetId) {
      const id = popKeep._targetId;
      const rec = state.keepZones.find(k => k.id === id);
      if (rec) {
        rec.radiusMm = r;
        const mesh = keepZonesGroup.children.find(m => m.userData.id === id);
        if (mesh) {
          // пересоздать геометрию диска
          const holder = mesh.userData.meshes.holder;
          const oldDisk = mesh.userData.meshes.disk;
          const oldBorder = mesh.userData.meshes.border;
          holder.remove(oldDisk, oldBorder);
          const geo = new THREE.CircleGeometry(r, 36);
          const mat = new THREE.MeshStandardMaterial({ color: 0x007AFF, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
          mat.depthWrite = false;
          const disk = new THREE.Mesh(geo, mat);
          const borderGeo = new THREE.RingGeometry(r - 0.35, r + 0.35, 36);
          const borderMat = new THREE.MeshBasicMaterial({ color: 0x007AFF, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
          const border = new THREE.Mesh(borderGeo, borderMat);
          border.position.z = 0.03;
          holder.add(disk, border);
          mesh.userData.meshes.disk = disk; mesh.userData.meshes.border = border;
          mesh.userData.radius = r;
        }
      }
    }
    showToast('Радиус зоны: ' + r + ' мм');
    // оставить поповер открытым для проверки, закроется при следующем клике
  });
});

// ——— Optimize проверка ———
document.getElementById('btnOptimize').addEventListener('click', () => {
  if (state.supports.length === 0 || state.forces.length === 0) {
    showToast('Добавьте опору и нагрузку, чтобы рассчитать');
    const btn = document.getElementById('btnOptimize');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 150);
    return;
  }
  showToast('Оптимизация — расчёт появится на Этапе 4 (имуляция)');
});

// ——— Raycaster и клики ———
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = false;
let edgeLine = null;
function setHover(stateH) {
  if (hovered === stateH) return;
  hovered = stateH;
  if (stateH) {
    bracketMat.emissive = new THREE.Color(0x224466);
    bracketMat.emissiveIntensity = 0.18; // подсветка
    canvas.style.cursor = 'pointer';
    if (!edgeLine) {
      const edges = new THREE.EdgesGeometry(vertPlate.geometry, 18);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.55 });
      edgeLine = new THREE.LineSegments(edges, lineMat);
      edgeLine.position.copy(vertPlate.position);
      edgeLine.rotation.copy(vertPlate.rotation);
      bracket.add(edgeLine);
    }
    edgeLine.visible = true;
  } else {
    bracketMat.emissive = new THREE.Color(0x000000);
    bracketMat.emissiveIntensity = 0;
    if (edgeLine) edgeLine.visible = false;
    // если инструмент активен — держать pointer
    if (!currentTool) canvas.style.cursor = 'default';
    else canvas.style.cursor = 'crosshair';
  }
}

// для отличия drag от клика
let dragStart = null;
let isDragging = false;
canvas.addEventListener('pointerdown', (e) => {
  dragStart = { x: e.clientX, y: e.clientY };
  isDragging = false;
  // скрыть поповеры которые привязаны к точке (force/keep) при начале вращения
  // не скрывать material/settings
});
canvas.addEventListener('pointermove', (e) => {
  if (dragStart) {
    const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 6) isDragging = true;
  }
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // hover — проверяем деталь или маркеры
  const hitsBracket = raycaster.intersectObjects(bracket.children, true);
  const hitsMarkers = raycaster.intersectObjects([supportsGroup, forcesGroup, keepZonesGroup], true);
  if (hitsMarkers.length > 0 || hitsBracket.length > 0) setHover(true);
  else setHover(false);
});
canvas.addEventListener('pointerup', () => {
  setTimeout(() => { dragStart = null; isDragging = false; }, 50);
});

function getWorldNormal(hit) {
  const n = hit.face.normal.clone();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  n.applyMatrix3(normalMatrix).normalize();
  // если брекет — учесть трансформацию группы? matrixWorld уже включает
  return n;
}

function findMarkerAncestor(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.kind) return cur;
    cur = cur.parent;
  }
  return null;
}

canvas.addEventListener('click', (e) => {
  if (isDragging) return; // вращение — не ставить маркер
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // 1) проверка клика по существующему маркеру — удалить
  const hitsMarkers = raycaster.intersectObjects([supportsGroup, forcesGroup, keepZonesGroup], true);
  if (hitsMarkers.length > 0) {
    const hit = hitsMarkers[0];
    const marker = findMarkerAncestor(hit.object);
    if (marker && marker.userData && marker.userData.id) {
      const id = marker.userData.id;
      const kind = marker.userData.kind;
      // найти запись
      let rec = null;
      if (kind === 'support') rec = state.supports.find(s => s.id === id);
      if (kind === 'force') rec = state.forces.find(s => s.id === id);
      if (kind === 'keep') rec = state.keepZones.find(s => s.id === id);
      if (rec) {
        // удалить
        if (kind === 'support') { _removeWithoutHistory(id, supportsGroup, state.supports); pushHistory({ action: 'remove', kind: 'support', id, snapshot: rec }); }
        if (kind === 'force') { _removeWithoutHistory(id, forcesGroup, state.forces); pushHistory({ action: 'remove', kind: 'force', id, snapshot: rec }); }
        if (kind === 'keep') { _removeWithoutHistory(id, keepZonesGroup, state.keepZones); pushHistory({ action: 'remove', kind: 'keep', id, snapshot: rec }); }
        showToast('Удалено');
        console.log('pick', { point: hit.point, normal: hit.face ? hit.face.normal : null });
        return;
      }
    }
  }

  // 2) клик по детали — в зависимости от инструмента
  const hits = raycaster.intersectObjects(bracket.children, true);
  if (hits.length === 0) {
    // клик в пустоту — если был pendingForce — отменить?
    if (pendingForce && !e.target.closest('.popover')) {
      // оставить как есть, ждёт OK
    } else {
      // скрыть поповеры force/keep если клик в пустоту
      if (!e.target.closest('.popover')) {
        popForce.classList.remove('show');
        popKeep.classList.remove('show');
      }
    }
    return;
  }
  const hit = hits[0];
  const pos = hit.point.clone();
  const normal = getWorldNormal(hit);

  console.log('pick', { point: pos, normal });

  if (!currentTool) {
    showToast(`Клик: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
    return;
  }

  if (currentTool === 'fix') {
    const id = genId();
    const rec = { kind: 'support', id, position: pos.clone(), normal: normal.clone() };
    state.supports.push(rec);
    const mesh = createSupportMarker(id, pos, normal);
    supportsGroup.add(mesh);
    pushHistory({ action: 'add', kind: 'support', id, snapshot: rec });
    showToast('Опора установлена');
  } else if (currentTool === 'force') {
    // если уже есть предпросмотр — подтвердить предыдущий? просто заменить
    if (pendingForce) {
      forcesGroup.remove(pendingForce.previewMesh);
    }
    const dir = normal.clone().negate(); // внутрь детали
    const preview = createForceMarker('preview', pos, dir, 500);
    preview.userData.isPreview = true;
    forcesGroup.add(preview);
    pendingForce = { position: pos.clone(), direction: dir.clone(), previewMesh: preview, point3D: pos.clone() };
    // показать поповер
    forceInput.value = 500;
    positionPopoverAt(popForce, pos, 26);
    showPopover(popForce);
    forceInput.focus(); forceInput.select();
  } else if (currentTool === 'keep') {
    const id = genId();
    const rec = { kind: 'keep', id, position: pos.clone(), normal: normal.clone(), radiusMm: currentKeepRadius };
    state.keepZones.push(rec);
    const mesh = createKeepZoneMarker(id, pos, normal, currentKeepRadius);
    keepZonesGroup.add(mesh);
    pushHistory({ action: 'add', kind: 'keep', id, snapshot: rec });
    // показать поповер для смены радиуса этой зоны
    popKeep._targetId = id;
    positionPopoverAt(popKeep, pos, 18);
    showPopover(popKeep);
    // подсветить текущий радиус
    popKeep.querySelectorAll('[data-r]').forEach(c => c.classList.toggle('active', parseInt(c.dataset.r, 10) === currentKeepRadius));
    showToast('Зона ' + currentKeepRadius + ' мм — можно изменить');
  }
});

// клик вне поповера force должен не сразу удалять предпросмотр, а ждать OK или Esc
document.addEventListener('click', (e) => {
  if (pendingForce && !e.target.closest('#popoverForce') && !e.target.closest('#scene')) {
    // если клик по UI не на canvas — не трогать
  }
});

// ——— ресайз и анимация ———
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
onResize();

function animate() {
  requestAnimationFrame(animate);
  // пульсация опор
  const now = performance.now();
  supportsGroup.children.forEach(m => {
    if (m.userData.pulse) {
      const t = (now - m.userData.pulseStart) / 620;
      if (t < 1) {
        const s = 1 + t * 0.65;
        const o = 1 - t * 0.75;
        m.userData.rings.forEach((ring, i) => {
          const k = i === 0 ? s : s * 0.85;
          ring.scale.set(k, k, 1);
          ring.material.opacity = o * (i === 0 ? 0.85 : 0.55);
        });
      } else {
        m.userData.pulse = false;
        m.userData.rings.forEach((ring, i) => {
          ring.scale.set(1, 1, 1);
          ring.material.opacity = i === 0 ? 0.55 : 0.35;
        });
      }
    }
  });
  controls.update();
  renderer.render(scene, camera);
}
animate();

// скрыть подсказку
const hint = document.getElementById('centerHint');
if (hint) setTimeout(() => hint.classList.add('hidden'), 600);

console.log('%cOpenLight Этап 3 — логика опор/сил/зон + Undo', 'color:#007AFF;font-weight:600');
