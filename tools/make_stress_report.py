"""
make_stress_report.py — прогоняет корпус через mesh-load → bbox/vol/watertight → voxelize 48³ → solve <60c
Пишет report.json + report.html + docs/CORPUS_REPORT.md с полями: file/license/parse/watertight/voxel_ok/solve_ok/время/итог.
Требование: ≥90% parse ok; все падения — в BUG_LIST.
"""
import argparse, json, pathlib, time, sys, os, base64, traceback
import trimesh

def test_one(path: pathlib.Path, do_voxel=True, do_solve=False):
    t0=time.time()
    res={"file": path.name, "path": str(path), "parse": False, "watertight": False, "bbox": None, "vol": None, "voxel_ok": None, "solve_ok": None, "solve_time": None, "time": None, "error": None, "voxel_solid": None, "voxel_shape": None, "solve_error": None}
    try:
        mesh=trimesh.load(path, force="mesh")
        if isinstance(mesh, trimesh.Scene):
            meshes=list(mesh.geometry.values())
            if not meshes:
                raise ValueError("Scene без геометрии")
            mesh=trimesh.util.concatenate(meshes)
        res["parse"]=True
        res["watertight"]=bool(mesh.is_watertight)
        res["bbox"]=mesh.bounds.tolist()
        try:
            res["vol"]=float(abs(mesh.volume))
        except: res["vol"]=None
        if do_voxel:
            try:
                extent=mesh.bounds[1]-mesh.bounds[0]
                longest=float(max(extent))
                pitch=longest/48
                vg=mesh.voxelized(pitch=pitch)
                mat=vg.matrix
                res["voxel_ok"]=bool(mat.size>0 and mat.shape[0]>0)
                n_solid=int((mat>0).sum())
                res["voxel_solid"]=n_solid
                res["voxel_shape"]=list(mat.shape)
                res["voxel_pitch"]=pitch
                # check limits
                if n_solid>150000:
                    res["voxel_ok"]=False
                    res["voxel_error"]=f"too many solid {n_solid}>150k"
            except Exception as e:
                res["voxel_ok"]=False
                res["voxel_error"]=str(e)
        else:
            res["voxel_ok"]=None
        # solve <60s via solver.optimize_topology if voxel_ok
        if do_solve and res.get("voxel_ok"):
            try:
                import solver
                # экспорт меша в b64 STL
                import tempfile
                tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
                mesh.export(tf.name)
                tf.close()
                with open(tf.name,'rb') as f:
                    b64=base64.b64encode(f.read()).decode()
                pathlib.Path(tf.name).unlink()
                # generic supports/forces: fix bottom, force top
                # find bbox centers for supports/forces
                bounds=mesh.bounds
                center=(bounds[0]+bounds[1])/2
                # support at bottom center, force at top center
                supports=[{"position": [float(center[0]), float(bounds[0][1]), float(center[2])], "radiusMm": 2}]
                forces=[{"position": [float(center[0]), float(bounds[1][1]), float(center[2])], "direction": [0,-1,0], "valueN": 500}]
                t_solve=time.time()
                # solve with resolution 48, timeout 55
                result=solver.optimize_topology(stl_b64=b64, supports=supports, forces=forces, material='steel', relief=0.4, resolution=48, timeout=55)
                dt_solve=time.time()-t_solve
                res["solve_ok"]=True
                res["solve_time"]=round(dt_solve,2)
                res["solve_iter"]=result.get("iterations")
                res["solve_vol"]=result.get("volume_fraction")
            except Exception as e:
                res["solve_ok"]=False
                res["solve_error"]=str(e)[:500]
                res["solve_time"]=round(time.time()-t0,2)
                # traceback for debug
                # print(f"solve fail {path.name}: {e}", file=sys.stderr)
        elif do_solve:
            res["solve_ok"]=False
            res["solve_error"]="voxel failed — skip solve"
    except Exception as e:
        res["error"]=str(e)[:500]
    res["time"]=round(time.time()-t0,3)
    # итог: ok if parse+watertight+voxel+solve, parse_ok if parse only, fail otherwise
    if res["parse"] and res["watertight"] and res.get("voxel_ok") and res.get("solve_ok"):
        res["итог"]="ok"
    elif res["parse"] and res["watertight"] and res.get("voxel_ok"):
        # voxel ok but solve maybe not required for parse≥90% criterion
        res["итог"]="voxel_ok"
    elif res["parse"]:
        res["итог"]="parse_ok"
    else:
        res["итог"]="fail"
    return res

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest", default="tests/corpus/manifest.json")
    ap.add_argument("--cache", default="tests/corpus/cache")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--voxel", action="store_true", help="делать voxelize 48³")
    ap.add_argument("--solve", action="store_true", help="делать solve <60c")
    ap.add_argument("--no-solve", action="store_true", help="пропустить solve (для быстрого прогона)")
    args=ap.parse_args()
    manifest=pathlib.Path(args.manifest)
    cache=pathlib.Path(args.cache)
    data=json.loads(manifest.read_text(encoding="utf-8"))
    if args.limit>0:
        data=data[:args.limit]
    do_voxel=True
    do_solve=not args.no_solve
    # by default voxel+solve
    results=[]
    for entry in data:
        file=entry["file"]
        p=cache / file
        if not p.exists():
            results.append({"file": file, "license": entry.get("license"), "category": entry.get("category"), "parse": False, "watertight": False, "voxel_ok": False, "solve_ok": False, "time": 0, "error": "не скачан (fetch_corpus.py --limit)", "итог": "skip", "source_url": entry.get("source_url")})
            continue
        r=test_one(p, do_voxel=do_voxel, do_solve=do_solve)
        r["license"]=entry.get("license")
        r["category"]=entry.get("category")
        r["source_url"]=entry.get("source_url")
        results.append(r)
        print(f"{r['file']}: parse={r['parse']} watertight={r['watertight']} voxel_ok={r['voxel_ok']} solve_ok={r['solve_ok']} time={r['time']}s итог={r['итог']}")

    # пишем report.json
    out_json=pathlib.Path("report.json")
    out_json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    # report.html
    html_parts=['<html><head><meta charset="utf-8"><title>OpenLight Corpus Report</title><style>body{font-family:system-ui,sans-serif;margin:24px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px} th{background:#f5f5f7} .ok{color:green} .fail{color:red} .parse_ok{color:orange}</style></head><body>']
    html_parts.append(f'<h1>OpenLight Corpus — {len(results)} моделей</h1><p>Сгенерировано {time.strftime("%Y-%m-%d %H:%M:%S")} | parse_ok {sum(1 for r in results if r.get("parse"))}/{len(results)} ({sum(1 for r in results if r.get("parse"))/len(results)*100:.1f}%)</p>')
    html_parts.append('<table><tr><th>file</th><th>license</th><th>category</th><th>parse</th><th>watertight</th><th>voxel 48³</th><th>solve &lt;60c</th><th>время с</th><th>итог</th></tr>')
    for r in results:
        cls="ok" if r.get("итог")=="ok" else ("fail" if r.get("итог")=="fail" else "parse_ok")
        html_parts.append(f'<tr><td>{r["file"]}</td><td>{r.get("license","")}</td><td>{r.get("category","")}</td><td>{r.get("parse")}</td><td>{r.get("watertight")}</td><td>{r.get("voxel_ok")}</td><td>{r.get("solve_ok")}</td><td>{r.get("time")}</td><td class="{cls}">{r.get("итог")}</td></tr>')
    html_parts.append('</table></body></html>')
    pathlib.Path("report.html").write_text("\n".join(html_parts), encoding="utf-8")

    # docs/CORPUS_REPORT.md
    md_path=pathlib.Path("docs/CORPUS_REPORT.md")
    lines=[]
    lines.append(f"# Corpus Report — {time.strftime('%Y-%m-%d %H:%M UTC')} — {len(results)} моделей (limit {args.limit or 'all'})")
    lines.append("")
    lines.append(f"**Дата:** {time.strftime('%Y-%m-%d %H:%M UTC')}  ")
    lines.append(f"**Parse ok:** {sum(1 for r in results if r.get('parse'))}/{len(results)} ({sum(1 for r in results if r.get('parse'))/len(results)*100:.1f}%) — цель ≥90%  ")
    lines.append(f"**Watertight:** {sum(1 for r in results if r.get('watertight'))}/{len(results)}  ")
    lines.append(f"**Voxel 48³:** {sum(1 for r in results if r.get('voxel_ok'))}/{len(results)}  ")
    lines.append(f"**Solve <60c:** {sum(1 for r in results if r.get('solve_ok'))}/{len(results)}  ")
    lines.append("")
    lines.append("| файл | лицензия | parse | watertight | voxel 48³ | solve <60c | итог |")
    lines.append("|---|---|---|---|---|---|---|")
    for r in results:
        lines.append(f"| {r['file']} | {r.get('license','')} | {r.get('parse')} | {r.get('watertight')} | {r.get('voxel_ok')} | {r.get('solve_ok')} | {r.get('итог')} |")
    lines.append("")
    lines.append("Все падения — см. BUG_LIST с воспроизведением, без «готово».")
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"\nОтчёт: report.json ({len(results)} записей), report.html, docs/CORPUS_REPORT.md")
    # also print summary for CI
    parse_ok=sum(1 for r in results if r.get("parse"))
    if parse_ok/len(results) < 0.9:
        print(f"WARNING: parse {parse_ok}/{len(results)} <90% — требует проверки BUG_LIST", file=sys.stderr)

if __name__=="__main__":
    main()
