import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import solver

def test_import():
    assert hasattr(solver, "MATERIALS")
    assert "steel" in solver.MATERIALS
    assert solver.MATERIALS["steel"]["yield"] == 345e6

def test_voxelize_smoke():
    import trimesh, tempfile, pathlib, base64
    m=solver.create_bracket_primitive()
    assert m.volume > 0
    # voxelize 24
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp:
        p=tmp.name; m.export(p)
        import pathlib
        with open(p,"rb") as f:
            b64=__import__("base64").b64encode(f.read()).decode()
        pathlib.Path(p).unlink()
    # quick optimize smoke 12³ (быстро)
    # не запускаем полный SIMP в unit-тесте, только voxelize
    import trimesh
    mat, pitch, origin, dims, vg = solver.voxelize_trimesh(m, resolution=12)
    assert mat.shape[0] > 0
    assert 0 < (mat>0).sum() < 150_000

def test_corpus_parse():
    # Проверяет что кэш корпуса парсится
    import pathlib, trimesh
    cache=pathlib.Path("tests/corpus/cache")
    if not cache.exists():
        return
    files=list(cache.glob("*.stl"))
    if not files:
        return
    for p in files[:2]:
        m=trimesh.load(p, force="mesh")
        assert m is not None
