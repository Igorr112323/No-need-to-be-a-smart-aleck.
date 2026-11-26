"""
B1 Кирш: пластина 100×100×2 мм, отверстие Ø10 мм, растяжение σ=10 МПа
Аналит: Kt≈3.0 (бесконечная), с поправкой finite W=100, D=10 → Kt≈2.7, допуск ≤7%
"""
import pathlib, sys, tempfile, base64, math
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import numpy as np, trimesh
import solver
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

def create_plate_with_hole(W=100, H=100, t=2, D=10):
    # 2D polygon W×H with circular hole D, extrude t
    outer = Polygon([(0,0),(W,0),(W,H),(0,H)])
    hole = Point(W/2, H/2).buffer(D/2, resolution=32)
    poly = outer.difference(hole)
    # trimesh extrude
    mesh = trimesh.creation.extrude_polygon(poly, height=t)
    # center thickness at z=0
    mesh.apply_translation([0,0,-t/2])
    return mesh

def test_kirsch():
    W, H, t, D = 100, 100, 2, 10
    sigma_nom = 10.0 # МПа, дальнее поле
    # ожидаемый Kt для конечной пластины: Peterson Kt = 3 -3.13*(D/W)+3.66*(D/W)^2 -1.53*(D/W)^3
    r = D/W
    Kt_analytic = 3 - 3.13*r + 3.66*r*r - 1.53*r*r*r
    sigma_expected = Kt_analytic * sigma_nom # ~27.3 МПа
    print(f"Kirsch analytic Kt={Kt_analytic:.3f} σmax={sigma_expected:.1f} МПа (σnom={sigma_nom})")

    mesh = create_plate_with_hole(W,H,t,D)
    # проверить watertight
    assert mesh.is_watertight or mesh.is_volume, "plate hole mesh not watertight"
    tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
    mesh.export(tf.name); tf.close()
    with open(tf.name,'rb') as f:
        b64=base64.b64encode(f.read()).decode()
    pathlib.Path(tf.name).unlink()

    # опоры слева (x=0), силы справа (x=W) — растяжение
    # Раздать опоры по всей левой грани (x=0)
    supports=[{"position":[0, H/2, 0],"radiusMm":15}]
    # Сила растяжения: 2000N равномерно по правой грани (σnom * W*t)
    F_total = sigma_nom * W * t # N, т.к. 1 МПа=1 N/mm2
    forces=[{"position":[W, H/2, 0],"direction":[1,0,0],"valueN":F_total}]

    res=solver.optimize_topology(stl_b64=b64, supports=supports, forces=forces, material='steel', relief=0.0, resolution=48, timeout=90)
    sigma_max = res['stress_max']
    print(f"OpenLight σmax={sigma_max:.1f} МПа Kt={sigma_max/sigma_nom:.2f} (analytic {Kt_analytic:.2f})")
    # допуск ≤7% от аналит. σmax
    err = abs(sigma_max - sigma_expected)/sigma_expected
    print(f"Kirsch err {err*100:.1f}%")
    # также падение/рост от радиуса ~2.5-3.0 — проверяем что Kt в [2.5,3.2]
    assert 2.4 <= sigma_max/sigma_nom <= 3.3, f"Kt {sigma_max/sigma_nom:.2f} вне 2.4-3.3"
    assert err <= 0.07, f"Kirsch Δ {err*100:.1f}% >7% (analytic {sigma_expected:.1f} vs {sigma_max:.1f})"
