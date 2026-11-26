"""
fetch_corpus.py — детерминированно качает корпус по manifest.json, проверяет sha256, идемпотентен.
Использование: python tools/fetch_corpus.py [--limit N] [--manifest tests/corpus/manifest.json]
Файлы в git не коммитим — качаются в workflow с кэшем.
Для внешнего origin скачиваем по raw URL (GH Actions имеет интернет), для openlight-proc генерируем.
"""
import argparse, json, pathlib, hashlib, urllib.request, sys, os

def sha256_of(path: pathlib.Path) -> str:
    h=hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(8192), b""):
            h.update(c)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest", default="tests/corpus/manifest.json")
    ap.add_argument("--dest", default="tests/corpus/cache")
    ap.add_argument("--limit", type=int, default=0, help="0=all")
    args=ap.parse_args()
    manifest=pathlib.Path(args.manifest)
    if not manifest.exists():
        print(f"manifest не найден: {manifest}", file=sys.stderr); sys.exit(1)
    data=json.loads(manifest.read_text(encoding="utf-8"))
    if args.limit>0:
        data=data[:args.limit]
    dest=pathlib.Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    ok=0; skip=0; fail=0
    for entry in data:
        file=entry["file"]
        url=entry["source_url"]
        exp=entry.get("sha256","")
        origin=entry.get("origin","external")
        out=dest / file
        # процедурные — генерируем
        if url.startswith("generated-procedural") or origin == "openlight-proc" or exp == "proc-generated":
            if out.exists():
                print(f"· {file} процедурный уже есть ({out.stat().st_size} bytes) — пропускаем")
                skip+=1; continue
            try:
                import trimesh
                if "bracket" in file:
                    m=trimesh.creation.box(extents=[56,78,10])
                elif "gear" in file:
                    m=trimesh.creation.icosphere(subdivisions=1)
                elif "housing" in file or "box" in file:
                    m=trimesh.creation.box(extents=[40,40,20])
                elif "hinge" in file:
                    m=trimesh.creation.cylinder(radius=5, height=20)
                elif "uav" in file or "frame" in file:
                    m=trimesh.creation.box(extents=[80,10,10])
                elif "thin" in file or "plate" in file or "lattice" in file:
                    m=trimesh.creation.box(extents=[60,60,2])
                else:
                    m=trimesh.creation.box(extents=[20,20,20])
                m.export(out)
                actual=sha256_of(out)
                print(f"✓ {file} процедурный сгенерирован ({out.stat().st_size} bytes sha256 {actual[:12]}…)")
                ok+=1
            except Exception as e:
                print(f"✗ {file} процедурная генерация failed: {e}", file=sys.stderr); fail+=1
            continue
        # проверка уже скачанного
        if out.exists():
            if exp in ("placeholder","placeholder-will-be-filled-on-first-fetch","","proc-generated"):
                print(f"· {file} уже есть {out.stat().st_size} bytes (sha256 check пропущен — placeholder)")
                skip+=1; continue
            actual=sha256_of(out)
            if actual==exp:
                print(f"· {file} уже есть и sha256 OK ({actual[:8]}… {out.stat().st_size} bytes)")
                skip+=1; continue
            else:
                print(f"⚠ {file} sha256 mismatch ожидалось {exp[:8]} получено {actual[:8]} — перекачиваем")
        if url.startswith("https://example.com"):
            print(f"· {file} placeholder URL {url} — пропускаем (заменить на реальный CC0)")
            skip+=1; continue
        print(f"→ {file} <- {url}")
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data_bytes=r.read()
            out.write_bytes(data_bytes)
            actual=sha256_of(out)
            if exp not in ("placeholder","placeholder-will-be-filled-on-first-fetch","","proc-generated") and actual!=exp:
                print(f"✗ {file} sha256 mismatch: ожидалось {exp} получено {actual}", file=sys.stderr)
                fail+=1
            else:
                print(f"  OK {len(data_bytes)} bytes sha256 {actual[:12]}…")
                if exp in ("placeholder","placeholder-will-be-filled-on-first-fetch","","proc-generated"):
                    print(f"  → обнови manifest sha256 для {file}: {actual}")
                ok+=1
        except Exception as e:
            print(f"✗ {file} download failed: {e}", file=sys.stderr); fail+=1
    print(f"\nИтог: ok {ok} skip {skip} fail {fail} из {len(data)}")
    if fail>0:
        sys.exit(1)

if __name__=="__main__":
    main()
