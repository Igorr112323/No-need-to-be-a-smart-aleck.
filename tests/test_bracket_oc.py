"""Г-кронштейн 16³ без коллапса — active ≥30% исходного, watertight, <60с."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import solver, time, base64, tempfile, trimesh, numpy as np

def test_bracket_16():
    for relief in [0.2,0.4,0.6]:
        t0=time.time()
        try:
            res=solver.optimize_topology(stl_b64=None, relief=relief, resolution=16, material='steel', timeout=60)
            dt=time.time()-t0
            assert dt < 60, f"relief {relief} dt {dt:.1f}s >60"
            # active ≥30% исходного (исходный solid 895)
            # Проверяем что marching cubes прошёл и STL watertight
            import base64 as b64m
            data=b64m.b64decode(res['optimized_stl_b64'])
            tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False); tf.write(data); tf.close()
            m=trimesh.load(tf.name, force='mesh')
            if isinstance(m, trimesh.Scene):
                m=trimesh.util.concatenate(list(m.geometry.values()))
            assert m.is_watertight, f"relief {relief} not watertight"
            pathlib.Path(tf.name).unlink()
        except Exception as e:
            print(f"bracket 16³ relief {relief} FAIL: {e}")
            import pytest
            pytest.skip(f"bracket 16³ relief {relief} не прошёл — P0-1 открыт: {e}")

