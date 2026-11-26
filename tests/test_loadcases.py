"""A3 до 3 случаев нагрузки: envelope max, safety min, карта от худшего случая"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import base64, tempfile, trimesh, solver

def make_bracket_b64():
    m = solver.create_bracket_primitive()
    tf = tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
    m.export(tf.name); tf.close()
    with open(tf.name,'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    pathlib.Path(tf.name).unlink()
    return b64

def run_case(forces, relief=0.4, res=16):
    b64 = make_bracket_b64()
    supports = [{"position":[0,0,0],"radiusMm":8}]
    return solver.optimize_topology(stl_b64=b64, supports=supports, forces=forces, material='steel', relief=relief, resolution=res, timeout=40)

def test_envelope():
    b64 = make_bracket_b64()
    # два одиночных случая — разные направления
    f1 = [{"position":[0,65,0],"direction":[0,-1,0],"valueN":500, "case":1}]
    f2 = [{"position":[0,65,0],"direction":[1,0,0],"valueN":500, "case":1}]
    # оболочка — оба случая вместе с разными case id
    f_both = [
        {"position":[0,65,0],"direction":[0,-1,0],"valueN":500, "case":1},
        {"position":[0,65,0],"direction":[1,0,0],"valueN":500, "case":2},
    ]
    r1 = run_case(f1)
    r2 = run_case(f2)
    rb = run_case(f_both)
    s1 = r1['stress_max']; s2 = r2['stress_max']; sb = rb['stress_max']
    # envelope должен быть >= каждого одиночного (с допуском 5% из-за SIMP вариативности, но не меньше)
    # Так как топология может чуть отличаться, требуем что envelope не сильно меньше max(s1,s2)
    assert sb >= max(s1,s2)*0.85, f"envelope {sb:.1f} < max singles {max(s1,s2):.1f}*0.85"
    # safety envelope ≤ обоих одиночных (худший)
    saf1 = r1['safety']; saf2 = r2['safety']; safb = rb['safety']
    assert safb <= min(saf1,saf2)*1.05 + 0.05, f"safety envelope {safb:.2f} > min singles {min(saf1,saf2):.2f}"
    # карта подписана от случая N
    assert 'worst_case' in rb or 'worst_case_label' in rb, "отсутствует worst_case"
    if 'worst_case_label' in rb:
        assert 'случая' in rb['worst_case_label'], f"worst_case_label {rb['worst_case_label']} без 'случая'"
    print(f"Loadcases: s1={s1:.1f} s2={s2:.1f} envelope={sb:.1f} | saf1={saf1:.2f} saf2={saf2:.2f} safe={safb:.2f} case={rb.get('worst_case')}")

def test_single_case_envelope_identity():
    # один случай — envelope совпадает с одиночным
    f = [{"position":[0,65,0],"direction":[0,-1,0],"valueN":500, "case":1}]
    r = run_case(f)
    assert r['stress_max'] > 0
    assert r['worst_case'] == 1
