// OpenLight — Этап 2: 3D сцена с кронштейном
// Комментарии на русском. Все локально, без CDN.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ——— UI тосты (из Этапа 1) ———
const toastEl = document.getElementById('toast');
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
function initUI() {
  const dockBtns = document.querySelectorAll('.dock-btn[data-tool]');
  dockBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dockBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const names = { fix: 'Крепления', force: 'Силы', keep: 'Запретная зона', view: 'Вид / Слои' };
      showToast(`Инструмент: ${names[btn.dataset.tool] || btn.dataset.tool} — появится на Этапе 3`);
    });
  });
  document.getElementById('btnBack').addEventListener('click', () => showToast('Проекты — скоро'));
  document.getElementById('btnUndo').addEventListener('click', () => showToast('Отменить — пока нечего'));
  document.getElementById('btnExport').addEventListener('click', () => showToast('Экспорт .STL — после оптимизации'));
  document.getElementById('btnMore').addEventListener('click', () => showToast('Настройки — скоро'));
  document.getElementById('btnMaterial').addEventListener('click', () => showToast('Материал: Алюминий #C9CDD3 · Сталь · Пластик'));
  document.getElementById('btnOptimize').addEventListener('click', () => {
    showToast('Оптимизация — имитация расчёта появится на Этапе 3');
    const btn = document.getElementById('btnOptimize');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => (btn.style.transform = ''), 150);
  });
}
initUI();

// ——— 3D сцена ———
const canvas = document.getElementById('scene');
const scene = new THREE.Scene();
// фон прозрачный — dot-grid видно сквозь canvas
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// для Retina без перегрузки
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// камера — изометрия
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(115, 95, 115);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 12, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 1.0;
controls.panSpeed = 0.8;
// ЛКМ вращение, колесо зум, ПКМ панорама — по умолчанию так и есть
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};
controls.minDistance = 40;
controls.maxDistance = 350;
controls.update();

// свет
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

// ключевой свет с тенями
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(80, 120, 60);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.type = THREE.PCFSoftShadowMap;
keyLight.shadow.bias = -0.0006;
keyLight.shadow.radius = 4;
// настроить камеру теней под размер детали
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 400;
keyLight.shadow.camera.left = -90;
keyLight.shadow.camera.right = 90;
keyLight.shadow.camera.top = 90;
keyLight.shadow.camera.bottom = -90;
scene.add(keyLight);

// заполняющий без теней
const fillLight = new THREE.DirectionalLight(0xffffff, 0.42);
fillLight.position.set(-65, 45, -80);
fillLight.castShadow = false;
scene.add(fillLight);

// невидимый пол для тени
const floorGeo = new THREE.PlaneGeometry(400, 400);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.18, color: 0x0a0a14 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -10; // чуть ниже нижней грани кронштейна
floor.receiveShadow = true;
scene.add(floor);

// ——— материал кронштейна ———
const bracketMat = new THREE.MeshStandardMaterial({
  color: 0xC9CDD3,
  metalness: 0.85,
  roughness: 0.35,
});

// хелпер: скруглённый прямоугольник
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

// создание пластины через Shape + Extrude с bevel
function createPlate({ w, h, thickness, radius, holes }) {
  const shape = roundedRectShape(w, h, radius);
  if (holes) {
    for (const ho of holes) {
      const hole = new THREE.Path();
      hole.absarc(ho.x, ho.y, ho.r, 0, Math.PI * 2, false);
      shape.holes.push(hole);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 1.1,
    bevelSize: 1.1,
    bevelSegments: 3,
    curveSegments: 16,
  });
  // центрировать по толщине, чтобы pivot был на лицевой стороне
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, bracketMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// вертикальная полка: 56×78×10, r=7, 2 отверстия
const vertPlate = createPlate({
  w: 56, h: 78, thickness: 10, radius: 7,
  holes: [
    { x: 0, y: 26, r: 4.6 },
    { x: 0, y: -26, r: 4.6 },
  ],
});
// горизонтальная полка: 56×70×10, r=7, 1 отверстие
const horizPlate = createPlate({
  w: 56, h: 70, thickness: 10, radius: 7,
  holes: [
    { x: 0, y: 22, r: 5.4 },
  ],
});

// сборка Г-образного кронштейна
// вертикаль стоит в плоскости XY, горизонталь — в XZ (после поворота)
const bracket = new THREE.Group();

// позиционирование полок в группе
// вертикаль: центр (0, 29, -5) — нижний край на y= -10, передняя грань на z=0
vertPlate.position.set(0, 29, -5);
// горизонталь: нужно повернуть на -90° вокруг X, чтобы из XY стала XZ
horizPlate.rotation.x = -Math.PI / 2;
// после поворота горизонталь: центр (0, -5, 30) — верхняя грань на y=0, задняя грань на z=-5 (стык с вертикалью)
horizPlate.position.set(0, -5, 30);

bracket.add(vertPlate);
bracket.add(horizPlate);
// опустить группу к полу: нижняя грань горизонтали на y=-10, пол на y=-10 → тень вплотную
bracket.position.y = 0;

scene.add(bracket);

// подсветка кромок — тонкие линии по рёбрам (скрыты по умолчанию, показываем при hover)
let hovered = false;
let edgeLine = null;
function setHover(state) {
  if (hovered === state) return;
  hovered = state;
  if (state) {
    bracketMat.emissive = new THREE.Color(0x224466);
    bracketMat.emissiveIntensity = 0.18;
    canvas.style.cursor = 'pointer';
    // показать кромки
    if (!edgeLine) {
      const edges = new THREE.EdgesGeometry(vertPlate.geometry, 18);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.55 });
      edgeLine = new THREE.LineSegments(edges, lineMat);
      // копируем трансформ вертикали
      edgeLine.position.copy(vertPlate.position);
      edgeLine.rotation.copy(vertPlate.rotation);
      bracket.add(edgeLine);
    }
    edgeLine.visible = true;
  } else {
    bracketMat.emissive = new THREE.Color(0x000000);
    bracketMat.emissiveIntensity = 0;
    canvas.style.cursor = 'default';
    if (edgeLine) edgeLine.visible = false;
  }
}

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let mouseInside = false;

function onPointerMove(e) {
  // игнорируем если поверх UI-панелей (они выше canvas по z-index, но событие всё равно от canvas только если ховер на canvas)
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(bracket.children, true);
  if (hits.length > 0) {
    setHover(true);
    mouseInside = true;
  } else {
    setHover(false);
    mouseInside = false;
  }
}

function onClick(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(bracket.children, true);
  if (hits.length > 0) {
    const h = hits[0];
    // лог как в ТЗ
    console.log('pick', { point: h.point, normal: h.face ? h.face.normal : null, uv: h.uv });
    showToast(`Клик: ${h.point.x.toFixed(1)}, ${h.point.y.toFixed(1)}, ${h.point.z.toFixed(1)}`);
  }
}

canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('click', onClick);
canvas.addEventListener('pointerleave', () => setHover(false));

// ресайз
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
onResize();

// анимация
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// скрыть центральную подсказку — деталь загружена
const hint = document.getElementById('centerHint');
if (hint) {
  setTimeout(() => hint.classList.add('hidden'), 600);
}

console.log('%cOpenLight Этап 2 — кронштейн, свет и тень готовы', 'color:#007AFF;font-weight:600');
console.log('Подсказка: вращайте ЛКМ, зум колесо, панорама ПКМ. Клик по детали — console.log pick');
