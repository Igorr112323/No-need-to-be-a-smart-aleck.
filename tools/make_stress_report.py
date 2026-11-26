"""
make_stress_report.py — прогоняет корпус через mesh-load → bbox/vol/watertight → voxelize 48³
Пишет report.json + report.html (простая таблица, нейтральный стиль) с полями: file/license/parse/watertight/voxel_ok/время/итог.
"""
import argparse, json, pathlib, time, sys
import trimesh

def test_one(path: pathlib.Path, do_voxel=False):
    t0=time.time()
    res={"file": path.name, "path": str(path), "parse": False, "watertight": False, "bbox": None, "vol": None, "voxel_ok": None, "time": None, "error": None}
    try:
        mesh=trimesh.load(path, force="mesh")
        if isinstance(mesh, trimesh.Scene):
            # concatenate
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
                # voxelize 48³ по длинной стороне
                extent=mesh.bounds[1]-mesh.bounds[0]
                longest=float(max(extent))
                pitch=longest/48
                vg=mesh.voxelized(pitch=pitch)
                mat=vg.matrix
                res["voxel_ok"]=bool(mat.size>0 and mat.shape[0]>0)
                # также проверить что solid <150k
                n_solid=int((mat>0).sum())
                res["voxel_solid"]=n_solid
                res["voxel_shape"]=list(mat.shape)
            except Exception as e:
                res["voxel_ok"]=False
                res["voxel_error"]=str(e)
        else:
            res["voxel_ok"]=None
    except Exception as e:
        res["error"]=str(e)
    res["time"]=round(time.time()-t0,3)
    res["итог"]="ok" if res["parse"] and res["watertight"] else ("parse_ok" if res["parse"] else "fail")
    return res

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest", default="tests/corpus/manifest.json")
    ap.add_argument("--cache", default="tests/corpus/cache")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--voxel", action="store_true", help="делать voxelize 48³")
    args=ap.parse_args()
    manifest=pathlib.Path(args.manifest)
    cache=pathlib.Path(args.cache)
    data=json.loads(manifest.read_text(encoding="utf-8"))
    if args.limit>0:
        data=data[:args.limit]
    results=[]
    for entry in data:
        file=entry["file"]
        p=cache / file
        if not p.exists():
            # пропускаем отсутствующие (ещё не скачаны)
            results.append({"file": file, "license": entry.get("license"), "category": entry.get("category"), "parse": False, "watertight": False, "voxel_ok": False, "time": 0, "error": "не скачан (fetch_corpus.py --limit)", "итог": "skip"})
            continue
        r=test_one(p, do_voxel=args.voxel or True)
        r["license"]=entry.get("license")
        r["category"]=entry.get("category")
        r["source_url"]=entry.get("source_url")
        results.append(r)
        print(f"{r['file']}: parse={r['parse']} watertight={r['watertight']} voxel_ok={r['voxel_ok']} time={r['time']}s итог={r['итог']}")

    # пишем report.json
    out_json=pathlib.Path("report.json")
    out_json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    # report.html
    html_parts=['<html><head><meta charset="utf-8"><title>OpenLight Corpus Report</title><style>body{font-family:system-ui,sans-serif;margin:24px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px} th{background:#f5f5f7} .ok{color:green} .fail{color:red}</style></head><body>']
    html_parts.append(f'<h1>OpenLight Corpus — {len(results)} моделей</h1><p>Сгенерировано {time.strftime("%Y-%m-%d %H:%M:%S")}</p>')
    html_parts.append('<table><tr><th>file</th><th>license</th><th>category</th><th>parse</th><th>watertight</th><th>voxel_ok</th><th>время с</th><th>итог</th><th>bbox</th></tr>')
    for r in results:
        cls="ok" if r.get("итог")=="ok" else "fail"
        html_parts.append(f'<tr><td>{r["file"]}</td><td>{r.get("license","")}</td><td>{r.get("category","")}</td><td>{r.get("parse")}</td><td>{r.get("watertight")}</td><td>{r.get("voxel_ok")}</td><td>{r.get("time")}</td><td class="{cls}">{r.get("итог")}</td><td>{r.get("bbox")}</td></tr>')
    html_parts.append('</table></body></html>')
    pathlib.Path("report.html").write_text("\n".join(html_parts), encoding="utf-8")
    print(f"\nОтчёт: report.json ({len(results)} записей), report.html")

if __name__=="__main__":
    main()
