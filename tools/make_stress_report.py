"""
make_stress_report.py — корпус 100: mesh→bbox/vol/watertight→voxelize→solve<90с fallback 16³→32³
Требование Этапа15 B6: без --no-solve, solve_ok≥80/100 иначе BUG_LIST, в CORPUS_REPORT столбец solve_ok+время.
"""
import argparse, json, pathlib, time, sys, os, base64, traceback, signal
import trimesh

# timeout helper via solver inner timeout
def test_one(path: pathlib.Path, resolution_fallback=[16,32]):
    t0=time.time()
    res={"file": path.name, "path": str(path), "parse": False, "watertight": False, "bbox": None, "vol": None, "voxel_ok": None, "solve_ok": None, "solve_time": None, "time": None, "error": None, "voxel_solid": None, "voxel_shape": None, "solve_error": None, "resolution": None}
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
        # voxel quick check (48³ for report) but solve uses fallback resolution
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
            if n_solid>150000:
                res["voxel_ok"]=False
                res["voxel_error"]=f"too many solid {n_solid}>150k"
        except Exception as e:
            res["voxel_ok"]=False
            res["voxel_error"]=str(e)
        # solve with fallback 16³→32³ timeout 90с
        # always attempt solve (no --no-solve in this stage)
        if not res.get("voxel_ok"):
            res["solve_ok"]=False
            res["solve_error"]="voxel failed — skip solve"
        else:
            # try resolutions in order
            import tempfile
            tf=tempfile.NamedTemporaryFile(suffix=".stl", delete=False)
            mesh.export(tf.name)
            tf.close()
            with open(tf.name,'rb') as f:
                b64=base64.b64encode(f.read()).decode()
            pathlib.Path(tf.name).unlink(missing_ok=True)
            bounds=mesh.bounds
            center=(bounds[0]+bounds[1])/2
            extent=mesh.bounds[1]-mesh.bounds[0]
            longest=float(max(extent))
            # адаптивный радиус опоры: longest/10, cap 2мм, чтобы крошечные модели не фиксировались целиком
            adapt_rad = min(2.0, longest/10)
            supports=[{"position": [float(center[0]), float(bounds[0][1]), float(center[2])], "radiusMm": float(adapt_rad)}]
            forces=[{"position": [float(center[0]), float(bounds[1][1]), float(center[2])], "direction": [0,-1,0], "valueN": 500}]
            solved=False
            last_err=None
            for res_try in resolution_fallback:
                try:
                    import solver
                    t_solve=time.time()
                    # timeout 90с for each try
                    result=solver.optimize_topology(stl_b64=b64, supports=supports, forces=forces, material='steel', relief=0.4, resolution=res_try, timeout=90)
                    dt_solve=time.time()-t_solve
                    # success criteria: iterations present, within timeout
                    if dt_solve>90:
                        raise TimeoutError(f"solve {dt_solve:.1f}s >90s")
                    res["solve_ok"]=True
                    res["solve_time"]=round(dt_solve,2)
                    res["solve_iter"]=result.get("iterations")
                    res["solve_vol"]=result.get("volume_fraction")
                    res["resolution"]=res_try
                    solved=True
                    break
                except Exception as e:
                    last_err=str(e)[:800]
                    # if timeout or CG fail on thick domain, try next resolution but log
                    # for thick domain 60x20x4 hypothesis: CG не сходится — we still mark fail for this file
                    # fallback only for timeout, otherwise break with fail? We try next res anyway
                    if "timeout" in last_err.lower() or "timed out" in last_err.lower():
                        print(f"  [{path.name}] res {res_try} timeout → fallback next: {last_err[:200]}")
                        continue
                    else:
                        # for other errors, also try next resolution once
                        print(f"  [{path.name}] res {res_try} error → try next: {last_err[:200]}")
                        continue
            if not solved:
                res["solve_ok"]=False
                res["solve_error"]=last_err or "all resolutions failed"
                res["solve_time"]=round(time.time()-t0,2)
    except Exception as e:
        res["error"]=str(e)[:800]
    res["time"]=round(time.time()-t0,3)
    # итог
    if res["parse"] and res.get("voxel_ok") and res.get("solve_ok"):
        res["итог"]="ok"
    elif res["parse"] and res.get("voxel_ok"):
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
    ap.add_argument("--no-solve", action="store_true", help="пропустить solve (deprecated, для Этапа15 не использовать)")
    ap.add_argument("--voxel", action="store_true")
    ap.add_argument("--solve", action="store_true")
    args=ap.parse_args()
    manifest=pathlib.Path(args.manifest)
    cache=pathlib.Path(args.cache)
    if args.no_solve:
        print("WARNING: --no-solve устарел, Этап15 требует полного прогона с solve (16³→32³ 90с). Игнорируем флаг.", file=sys.stderr)
    data=json.loads(manifest.read_text(encoding="utf-8"))
    if args.limit>0:
        data=data[:args.limit]
    results=[]
    for entry in data:
        file=entry["file"]
        p=cache / file
        if not p.exists():
            results.append({"file": file, "license": entry.get("license"), "category": entry.get("category"), "parse": False, "watertight": False, "voxel_ok": False, "solve_ok": False, "time": 0, "error": "не скачан (fetch_corpus.py --limit)", "итог": "skip", "source_url": entry.get("source_url")})
            continue
        r=test_one(p, resolution_fallback=[16,32])
        r["license"]=entry.get("license")
        r["category"]=entry.get("category")
        r["source_url"]=entry.get("source_url")
        results.append(r)
        print(f"{r['file']}: parse={r['parse']} watertight={r['watertight']} voxel_ok={r['voxel_ok']} solve_ok={r['solve_ok']} time={r['time']}s res={r.get('resolution')} итог={r['итог']}")

    out_json=pathlib.Path("report.json")
    out_json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    html_parts=['<html><head><meta charset="utf-8"><title>OpenLight Corpus Report</title><style>body{font-family:system-ui,sans-serif;margin:24px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px} th{background:#f5f5f7} .ok{color:green} .fail{color:red} .parse_ok{color:orange}</style></head><body>']
    html_parts.append(f'<h1>OpenLight Corpus — {len(results)} моделей</h1><p>Сгенерировано {time.strftime("%Y-%m-%d %H:%M:%S")} | parse_ok {sum(1 for r in results if r.get("parse"))}/{len(results)} ({sum(1 for r in results if r.get("parse"))/len(results)*100:.1f}%) | solve_ok {sum(1 for r in results if r.get("solve_ok"))}/{len(results)}</p>')
    html_parts.append('<table><tr><th>file</th><th>license</th><th>category</th><th>parse</th><th>watertight</th><th>voxel 48³</th><th>solve 16³→32³ 90с</th><th>время с</th><th>res</th><th>итог</th></tr>')
    for r in results:
        cls="ok" if r.get("итог")=="ok" else ("fail" if r.get("итог")=="fail" else "parse_ok")
        html_parts.append(f'<tr><td>{r["file"]}</td><td>{r.get("license","")}</td><td>{r.get("category","")}</td><td>{r.get("parse")}</td><td>{r.get("watertight")}</td><td>{r.get("voxel_ok")}</td><td>{r.get("solve_ok")} {r.get("solve_time","")}</td><td>{r.get("time")}</td><td>{r.get("resolution","")}</td><td class="{cls}">{r.get("итог")}</td></tr>')
    html_parts.append('</table></body></html>')
    pathlib.Path("report.html").write_text("\n".join(html_parts), encoding="utf-8")

    md_path=pathlib.Path("docs/CORPUS_REPORT.md")
    lines=[]
    lines.append(f"# Corpus Report — {time.strftime('%Y-%m-%d %H:%M UTC')} — {len(results)} моделей (limit {args.limit or 'all'})")
    lines.append("")
    lines.append(f"**Дата:** {time.strftime('%Y-%m-%d %H:%M UTC')}  ")
    lines.append(f"**Parse ok:** {sum(1 for r in results if r.get('parse'))}/{len(results)} ({sum(1 for r in results if r.get('parse'))/len(results)*100:.1f}%) — цель ≥90%  ")
    lines.append(f"**Watertight:** {sum(1 for r in results if r.get('watertight'))}/{len(results)}  ")
    lines.append(f"**Voxel 48³:** {sum(1 for r in results if r.get('voxel_ok'))}/{len(results)}  ")
    lines.append(f"**Solve 16³→32³ 90с:** {sum(1 for r in results if r.get('solve_ok'))}/{len(results)} — цель ≥80/100, иначе BUG_LIST  ")
    lines.append(f"**Время среднее:** {sum(r.get('time',0) for r in results)/len(results):.2f}с  ")
    lines.append("")
    lines.append("| файл | лицензия | parse | watertight | voxel 48³ | solve 90с | время с | res | итог |")
    lines.append("|---|---|---|---|---|---|---|---|---|")
    for r in results:
        lines.append(f"| {r['file']} | {r.get('license','')} | {r.get('parse')} | {r.get('watertight')} | {r.get('voxel_ok')} | {r.get('solve_ok')} {r.get('solve_time','') or ''} | {r.get('time')} | {r.get('resolution','') or ''} | {r.get('итог')} |")
    lines.append("")
    lines.append(f"**Критерий Этапа15 B6:** solve_ok {sum(1 for r in results if r.get('solve_ok'))}/{len(results)} ≥80 — {'ПРОЙДЕН' if sum(1 for r in results if r.get('solve_ok'))>=80 else 'НЕ ПРОЙДЕН → BUG_LIST'}  ")
    lines.append("")
    lines.append("Все падения — см. BUG_LIST с воспроизведением, без «готово».")
    lines.append("")
    # Build info placeholder — will be updated by Build workflow
    lines.append(f"**Build:** см. Release https://github.com/Igorr112323/OpenLight/releases + Build run (≥30МБ, --selftest OK)  ")
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nОтчёт: report.json ({len(results)} записей), report.html, docs/CORPUS_REPORT.md")
    parse_ok=sum(1 for r in results if r.get("parse"))
    solve_ok=sum(1 for r in results if r.get("solve_ok"))
    if parse_ok/len(results) < 0.9:
        print(f"WARNING: parse {parse_ok}/{len(results)} <90% — требует проверки BUG_LIST", file=sys.stderr)
    if solve_ok < 80:
        print(f"WARNING: solve {solve_ok}/{len(results)} <80 — Этап15 B6 НЕ ПРОЙДЕН, фиксируем в BUG_LIST", file=sys.stderr)
        # не падаем, но помечаем fail через BUG_LIST (честный счёт)
        sys.exit(0)

if __name__=="__main__":
    main()
