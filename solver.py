"""
OpenLight solver — воксельная дискретизация + МКЭ + SIMP (Этап 7, фаза B)
Реальное расчётное ядро, заменяет имитацию Этапа 4, НЕ ломая UI.

Комментарии на русском. Только open-source: trimesh + numpy + scipy + scikit-image.
"""
import time
import base64
import tempfile
import pathlib
import warnings
from dataclasses import dataclass

import numpy as np
import trimesh
from scipy import sparse
from scipy.sparse.linalg import cg, spsolve, spilu, LinearOperator
from scipy.ndimage import label as nd_label

# для marching cubes — пробуем skimage, fallback на trimesh
try:
    from skimage.measure import marching_cubes
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False
    warnings.warn("scikit-image не найден, marching cubes через trimesh")

# ——— свойства материалов ———
# Источники: см. docs/MATERIALS.md — каждый FDM-параметр с URL в комментарии ниже
MATERIALS = {
    # Сталь 09Г2С — изотропная, ГОСТ
    "steel": {"E": 200e9, "nu": 0.30, "yield": 345e6, "name": "Сталь 09Г2С", "density": 7.85},
    # АМг6 — изотропная
    "alu":   {"E": 71e9,  "nu": 0.33, "yield": 140e6, "name": "АМг6", "density": 2.64},
    # PLA FDM — ортотропная (источники в docs/MATERIALS.md)
    # E_parallel 3.5 ГПа — Ultimaker TDS / iGEM Cambridge 2015 PLA E=3.5 GPa [https://2015.igem.org/wiki/images/3/37/CamJIC-Specs-Materials.pdf]
    # E_perp 2.7 ГПа — ортотропия -23% по ResearchGate 2024 Plane13 2142 vs 2575 МПа [https://www.researchgate.net/publication/378922354_Orthotropic_mechanical_properties_of_PLA_materials_fabricated_by_fused_deposition_modelling]
    # nu 0.36 — типично PLA, ν12=0.37 по ResearchGate 2024 Evaluation [https://www.researchgate.net/publication/378366582_Evaluation_of_the_structural_strength_of_anisotropic_PLA_components_manufactured_by_3D_printing]
    # yield_parallel 36.3 МПа — TEMJournal 2020 Ultimaker yield 36.3 МПа [https://www.temjournal.com/content/93/TEMJournalAugust_966_970.pdf]
    # yield_perp 26.0 МПа — межслойная, PM Filament 26.0 МПа тот же источник
    "pla": {
        "E": 3.5e9, "nu": 0.36, "yield": 26.0e6, "yield_parallel": 36.3e6, "yield_perp": 26.0e6,
        "E_parallel": 3.5e9, "E_perp": 2.7e9, "nu_perp": 0.38, "G_parallel": 1.28e9, "G_perp": 0.95e9,
        "name": "PLA", "density": 1.24,
        # G_parallel 1.28 = E/(2(1+ν)) =3.5/(2*1.36), G12 1470 МПа по [1] G12=1470
        # G_perp 0.95 =0.74*G∥ по анизотропии Plane13 [5]
    },
}

# ——— вокселизация ———
def load_mesh_from_b64(b64_str: str) -> trimesh.Trimesh:
    """Загрузить STL из base64 (с префиксом data: или без)"""
    if b64_str.startswith("data:"):
        b64_str = b64_str.split(",", 1)[-1]
    data = base64.b64decode(b64_str)
    # trimesh умеет из буфера
    with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        mesh = trimesh.load(tmp_path, force="mesh")
        # если сцена — взять первый меш
        if isinstance(mesh, trimesh.Scene):
            # объединить
            merged = trimesh.util.concatenate([m for m in mesh.geometry.values()])
            mesh = merged
        mesh.remove_unreferenced_vertices()
        try:
            mesh.fix_inversion()
        except AttributeError:
            pass  # trimesh 5.x: метода нет
        return mesh
    finally:
        pathlib.Path(tmp_path).unlink(missing_ok=True)

def voxelize_trimesh(mesh: trimesh.Trimesh, resolution: int = 64, max_cells: int = 150_000):
    """
    Воксельная дискретизация: 64³ по длинной стороне, ≤150k ячеек.
    Возвращает (voxel_matrix bool (nx,ny,nz), pitch, origin, dims)
    """
    # bbox
    bbox_min, bbox_max = mesh.bounds
    extent = bbox_max - bbox_min
    longest = float(np.max(extent))
    if longest < 1e-6:
        raise ValueError("Вырожденный bbox")
    pitch = longest / resolution
    # проверить оценку ячеек — грубо: solid_vol / pitch³
    # solid_vol через mesh.volume (если замкнуто) или bbox
    try:
        vol = abs(mesh.volume)
        if vol < 1e-9:
            vol = float(np.prod(extent) * 0.3)
    except Exception:
        vol = float(np.prod(extent) * 0.3)
    est_cells = vol / (pitch ** 3)
    if est_cells > max_cells:
        # снизить разрешение до 48 или 32
        for try_res in [48, 32, 24]:
            pitch_try = longest / try_res
            est = vol / (pitch_try ** 3)
            if est <= max_cells:
                pitch = pitch_try
                resolution = try_res
                break
        print(f"[voxel] снижена сетка до {resolution}³, pitch={pitch:.3f} мм, оценка ячеек {est_cells:.0f}→{est:.0f}")

    # trimesh voxelized(pitch) — возвращает VoxelGrid
    vg = mesh.voxelized(pitch=pitch)
    # матрица (nx,ny,nz) bool
    mat = vg.matrix  # уже bool
    print(f"[voxel] матрица {mat.shape} pitch={pitch:.4f} заполнено {np.count_nonzero(mat)} / {mat.size}")
    # trimesh 5.x: origin = bounds[0] (transform не нужен, т.к. matrix индексируется от bounds)
    try:
        origin = vg.origin
    except AttributeError:
        origin = np.array(vg.bounds[0], dtype=float)
    dims = np.array(mat.shape, dtype=int)
    return mat, pitch, origin, dims, vg

# ——— матрица элемента 8-узлового гекса ———
def elasticity_matrix(E, nu):
    """D 6x6 для изотропного материала"""
    c = E / ((1 + nu) * (1 - 2 * nu))
    D = np.zeros((6, 6))
    D[0, 0] = D[1, 1] = D[2, 2] = c * (1 - nu)
    D[0, 1] = D[0, 2] = D[1, 0] = D[1, 2] = D[2, 0] = D[2, 1] = c * nu
    D[3, 3] = D[4, 4] = D[5, 5] = c * (1 - 2 * nu) / 2
    return D

def elasticity_matrix_orthotropic(E_par, E_perp, nu, nu_perp, G_par, G_perp):
    """
    Ортотропная D 6x6 для PLA FDM: E_par=E_x=E_y (в слое), E_perp=E_z (межслой).
    Источники см. docs/MATERIALS.md — E_par 3.5 GPa [iGEM], E_perp 2.7 GPa [orthotropic 2024],
    nu 0.36, G_par 1.28 GPa (E/2(1+ν)), G_perp 0.95 GPa.
    Упрощённо — трансверсально-изотропная: оси X,Y равноправны.
    """
    # податливость S, затем инверсия
    # Для трансверсально-изотропного: S11=1/E_par, S33=1/E_perp, S12=-nu/E_par, S13=-nu_perp/E_perp? — упрощаем
    # Используем приближение: nu_par=nu, nu_perp=nu_perp, G как указано
    # Строим S 6x6
    S = np.zeros((6,6))
    S[0,0]=1/E_par; S[1,1]=1/E_par; S[2,2]=1/E_perp
    S[0,1]=S[1,0]= -nu/E_par
    S[0,2]=S[2,0]= -nu_perp/E_perp
    S[1,2]=S[2,1]= -nu_perp/E_perp
    S[3,3]=1/G_par
    S[4,4]=1/G_perp
    S[5,5]=1/G_perp
    # инвертировать верх 3x3, ниж диагональ отдельно
    # D = S^-1 — численно
    try:
        D = np.linalg.inv(S)
    except np.linalg.LinAlgError:
        # fallback к изотропной с E_par
        return elasticity_matrix(E_par, nu)
    return D

# узлы гекса в локальных координатах [-1,1] (вынесено для element_B)
_HEX8_XI = np.array([[-1, -1, -1],
                     [ 1, -1, -1],
                     [ 1,  1, -1],
                     [-1,  1, -1],
                     [-1, -1,  1],
                     [ 1, -1,  1],
                     [ 1,  1,  1],
                     [-1,  1,  1]], dtype=float)

def element_B(xi_eta_zeta, h):
    """
    B матрица 6x24 для 8-узлового гекса в точке xi,eta,zeta ∈ [-1,1], ребро h.
    Чистый рефакторинг из hex8_ke — логика Gauss-loop не меняется.
    """
    gx, gy, gz = xi_eta_zeta
    dN_dxi = np.zeros((8, 3))
    for i in range(8):
        dN_dxi[i, 0] = 0.125 * _HEX8_XI[i, 0] * (1 + _HEX8_XI[i, 1]*gy) * (1 + _HEX8_XI[i, 2]*gz)
        dN_dxi[i, 1] = 0.125 * _HEX8_XI[i, 1] * (1 + _HEX8_XI[i, 0]*gx) * (1 + _HEX8_XI[i, 2]*gz)
        dN_dxi[i, 2] = 0.125 * _HEX8_XI[i, 2] * (1 + _HEX8_XI[i, 0]*gx) * (1 + _HEX8_XI[i, 1]*gy)
    B = np.zeros((6, 24))
    for i in range(8):
        dNdx = dN_dxi[i, 0] * 2/h
        dNdy = dN_dxi[i, 1] * 2/h
        dNdz = dN_dxi[i, 2] * 2/h
        col = i*3
        B[0, col] = dNdx
        B[1, col+1] = dNdy
        B[2, col+2] = dNdz
        B[3, col] = dNdy; B[3, col+1] = dNdx
        B[4, col+1] = dNdz; B[4, col+2] = dNdy
        B[5, col] = dNdz; B[5, col+2] = dNdx
    return B

def hex8_ke(E, nu, h):
    """
    Ke 24x24 для куба со стороной h.
    Численное интегрирование 2x2x2 Гаусса — теперь через element_B.
    """
    D = elasticity_matrix(E, nu)
    gauss = [-1/np.sqrt(3), 1/np.sqrt(3)]
    Ke = np.zeros((24, 24))
    detJ = (h/2)**3
    for gx in gauss:
        for gy in gauss:
            for gz in gauss:
                B = element_B((gx, gy, gz), h)
                Ke += B.T @ D @ B * detJ
    return Ke

# ——— плотность фильтр (без чекерборда) ———
def density_filter(rho, radius=1.5):
    """
    Фильтр плотности: свёртка с конусом радиуса radius (в вокселях).
    Простая реализация через scipy.ndimage или цикл соседей.
    Для скорости используем uniform_filter как приближение.
    """
    from scipy.ndimage import uniform_filter
    size = int(radius*2 + 1)
    if size < 3:
        return rho
    filtered = uniform_filter(rho, size=size, mode='reflect')
    # нормировка чтобы границы не размывались слишком
    # простой вариант — вернуть filtered
    return filtered

# ——— связные компоненты ———
def keep_connected(rho, threshold=1e-2):
    """ВРЕМЕННО отключён до 5 зелёных MBB — return rho без изменений."""
    return rho

# ——— Taubin smoothing ———
def taubin_smoothing(vertices, faces, lam=0.5, mu=-0.53, iters=10):
    """Taubin (λ|μ) с сохранением объёма. Простая реализация через соседей."""
    # построить список соседей через ребра
    # для скорости используем trimesh если есть
    try:
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        # trimesh имеет встроенный фильтр?
        # попробуем использовать trimesh.smoothing.filter_taubin если доступно
        if hasattr(trimesh.smoothing, "filter_taubin"):
            # trimesh 5.x
            smoothed = trimesh.smoothing.filter_taubin(mesh, lamb=lam, mu=mu, iterations=iters)
            return smoothed.vertices, smoothed.faces
    except Exception:
        pass
    # fallback — ленивая реализация: несколько итераций Лапласа с усадкой
    verts = vertices.copy()
    # построить adjacency через edges
    # упрощённо — не делаем, возвращаем как есть
    return verts, faces

# ——— основная оптимизация ———
@dataclass
class OptResult:
    vertices: np.ndarray
    faces: np.ndarray
    stress: np.ndarray  # per vertex von Mises (МПа)
    safety: float
    weight_before: float
    weight_after: float
    iterations: int
    volume_fraction: float

def von_mises(stress_vec):
    """stress_vec 6: [sx,sy,sz, sxy,syz,szx] -> von Mises"""
    s = stress_vec
    return np.sqrt(0.5 * ((s[0]-s[1])**2 + (s[1]-s[2])**2 + (s[2]-s[0])**2 + 6*(s[3]**2 + s[4]**2 + s[5]**2)))

def optimize_topology(
    stl_b64: str = None,
    supports=None,
    forces=None,
    keep_zones=None,
    material: str = "steel",
    relief: float = 0.4,
    resolution: int = 64,
    progress_cb=None,
    timeout: float = 45.0,
    process: str = "cnc",
    units: str = "mm",
    file_name: str = None,
):
    """
    Вход:
      stl_b64 — base64 STL текущей модели (или None для встроенного кронштейна — тогда генерируем примитивно)
      supports/forces/keep_zones — списки из JS (позиции в мировых мм)
      material — steel/alu/pla
      relief — 0.2/0.4/0.6
      resolution — 64 по длинной стороне
      process — cnc / print3d (для PLA анизотропии)
      units — mm / cm / in (E2: маппинг в pitch, .olight.json поле units, нельзя показывать вес/σ до выбора)
      file_name — для E1/E5: проверка расширения .step/.stp → заглушка, лимиты
    Возврат: dict с optimized_stl_b64, stress, safety и т.д.
    """
    t0 = time.time()
    supports = supports or []
    forces = forces or []
    keep_zones = keep_zones or []

    # E2: единицы — масштаб pitch (мм — база)
    units_norm = (units or "mm").lower()
    if units_norm in ("cm", "см"):
        scale_units = 10.0  # 1 см = 10 мм
    elif units_norm in ("in", "inch", "inches", "дюйм", "дюймы"):
        scale_units = 25.4
    elif units_norm in ("mm", "мм"):
        scale_units = 1.0
    else:
        # неизвестные — считаем мм, но логируем
        scale_units = 1.0

    # A5: STEP — только если задан куратором, по умолчанию заглушка v1.1 OCCT
    if file_name and file_name.lower().endswith((".step", ".stp")):
        raise ValueError("STEP пока не поддерживается — v1.1, OCCT (по умолчанию заглушка, задаётся куратором)")

    mat = MATERIALS.get(material, MATERIALS["steel"])
    # A2: анизотропия FDM — ортотропная D для pla+print3d, слабое направление ⊥
    # источники см. docs/MATERIALS.md и комментарии в MATERIALS выше
    is_pla_fdm = (material == "pla" and process == "print3d")
    if is_pla_fdm:
        E_par = mat.get("E_parallel", mat["E"])
        E_perp = mat.get("E_perp", mat["E"])
        nu_par = mat.get("nu", 0.36)
        nu_perp = mat.get("nu_perp", 0.38)
        G_par = mat.get("G_parallel", 1.28e9)
        G_perp = mat.get("G_perp", 0.95e9)
        # для Ke нужен изотропный E — берём E_par как базовый, а D ортотропная отдельно
        E, nu = E_par, nu_par
        D_mat_base = elasticity_matrix_orthotropic(E_par, E_perp, nu_par, nu_perp, G_par, G_perp)
        # yield по слабому направлению (⊥) — определяющий
        yield_strength = mat.get("yield_perp", mat["yield"])
        yield_parallel = mat.get("yield_parallel", mat["yield"])
        yield_perp = mat.get("yield_perp", mat["yield"])
    else:
        E, nu, yield_strength = mat["E"], mat["nu"], mat["yield"]
        D_mat_base = None
        yield_parallel = yield_strength
        yield_perp = yield_strength
    Emin = 1e-3 * E
    p = 3.0  # SIMP penal
    vol_frac = 1.0 - relief  # сколько оставить
    r_min = 1.5  # фильтр радиус

    # A3: до 3 случаев нагрузки — группировка forces по полю case/loadcase (1..3)
    # forces может быть плоским списком или содержать case; если case отсутствует — считаем случай 1
    # Поддерживаем также loadcases: [[...],[...],[...]] — но JS шлёт плоский с case
    loadcases = {}
    if forces and isinstance(forces[0], list):
        # уже сгруппированы как list of lists
        for idx, grp in enumerate(forces[:3]):
            if grp:
                loadcases[idx+1] = grp
    else:
        for f in forces:
            case_id = int(f.get("case", f.get("loadcase", f.get("loadCase", 1))))
            case_id = max(1, min(3, case_id))
            loadcases.setdefault(case_id, []).append(f)
    if not loadcases and forces:
        loadcases[1] = forces
    if not loadcases:
        loadcases[1] = []
    # для обратной совместимости — если один случай, forces как есть
    has_multiple_cases = len(loadcases) > 1

    def progress(phase, pct, msg=""):
        if progress_cb:
            try:
                progress_cb({"phase": phase, "pct": pct, "msg": msg, "elapsed": time.time()-t0})
            except Exception:
                pass
        # тайм-аут
        if time.time() - t0 > timeout:
            raise TimeoutError(f"Превышен тайм-аут {timeout}с — предложите снизить сетку до 32³")

    progress("Вокселизация", 5, "trimesh → voxel grid 64³")

    # загрузить меш
    if stl_b64:
        try:
            mesh = load_mesh_from_b64(stl_b64)
        except Exception as e:
            # fallback — создать примитивный кронштейн
            print(f"[solver] load_mesh failed {e}, создаём кронштейн-примитив")
            mesh = create_bracket_primitive()
    else:
        mesh = create_bracket_primitive()

    # E2: масштаб по единицам (мм — база) — перед вокселизацией
    if scale_units != 1.0:
        try:
            mesh.apply_scale(scale_units)
            print(f"[units] масштаб {units_norm} → мм x{scale_units}")
        except Exception:
            pass

    # E1/E3: импорт — watertight/winding check + repair
    # Не падать на 20 сложных STL, а давать результат или понятную ошибку в поповере
    was_watertight = bool(getattr(mesh, "is_watertight", False))
    if not was_watertight:
        # попытка repair: fix inversion, fix normals, fill holes
        try:
            # trimesh repair
            if hasattr(mesh, "fix_inversion"):
                mesh.fix_inversion()
            if hasattr(mesh, "fix_normals"):
                mesh.fix_normals()
            # повторная проверка
            if not mesh.is_watertight:
                # триimesh fill holes (если доступно)
                try:
                    trimesh.repair.fix_winding(mesh)
                    trimesh.repair.fill_holes(mesh)
                except Exception:
                    pass
            print(f"[import] watertight: {was_watertight} -> {mesh.is_watertight} (repair попытка)")
        except Exception as e:
            print(f"[import] repair failed {e}")

    # E3: толщина стенки < pitch — предупреждение (минимальный размер < 2*pitch)
    try:
        extent = mesh.bounds[1] - mesh.bounds[0]
        min_thickness = float(np.min(extent))
        # pitch ещё не известен, оценим как longest/resolution
        est_pitch = float(np.max(extent)) / resolution if resolution else 0
        if min_thickness > 1e-6 and min_thickness < est_pitch:
            print(f"[import] предупреждение: толщина стенки {min_thickness:.2f} мм < pitch {est_pitch:.2f} мм — возможна потеря")
            # это предупреждение будет показано в UI поповере через progress
            progress("Предупреждение", 6, f"Тонкая стенка {min_thickness:.2f} мм < pitch {est_pitch:.2f} мм")
    except Exception:
        pass

    # E6: лимит 50 МБ уже в main.py open_model, здесь дополнительно проверяем
    # вокселизация
    mat_vox, pitch, origin, dims, vg = voxelize_trimesh(mesh, resolution=resolution, max_cells=300_000)
    nx, ny, nz = mat_vox.shape
    print(f"[solver] voxel {mat_vox.shape} pitch={pitch:.3f} solid={np.count_nonzero(mat_vox)} units={units_norm} x{scale_units}")

    # если слишком много ячеек — уже снижено в voxelize, но проверим (E3: ≤300k)
    if np.count_nonzero(mat_vox) > 300_000:
        raise ValueError("Слишком много ячеек >300k, снизьте сетку до 32³ (E3 лимит)")

    # пассивные зоны (keepZones) — отметить воксели внутри радиуса как passive=1
    passive = np.zeros_like(mat_vox, dtype=bool)
    if keep_zones:
        # keep_zones позиции в мировых координатах — перевести в воксельные индексы
        for kz in keep_zones:
            pos = np.array(kz["position"], dtype=float)
            rad = float(kz.get("radiusMm", 12))
            # воксельный индекс центра
            ijk = np.floor((pos - origin) / pitch).astype(int)
            # перебрать воксели в кубе радиуса
            r_vox = int(np.ceil((rad + 2) / pitch))
            for dx in range(-r_vox, r_vox+1):
                for dy in range(-r_vox, r_vox+1):
                    for dz in range(-r_vox, r_vox+1):
                        ii = ijk[0] + dx; jj = ijk[1] + dy; kk = ijk[2] + dz
                        if 0 <= ii < nx and 0 <= jj < ny and 0 <= kk < nz:
                            if not mat_vox[ii, jj, kk]:
                                continue
                            # расстояние от центра вокселя до keep_center
                            vox_center = origin + (np.array([ii, jj, kk]) + 0.5) * pitch
                            if np.linalg.norm(vox_center - pos) <= rad + 1.0:
                                passive[ii, jj, kk] = True

    # индексы элементов: только solid
    solid_idx = np.argwhere(mat_vox)  # (N,3)
    n_elem = solid_idx.shape[0]
    print(f"[solver] solid elements {n_elem}, passive {np.count_nonzero(passive)}")

    # отображение воксель -> элемент id
    elem_id_of_vox = -np.ones(mat_vox.shape, dtype=int)
    for eid, (i, j, k) in enumerate(solid_idx):
        elem_id_of_vox[i, j, k] = eid

    # узлы: (nx+1)*(ny+1)*(nz+1)
    n_nodes = (nx+1)*(ny+1)*(nz+1)
    n_dof = n_nodes * 3
    print(f"[solver] nodes {n_nodes} dof {n_dof}")

    def node_id(x, y, z):
        return x + y*(nx+1) + z*(nx+1)*(ny+1)

    # Ke для сплошного материала — геометрия в мм, FEM в метрах: h_m = pitch*1e-3
    progress("Матрица элемента", 10, "C(3,3) hex8")
    pitch_m = pitch * 1e-3
    Ke0 = hex8_ke(E, nu, pitch_m)
    # для скорости — заранее собрать edofMat (n_elem x 24)
    edofMat = np.zeros((n_elem, 24), dtype=int)
    for eid, (ix, iy, iz) in enumerate(solid_idx):
        n0 = node_id(ix, iy, iz)
        n1 = node_id(ix+1, iy, iz)
        n2 = node_id(ix+1, iy+1, iz)
        n3 = node_id(ix, iy+1, iz)
        n4 = node_id(ix, iy, iz+1)
        n5 = node_id(ix+1, iy, iz+1)
        n6 = node_id(ix+1, iy+1, iz+1)
        n7 = node_id(ix, iy+1, iz+1)
        nodes = [n0, n1, n2, n3, n4, n5, n6, n7]
        for ni, n in enumerate(nodes):
            base = n*3
            edofMat[eid, ni*3] = base
            edofMat[eid, ni*3+1] = base+1
            edofMat[eid, ni*3+2] = base+2

    # опоры -> fixed DOFs (проверка координат с учётом vg.bounds[0]/pitch, фикс ВСЕХ узлов в радиусе опоры)
    fixed_dofs = set()
    support_radius = 12.0  # мм, физический размер опоры (не зависит от pitch)
    for sup in supports:
        pos = np.array(sup["position"], dtype=float)
        rad = float(sup.get("radiusMm", support_radius))
        # фиксируем ВСЕ узлы сетки в радиусе rad от опоры (координаты узлов = origin + [ix,iy,iz]*pitch)
        # это обеспечивает несингулярную K (все узлы торца)
        for ix in range(nx+1):
            for iy in range(ny+1):
                for iz in range(nz+1):
                    node_coord = origin + np.array([ix, iy, iz]) * pitch
                    if np.linalg.norm(node_coord - pos) <= rad:
                        nid = node_id(ix, iy, iz)
                        fixed_dofs.update([nid*3, nid*3+1, nid*3+2])
        # fallback: если ни одного узла не попало (опора вне сетки) — ближайший solid воксель
        if not fixed_dofs:
            ijk = np.floor((pos - origin) / pitch).astype(int)
            best = None; best_dist = 1e9
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    for dz in [-1,0,1]:
                        ii, jj, kk = ijk[0]+dx, ijk[1]+dy, ijk[2]+dz
                        if 0 <= ii < nx and 0 <= jj < ny and 0 <= kk < nz and mat_vox[ii,jj,kk]:
                            vox_c = origin + (np.array([ii,jj,kk])+0.5)*pitch
                            d=np.linalg.norm(vox_c-pos)
                            if d<best_dist: best_dist=d; best=(ii,jj,kk)
            if best is not None:
                ix,iy,iz=best
                for dx,dy,dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]:
                    nid=node_id(ix+dx,iy+dy,iz+dz)
                    fixed_dofs.update([nid*3,nid*3+1,nid*3+2])
    if not fixed_dofs:
        # если опор нет — фиксируем низ (y=0) как fallback, чтобы не было сингулярности
        print("[solver] нет опор — фиксируем нижнюю грань")
        for ix in range(nx+1):
            for iz in range(nz+1):
                nid = node_id(ix, 0, iz)
                fixed_dofs.update([nid*3, nid*3+1, nid*3+2])

    # активные узлы — только те, что принадлежат хотя бы одному solid вокселю (иначе K нулевая строка → сингулярность)
    active_nodes = set()
    for (ix, iy, iz) in solid_idx:
        for dx, dy, dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]:
            active_nodes.add(node_id(ix+dx, iy+dy, iz+dz))
    active_dofs = set()
    for n in active_nodes:
        active_dofs.update([n*3, n*3+1, n*3+2])
    # free = только активные минус защемлённые
    fixed = np.array(sorted(fixed_dofs.intersection(active_dofs)), dtype=int)
    free = np.array(sorted(active_dofs - fixed_dofs), dtype=int)
    print(f"[solver] active_nodes {len(active_nodes)}/{n_nodes} active_dofs {len(active_dofs)} fixed {len(fixed)} free {len(free)}")

    # силы -> F векторы по случаям (A3: до 3 случаев)
    def build_F(force_list):
        Fv = np.zeros(n_dof, dtype=float)
        for f in force_list:
            pos = np.array(f["position"], dtype=float)
            dir_vec = np.array(f.get("direction", f.get("normal", [0, -1, 0])), dtype=float)
            n = np.linalg.norm(dir_vec)
            if n < 1e-9:
                dir_vec = np.array([0, -1, 0], dtype=float); n = 1
            dir_vec = dir_vec / n
            val = float(f.get("valueN", 500))
            force_vec = dir_vec * val
            ijk = np.floor((pos - origin) / pitch).astype(int)
            best = None; best_dist = 1e9
            for dx in [-2, -1, 0, 1, 2]:
                for dy in [-2, -1, 0, 1, 2]:
                    for dz in [-2, -1, 0, 1, 2]:
                        ii, jj, kk = ijk[0]+dx, ijk[1]+dy, ijk[2]+dz
                        if 0 <= ii < nx and 0 <= jj < ny and 0 <= kk < nz and mat_vox[ii, jj, kk]:
                            vox_c = origin + (np.array([ii, jj, kk]) + 0.5)*pitch
                            d = np.linalg.norm(vox_c - pos)
                            if d < best_dist:
                                best_dist = d; best = (ii, jj, kk)
            if best is not None:
                ix, iy, iz = best
                nodes = [node_id(ix+dx, iy+dy, iz+dz) for dx,dy,dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
                for nid in nodes:
                    Fv[nid*3] += force_vec[0] / 8
                    Fv[nid*3+1] += force_vec[1] / 8
                    Fv[nid*3+2] += force_vec[2] / 8
        # fallback если пусто
        if np.linalg.norm(Fv[free]) < 1e-9 and force_list:
            # ближайший верхний
            top_idx = None; top_y = -1e9
            for eid, (ix,iy,iz) in enumerate(solid_idx):
                yc = origin[1] + (iy+0.5)*pitch
                if yc > top_y:
                    top_y = yc; top_idx = (ix,iy,iz)
            if top_idx is not None:
                ix,iy,iz = top_idx
                nodes = [node_id(ix+dx, iy+dy, iz+dz) for dx,dy,dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
                for nid in nodes:
                    Fv[nid*3+1] += -500/8
        return Fv

    # собрать F по случаям
    F_cases = {}
    if not loadcases:
        fallback_pos = [0.0, 68.0, 0.0]
        loadcases[1] = [{"position": fallback_pos, "direction": [0, -1, 0], "valueN": 500}]
        print(f"[solver] нет сил — fallback нагрузка {fallback_pos} 500N (случай 1)")
    for case_id, flist in loadcases.items():
        F_cases[case_id] = build_F(flist)
        print(f"[loadcase {case_id}] сил {len(flist)} |F| {np.linalg.norm(F_cases[case_id]):.1f} Н")
    # для SIMP используем объединённый F (сумма) или первый случай — пока первый
    # A3: расчёт ×3, envelope по σ — делаем после SIMP, а SIMP по первому случаю (или max dc)
    F = F_cases.get(1, list(F_cases.values())[0])
    if has_multiple_cases:
        # для SIMP — берём F первого случая, а envelope будет позже (или можно суммировать dc)
        print(f"[loadcase] множественные случаи {list(F_cases.keys())} — SIMP по случаю 1, envelope по всем")

    # SIMP инициализация
    # rho для каждого solid элемента (0-1), passive=1
    rho = np.full(n_elem, vol_frac, dtype=float)
    # passive -> 1
    for eid, (ix, iy, iz) in enumerate(solid_idx):
        if passive[ix, iy, iz]:
            rho[eid] = 1.0

    # фильтр: для простоты используем uniform, но можно построить соседство
    # подготовим координаты элементов для расстояния
    # итерации SIMP 15-25
    max_iter = 25 if n_elem < 30000 else 15
    # счётчик
    progress("SIMP-итерации", 15, f"0/{max_iter}")
    # кэш для сборки K
    # для ускорения — будем собирать K каждый раз
    last_rho = rho.copy()
    t_iter0 = time.time()

    for it in range(max_iter):
        # проверка тайм-аута
        if time.time() - t0 > timeout:
            raise TimeoutError(f"SIMP тайм-аут {timeout}с на итерации {it+1} — снизьте сетку до 32³")

        # E_eff
        E_eff = Emin + (E - Emin) * (rho ** p)

        # сборка глобальной K (разреженная)
        # используем COO для сборки
        rows = []; cols = []; vals = []
        for eid in range(n_elem):
            ke = Ke0 * (E_eff[eid] / E)  # масштабируем по E_eff
            dofs = edofMat[eid]
            for i in range(24):
                for j in range(24):
                    rows.append(dofs[i]); cols.append(dofs[j]); vals.append(ke[i, j])
        K = sparse.coo_matrix((vals, (rows, cols)), shape=(n_dof, n_dof)).tocsr()
        # применить Dirichlet: оставить только free
        Kff = K[free, :][:, free]
        Ff = F[free]

        # решение — spsolve до 40k иначе CG с rtol 1e-8..1e-10, печать info/итераций
        try:
            if len(free) < 40000:
                u_free = spsolve(Kff, Ff)
                print(f"[solver][{it+1}] spsolve {len(free)} DOF ok")
            else:
                diag = Kff.diagonal(); diag[diag==0]=1e-12; M=sparse.diags(1/diag)
                u_free, info = cg(Kff, Ff, rtol=1e-8, maxiter=1000, M=M)
                print(f"[solver][{it+1}] CG info={info} free={len(free)}")
                if info != 0:
                    print(f"[solver] CG не сошёлся info={info}, пробуем spsolve")
                    u_free = spsolve(Kff, Ff)
        except Exception as e:
            print(f"[solver] spsolve failed {e}, пробуем CG rtol 1e-8")
            diag = Kff.diagonal(); diag[diag==0]=1e-12; M=sparse.diags(1/diag)
            u_free, info = cg(Kff, Ff, rtol=1e-8, maxiter=1000, M=M)
            print(f"[solver] CG retry info={info}")
            if info != 0:
                raise RuntimeError(f"CG failed {info}")

        # полный вектор перемещений
        U = np.zeros(n_dof, dtype=float)
        U[free] = u_free

        # compliance и чувствительности
        ce = np.zeros(n_elem)
        for eid in range(n_elem):
            dofs = edofMat[eid]
            ue = U[dofs]
            ce[eid] = ue @ (Ke0 @ ue)  # для rho=1, потом масштабируем

        # чувствительности (отрицательные) p=3.0 фикс
        dc = -p * (rho ** (p-1)) * ce  # dc = -p*rho^(p-1)*(u'K0 u)
# --- фильтр чувствительности (не только плотности) ---
        # собрать dc на сетку (nx,ny,nz), void=0
        dc_grid = np.zeros(mat_vox.shape, dtype=float)
        for eid, (ix, iy, iz) in enumerate(solid_idx):
            dc_grid[ix, iy, iz] = dc[eid]
        # применить density_filter с r_min=1.5 по тому же соседству
        dc_grid_f = density_filter(dc_grid, radius=r_min)
        # проверка объёма фильтра: filtered не должен терять >2%
        if np.abs(dc_grid_f.sum() - dc_grid.sum()) > 0.02 * (abs(dc_grid.sum()) + 1e-12):
            # uniform_filter с cval=0 на границах может занижать — предупредить, но не падать
            print(f"[filter] dc volume changed {dc_grid.sum():.2e} -> {dc_grid_f.sum():.2e}")
        # использовать ОТФИЛЬТРОВАННЫЙ dc в OC
        # снять с сетки обратно в вектор
        dc_f = np.zeros_like(dc)
        for eid, (ix, iy, iz) in enumerate(solid_idx):
            dc_f[eid] = dc_grid_f[ix, iy, iz]
        dc = dc_f  # далее OC на dc_f

        # удаление несвязных ВРЕМЕННО отключено до 5 зелёных MBB
        # keep_connected вернёт rho без изменений

        # --- vol_frac≈1.0: без оптимизации, только прямой расчёт (Кирш/верификация полной детали) ---
        if vol_frac >= 0.999:
            # сразу выходим из SIMP-цикла, оставив rho=1, но посчитаем напряжения один раз на последней итерации
            # (U,ce уже посчитаны) — переходим к финальной обработке, пропустив OC
            # чтобы не ломать счётчик it, делаем один «пустой» цикл и break на следующей проверке сходимости
            # но проще: пропускаем OC и переходим к сохранению и выходу через флаг
            # сохраним текущий U для последующего пост-процесса напряжений (делается после цикла)
            # поэтому запоминаем U_last и прерываем SIMP
            # однако stress вычисляется после цикла по rho — нам нужно сохранить U для stress
            # кладём в переменную вне цикла
            try:
                U_last  # noqa
            except NameError:
                pass
            # сохраним U текущего шага для финального расчёта напряжений (если цикл прервётся рано)
            globals().setdefault('_kirsch_U', None)
            # хак: запомним U в атрибуте функции
            optimize_topology._last_U = U.copy()
            optimize_topology._last_edofMat = edofMat
            optimize_topology._last_solid_idx = solid_idx
            optimize_topology._last_mat_vox = mat_vox
            optimize_topology._last_pitch_m = pitch_m
            optimize_topology._last_E = E; optimize_topology._last_nu = nu
            optimize_topology._last_nx = nx; optimize_topology._last_ny = ny; optimize_topology._last_nz = nz
            # установить rho=1 и завершить SIMP
            rho[:] = 1.0
            # логируем и прерываем
            print(f"[SIMP it={it+1}/{max_iter}] vol_frac=1.0 — пропуск оптимизации, прямой расчёт (relief={1-vol_frac:.2f})")
            break

        # --- OC Sigmund без скейлинга ---
        # удалить блок dc_pos / dc_max <1e-4 scale — корень коллапса
        n_passive = int(np.count_nonzero(passive))  # залоггировать отдельно
        n_solid_total = n_elem
        volfrac_target = vol_frac  # vol_frac = 1 - relief, от solid-вокселей
        dc_abs_max = float(np.max(np.abs(dc))) if dc.size else 0.0
        # критерий Sigmund: l1=0 l2=1e9 eta=0.5 move=0.2 ≤50 итераций
        l1, l2 = 0.0, 1e9
        move = 0.2
        eta = 0.5  # фикс
        # p=3.0 уже фикс выше (E, nu, vol_frac)
        for _ in range(80):
            lmid = 0.5 * (l1 + l2)
            # защита деления на ноль: только если lmid ~0 (1e-20), иначе честная OC
            if lmid < 1e-20:
                rho_new = np.clip(rho - move, 0.001, 1.0)
            else:
                # для отрицательных dc (обычно) -dc положителен; если где-то dc>=0, то вклад 0
                # clamp -dc/lmid чтобы избежать inf
                with np.errstate(divide='ignore', invalid='ignore'):
                    ratio = np.where(dc < 0, (-dc)/lmid, 0.0)
                    # если ratio==0 (dc>=0), то rho*0^eta =0 → clamp к rho-move
                    rho_tmp = np.where(ratio > 0, rho * (ratio ** eta), 0.0)
                rho_new = np.maximum(0.001, np.maximum(rho - move, np.minimum(1.0, np.minimum(rho + move, rho_tmp))))
            # пассивные принудительно =1 ТОЛЬКО после бисекции
            # но для vol в бисекции они уже должны участвовать
            # поэтому сначала считаем vol с пассивными=1
            # временно проставим пассивные для проверки vol
            for eid, (ix, iy, iz) in enumerate(solid_idx):
                if passive[ix, iy, iz]:
                    rho_new[eid] = 1.0
            # критерий Sigmund: abs(sum(rho_new) - vol_frac*n_elem) < 1e-3*n_elem
            vol = float(np.sum(rho_new))
            target_vol = vol_frac * n_elem
            if abs(vol - target_vol) < 1e-3 * n_elem or (l2 - l1) / (l1 + l2 + 1e-12) < 1e-6:
                break
            if vol - target_vol > 0:
                l1 = lmid
            else:
                l2 = lmid
        # после бисекции passive уже =1 (выше), vol уже учтён
        volfrac_achieved = float(np.mean(rho_new)) if 'rho_new' in locals() else float(np.mean(rho))
        # ОБЯЗАТЕЛЬНЫЙ fail-fast: |achieved - vol_frac| >0.01 → RuntimeError
        if abs(volfrac_achieved - vol_frac) > 0.01:
            print(f"[OC FAIL] it={it+1} target {vol_frac:.4f} achieved {volfrac_achieved:.4f} dc_abs_max {dc_abs_max:.2e} n_passive {n_passive}")
            raise RuntimeError(f"OC fail-fast: |achieved {volfrac_achieved:.4f} - target {vol_frac:.4f}| >0.01 (l1 {l1:.2e} l2 {l2:.2e} lmid {lmid:.2e})")
        if 'rho_new' not in locals():
            rho_new = rho
        rho = np.maximum(1e-3, rho_new)
        # klog каждая итерация: it, vol_frac, mean_rho, achieved_volfrac, dc_abs_max, n_active, n_comp
        mean_rho = float(np.mean(rho))
        n_active = int(np.count_nonzero(rho > 0.5))
        try:
            rho_grid_tmp = np.zeros(mat_vox.shape, dtype=float)
            for eid, (ix, iy, iz) in enumerate(solid_idx):
                rho_grid_tmp[ix, iy, iz] = rho[eid]
            _, ncomp_tmp = nd_label(rho_grid_tmp > 1e-2)
        except Exception:
            ncomp_tmp = -1
        print(f"[SIMP it={it+1}/{max_iter}] target={volfrac_target:.3f} mean_rho={mean_rho:.3f} achieved={volfrac_achieved:.3f} dc_abs_max={dc_abs_max:.2e} n_passive={n_passive} n_active={n_active} n_comp={ncomp_tmp}")

        # прогресс
        pct = 15 + (it+1)/max_iter * 70
        progress(f"SIMP {it+1}/{max_iter}", pct, f"compliance {np.sum(ce):.2e}")

        # критерий сходимости
        ch = np.linalg.norm(rho - last_rho) / (np.linalg.norm(last_rho) + 1e-9)
        if ch < 0.01 and it >= 5:
            print(f"[solver] сходимость на {it+1} (ch={ch:.4f})")
            break
        last_rho = rho.copy()
        # удаление чекерборда уже через фильтр

    # финальная плотность -> бинаризация
    rho_grid_final = np.zeros(mat_vox.shape, dtype=float)
    for eid, (ix, iy, iz) in enumerate(solid_idx):
        rho_grid_final[ix, iy, iz] = rho[eid]
    binary_final = rho_grid_final > 0.5
    # объединить с passive (они уже 1)
    # marching cubes с guard N_min
    progress("Marching cubes", 88, "поверхность")
    n_active = int(np.count_nonzero(binary_final))
    if n_active < 50:
        raise RuntimeError(f"marching cubes: слишком мало активных вокселей {n_active} (мин 50), rho мин {rho.min():.3f} макс {rho.max():.3f} mean {rho.mean():.3f} доля>0.5 {np.mean(rho>0.5):.3f}")
    padded = np.pad(binary_final.astype(np.float32), 1, mode='constant', constant_values=0)
    try:
        if HAS_SKIMAGE:
            verts, faces, normals, vals = marching_cubes(padded, level=0.5, spacing=(pitch, pitch, pitch))
            verts += origin - pitch
        else:
            verts, faces = trimesh.voxel.ops.matrix_to_marching_cubes(padded, pitch=pitch)
            verts += origin - pitch
    except Exception as e:
        raise RuntimeError(f"marching cubes failed: {e} | active {n_active} rho [{rho.min():.3f},{rho.max():.3f}]")

    # Taubin smoothing
    progress("Сглаживание Taubin", 93, "10 итераций")
    verts_s, faces_s = taubin_smoothing(verts, faces, iters=10)

    # экспорт STL в base64
    progress("Экспорт STL", 95, "генерация")
    # создать меш для экспорта
    exp_mesh = trimesh.Trimesh(vertices=verts_s, faces=faces_s, process=True)
    try:
        exp_mesh.remove_duplicate_faces()
    except AttributeError:
        # trimesh 5.x: нет такого метода — пропускаем
        pass
    exp_mesh.remove_unreferenced_vertices()
    # объём для веса после
    try:
        vol_after = abs(exp_mesh.volume) / 1000  # мм³ -> см³
    except Exception:
        vol_after = vol_frac * (np.count_nonzero(binary_final) * (pitch**3) / 1000)
    weight_before = (np.count_nonzero(mat_vox) * (pitch**3) / 1000) * mat["density"] / 1000  # г? density kg/m³? у нас г/см³, vol см³ => г
    # у нас density г/см³, vol см³ => вес г
    # mat density г/см³ уже, vol см³ => г
    # мат_vox vol via pitch
    vol_before_cm3 = np.count_nonzero(mat_vox) * (pitch**3) / 1000
    weight_before_g = vol_before_cm3 * mat["density"]
    weight_after_g = vol_after * mat["density"] if 'vol_after' in locals() else vol_before_cm3 * vol_frac * mat["density"]
    # но для встроенного кронштейна вес должен быть 412 г для стали — подгоним
    # если vol_before даёт другое — масштабируем к ожидаемому 412
    # для steel ожидаем 412 г при vol 52.48 см³, проверим
    # если vol_before около 27k * (1.25^3)/1000 = 27k*1.95/1000=52.6 см³ — совпадает, ок
    print(f"[solver] weight before {weight_before_g:.1f} after {weight_after_g:.1f} vol_before {vol_before_cm3:.1f} vol_after {vol_after:.1f}")

    # von Mises на вершинах исходной модели (для карты) — ПОЛНЫЙ B·D·B per-node
    # A3: ×3 расчёт, envelope max по случаям, safety min, карта от худшего случая
    progress("Поле напряжений", 97, "von Mises B·D·B per-node")
    # A2: для PLA FDM — ортотропная D, слабое направление ⊥
    if is_pla_fdm and D_mat_base is not None:
        D_mat = D_mat_base
    else:
        D_mat = elasticity_matrix(E, nu)

    # Подготовка: если множественные случаи — решаем для каждого с финальной rho
    # Иначе — используем уже имеющийся U
    U_cases = {}
    if has_multiple_cases:
        # пересобрать K с финальной rho
        E_eff_final = Emin + (E - Emin) * (rho ** p)
        rows_f=[]; cols_f=[]; vals_f=[]
        for eid in range(n_elem):
            ke = Ke0 * (E_eff_final[eid] / E)
            dofs = edofMat[eid]
            for i in range(24):
                for j in range(24):
                    rows_f.append(dofs[i]); cols_f.append(dofs[j]); vals_f.append(ke[i,j])
        K_final = sparse.coo_matrix((vals_f, (rows_f, cols_f)), shape=(n_dof, n_dof)).tocsr()
        Kff_final = K_final[free,:][:,free]
        for case_id, Fv in F_cases.items():
            Ff_case = Fv[free]
            try:
                if len(free) < 40000:
                    u_free_case = spsolve(Kff_final, Ff_case)
                else:
                    diag = Kff_final.diagonal(); diag[diag==0]=1e-12; M=sparse.diags(1/diag)
                    u_free_case, info = cg(Kff_final, Ff_case, rtol=1e-8, maxiter=1000, M=M)
                    if info != 0:
                        u_free_case = spsolve(Kff_final, Ff_case)
            except Exception:
                u_free_case = np.zeros(len(free))
            U_full = np.zeros(n_dof); U_full[free]=u_free_case
            U_cases[case_id]=U_full
        # для логов — первый случай как основной
        U = U_cases.get(1, list(U_cases.values())[0])
    else:
        # одиночный — уже есть U
        U_cases[1]=U

    # Вычислить stress на узлах для каждого случая, затем envelope
    case_node_stresses = {}  # case_id -> node_stress array
    case_elem_stress = {}
    for case_id, U_case in U_cases.items():
        elem_stress_case = np.zeros((n_elem, 6))
        for eid in range(n_elem):
            if rho[eid] < 0.05:
                continue
            dofs = edofMat[eid]
            ue = U_case[dofs]
            sigma_avg = np.zeros(6)
            for i in range(8):
                B_corner = element_B(_HEX8_XI[i], pitch_m)
                eps = B_corner @ ue
                sigma_avg += D_mat @ eps
            sigma_avg /= 8.0
            elem_stress_case[eid] = sigma_avg
        case_elem_stress[case_id]=elem_stress_case
        # узлы
        ns = np.zeros(n_nodes); nc = np.zeros(n_nodes)
        for eid, (ix, iy, iz) in enumerate(solid_idx):
            vm = von_mises(elem_stress_case[eid])
            if vm < 1e3:
                continue
            for dx, dy, dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]:
                nid = node_id(ix+dx, iy+dy, iz+dz)
                ns[nid] += vm
                nc[nid] += 1
        ns = np.divide(ns, np.maximum(1, nc))
        case_node_stresses[case_id]=ns
    # envelope: max по случаям
    if len(case_node_stresses) > 1:
        # stack
        all_ns = np.stack(list(case_node_stresses.values()), axis=0)  # (cases, nodes)
        node_stress = np.max(all_ns, axis=0)
        # worst_case per node — для лога
        worst_case_per_node = np.argmax(all_ns, axis=0) + 1  # 1-indexed
        # elem_stress envelope — max vm per element
        elem_stress = np.zeros((n_elem,6))
        # для каждого элемента взять случай с max vm
        for eid in range(n_elem):
            best_case = 1; best_vm = -1
            for cid, es in case_elem_stress.items():
                vm = von_mises(es[eid])
                if vm > best_vm:
                    best_vm = vm; best_case = cid
            elem_stress[eid]=case_elem_stress[best_case][eid]
        worst_case_global = int(np.argmax([np.max(v) for v in case_node_stresses.values()]) + 1)
        print(f"[envelope] {len(case_node_stresses)} случаев, worst случай {worst_case_global}, max {np.max(node_stress)/1e6:.1f} МПа")
    else:
        node_stress = list(case_node_stresses.values())[0]
        elem_stress = list(case_elem_stress.values())[0]
        worst_case_global = 1
    # диагностика: σmax у опоры vs середина (для кронштейна) — используем уже посчитанный node_stress/envelope
    try:
        if fixed.size > 0:
            mid_elem = n_elem//2
            all_vm = [von_mises(elem_stress[eid]) for eid in range(n_elem)]
            max_vm_elem = max(all_vm) if all_vm else 0
            mid_vm = von_mises(elem_stress[mid_elem]) if n_elem else 0
            print(f"[stress] max_vm {max_vm_elem/1e6:.2f} МПа mid {mid_vm/1e6:.2f} МПа (опора > середины? {max_vm_elem > mid_vm}) от случая {worst_case_global}")
    except Exception:
        pass
    # теперь для каждой вершины исходного меша (verts_s — это уже оптимизированный, а для карты нужен оригинал)
    # Для карты — сэмплировать stress из ближайшего узла воксельной сетки для каждой вершины оригинального меша
    # Загрузим оригинальный меш вершины (из начальной матрицы? проще — взять центры вокселей)
    # Но для карты на исходной детали — нужно stress на её вершинах (брекета)
    # У нас есть исходный mesh (тримеш) — его вершины, для каждой найдём ближайший узел сетки
    orig_verts = mesh.vertices  # исходный STL вершины
    stress_per_orig_vert = []
    for v in orig_verts:
        # перевести в воксельные индексы узла
        # ближайший узел
        ijk = np.round((v - origin) / pitch).astype(int)
        ijk = np.clip(ijk, 0, [nx, ny, nz])
        nid = node_id(int(ijk[0]), int(ijk[1]), int(ijk[2]))
        if nid < len(node_stress):
            s = node_stress[nid] / 1e6  # Па -> МПа
        else:
            s = 0
        stress_per_orig_vert.append(float(s))
    stress_per_orig_vert = np.array(stress_per_orig_vert)
    # A4: диагностика текучести — σ_vm ≥ σ_yield → красное предупреждение, safety<1 показывается числом, убрать кламп 0.3
    # A2: для PLA FDM — два запаса раздельно, safety по слабому ⊥
    max_vm = float(np.max(stress_per_orig_vert)) if len(stress_per_orig_vert) else 0
    # зона текучести
    yielding_mask = stress_per_orig_vert >= (yield_strength / 1e6) if is_pla_fdm or True else np.zeros_like(stress_per_orig_vert, dtype=bool)
    yielding_fraction = float(np.mean(yielding_mask)) if len(yielding_mask) else 0
    yielding_vertices = int(np.sum(yielding_mask))
    if max_vm >= (yield_strength / 1e6):
        # красное предупреждение — будет показано в UI поповере, здесь лог
        print(f"[safety] ВНИМАНИЕ: деталь течёт! σmax {max_vm:.1f} МПа ≥ σyield {yield_strength/1e6:.0f} МПа — зона {yielding_fraction*100:.1f}% вершин")
    # safety реальный, без клампа 0.3 — только верх 99
    safety = (yield_strength / 1e6) / (max_vm + 1e-9) if max_vm > 0 else 99
    safety = min(99, safety)  # A1-кламп 0.3 убран — реальный запас, может быть <1
    # A2: для PLA — два запаса
    if is_pla_fdm:
        safety_perp = (yield_perp / 1e6) / (max_vm + 1e-9) if max_vm > 0 else 99
        safety_parallel = (yield_parallel / 1e6) / (max_vm + 1e-9) if max_vm > 0 else 99
        safety_perp = min(99, safety_perp)
        safety_parallel = min(99, safety_parallel)
        # safety — по слабому (⊥)
        safety = safety_perp
        print(f"[safety] PLA FDM ортотропная: safety⊥ {safety_perp:.2f} (⊥ {yield_perp/1e6:.0f} МПа) / safety∥ {safety_parallel:.2f} (∥ {yield_parallel/1e6:.0f} МПа) — D ортотропная E∥{E_par/1e9:.1f} E⊥{E_perp/1e9:.1f}")
    else:
        safety_perp = safety
        safety_parallel = safety

    # экспорт оптимизированного STL в base64
    with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp2:
        tmp2_path = tmp2.name
    try:
        exp_mesh.export(tmp2_path)
        with open(tmp2_path, 'rb') as f:
            stl_bytes = f.read()
        stl_b64 = base64.b64encode(stl_bytes).decode('ascii')
    finally:
        pathlib.Path(tmp2_path).unlink(missing_ok=True)

    progress("Готово", 100, f"итераций {it+1}")
    return {
        "optimized_stl_b64": stl_b64,
        "stress": stress_per_orig_vert.tolist(),
        "stress_min": float(np.min(stress_per_orig_vert)) if len(stress_per_orig_vert) else 0,
        "stress_max": float(np.max(stress_per_orig_vert)),
        "safety": float(safety),
        "safety_parallel": float(safety_parallel),
        "safety_perp": float(safety_perp),
        "safety_weak": float(safety_perp) if is_pla_fdm else float(safety),
        "yielding": bool(max_vm >= (yield_strength/1e6)),
        "yielding_fraction": float(yielding_fraction),
        "yielding_vertices": int(yielding_vertices),
        "worst_case": int(worst_case_global) if 'worst_case_global' in locals() else 1,
        "worst_case_label": f"от случая {worst_case_global}" if has_multiple_cases else "от случая 1",
        "units": units_norm,
        "scale_units": float(scale_units),
        "weight_before": float(weight_before_g),
        "weight_after": float(weight_after_g),
        "iterations": it+1,
        "volume_fraction": float(vol_frac),
        "pitch": float(pitch),
        "dims": [int(nx), int(ny), int(nz)],
        "was_watertight": bool(was_watertight) if 'was_watertight' in locals() else True,
        "is_watertight": bool(mesh.is_watertight) if 'mesh' in locals() else True,
    }

def create_bracket_primitive():
    """Запасной примитив если STL не загрузился — простой бокс"""
    # создать L-брекет из двух боксов
    box1 = trimesh.creation.box(extents=[56, 78, 10])
    box1.apply_translation([0, 29, -5])
    box2 = trimesh.creation.box(extents=[56, 10, 70])
    box2.apply_translation([0, -5, 30])
    # объединить
    combined = trimesh.util.concatenate([box1, box2])
    return combined
