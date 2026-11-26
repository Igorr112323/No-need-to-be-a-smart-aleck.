"""
Скачивает Three.js локально в web/vendor/
Запуск: python build/vendor.py
Использует api.github.com (разрешённый хост) — офлайн сборка без CDN.
"""
import pathlib, urllib.request, json, base64, sys

# r160 — версия из ТЗ
FILES = {
    "build/three.module.js": "vendor/three.module.js",
    "build/three.module.min.js": "vendor/three.module.min.js",
    "build/three.min.js": "vendor/three.min.js",
    "examples/jsm/controls/OrbitControls.js": "vendor/controls/OrbitControls.js",
}

def fetch_github(path, dest: pathlib.Path):
    api = f"https://api.github.com/repos/mrdoob/three.js/contents/{path}?ref=r160"
    print(f"→ {path} -> {dest}")
    try:
        with urllib.request.urlopen(api) as r:
            j = json.load(r)
        # содержимое может быть base64 или ссылка на blob
        if "content" in j and j["content"]:
            data = base64.b64decode(j["content"])
        else:
            # fallback — через git blob url
            blob_url = j["git_url"]
            with urllib.request.urlopen(blob_url) as rb:
                jb = json.load(rb)
                data = base64.b64decode(jb["content"])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"  OK: {len(data)} bytes")
        return True
    except Exception as e:
        print(f"  Ошибка: {e}", file=sys.stderr)
        return False

def main():
    roots = [
        pathlib.Path(__file__).parent.parent / "web",
        pathlib.Path(__file__).parent.parent / "openlight" / "web",
    ]
    for root in roots:
        for src, rel in FILES.items():
            dest = root / rel
            ok = fetch_github(src, dest)
            if not ok:
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    dest.write_text("// placeholder — скачайте вручную\n", encoding="utf-8")
        # дубль OrbitControls в корень vendor для совместимости
        for root2 in roots:
            c = root2 / "vendor" / "OrbitControls.js"
            src = root2 / "vendor" / "controls" / "OrbitControls.js"
            if src.exists():
                c.write_bytes(src.read_bytes())

if __name__ == "__main__":
    main()
