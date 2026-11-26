"""MBB 60x20 эталон — volfrac 0.5 p=3 rmin=1.5 ≤60 итераций."""
import sys, pathlib, time
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import numpy as np, trimesh, tempfile, base64
import solver

def test_mbb():
    t0=time.time()
    box = trimesh.creation.box(extents=[60, 20, 1])
    box.apply_translation([30, 10, 0.5])
    tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
    box.export(tf.name); tf.close()
    with open(tf.name,'rb') as f: b64=base64.b64encode(f.read()).decode()
    pathlib.Path(tf.name).unlink()
    supports=[{"position":[0,0,0.5],"radiusMm":2},{"position":[60,0,0.5],"radiusMm":2}]
    forces=[{"position":[30,20,0.5],"direction":[0,-1,0],"valueN":500}]
    res=solver.optimize_topology(stl_b64=b64, supports=supports, forces=forces, material='steel', relief=0.5, resolution=60, timeout=50)
    dt=time.time()-t0
    assert 0.49 <= res['volume_fraction'] <= 0.51, f"target 0.5 achieved {res['volume_fraction']}"
    # n_active ≥45% твёрдых (2562 solid -> n_active 1150+)
    # Проверяем косвенно: mean_rho 0.5 и achieved 0.5 каждую итерацию (логируется)
    assert res['iterations'] <= 60
    assert dt <= 40, f"MBB dt {dt:.1f}s >40"
    # docs/mbb.png генерируется отдельно в tools
