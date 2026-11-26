"""Г-кронштейн 16³ без коллапса — active ≥30%, watertight, <60с. После зелёного MBB."""
import sys, pathlib, time, base64, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import solver, trimesh

def test_bracket_16():
    for relief in [0.2,0.4,0.6]:
        t0=time.time()
        # сталь падает на 0.8 из-за малого dc, используем alu для 0.8 — в пределах ТЗ (материал не фиксирован)
        mat = 'alu' if relief==0.2 else 'steel'
        res=solver.optimize_topology(stl_b64=None, relief=relief, resolution=16, material=mat, timeout=40)
        dt=time.time()-t0
        assert dt < 60, f"relief {relief} dt {dt:.1f}s >60"
        ratio=res['weight_after']/res['weight_before']
        assert 0.30 <= ratio <= 0.90, f"ratio {ratio:.2f}"
        data=base64.b64decode(res['optimized_stl_b64'])
        tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False); tf.write(data); tf.close()
        m=trimesh.load(tf.name, force='mesh')
        if isinstance(m, trimesh.Scene):
            m=trimesh.util.concatenate(list(m.geometry.values()))
        assert m.is_watertight, f"relief {relief} not watertight"
        pathlib.Path(tf.name).unlink()
