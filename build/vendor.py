"""
OpenLight vendor.py — интернет нужен только один раз, для вендора.
Скачивает pinned-версии Three.js r160 в web/vendor/ и проверяет SHA256.

Запуск:  python build/vendor.py
Повторный запуск без интернета — использует кэш (файлы уже на месте).

Pinned: three.js r160 (2023-11, последний с build/three.min.js)
  three.module.js      SHA256 76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495  1272972 bytes
  three.module.min.js  SHA256 9807b610d02fd0a1833fa7ceae44239652c78f3c  670681 bytes (опционально)
  three.min.js         SHA256 170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa  669884 bytes (deprecated, но для совместимости)
  OrbitControls.js     SHA256 5a44a9e86a2a0fb11933eed69bc2cd33c76a496854c1aed6ed776efa87d7b064  29868 bytes
  STLLoader.js         SHA256 896d006a48b8f125385a485ccae154dadee801a953f0b45ceffe7ddd8a29ca93  10029 bytes
  STLExporter.js       SHA256 d64440877b68a973c9c2fe6a0474c9c9ab996a12f1fa835fbc4ffa29158f176b   3890 bytes
  OBJLoader.js         SHA256 7792458abce807dcf6e5bbc81f289e1ee6925fa4  21175 bytes (опционально, для импорта OBJ)
"""
import pathlib, urllib.request, json, base64, sys, hashlib

THREE_VERSION = "r160"
BASE_API = "https://api.github.com/repos/mrdoob/three.js/contents"

# список (src, dest_rel) — допускает один src → несколько dest
FILES = [
    # обязательные плоские для Этапа 6 (web/vendor/*.js)
    ("build/three.min.js", "vendor/three.min.js"),
    ("examples/jsm/loaders/STLLoader.js", "vendor/STLLoader.js"),
    ("examples/jsm/controls/OrbitControls.js", "vendor/OrbitControls.js"),
    ("examples/jsm/exporters/STLExporter.js", "vendor/STLExporter.js"),
    # основные ES-модули + вложенные пути для работы приложения
    ("build/three.module.js", "vendor/three.module.js"),
    ("build/three.module.min.js", "vendor/three.module.min.js"),
    ("examples/jsm/loaders/OBJLoader.js", "vendor/OBJLoader.js"),
    ("examples/jsm/loaders/STLLoader.js", "vendor/loaders/STLLoader.js"),
    ("examples/jsm/loaders/OBJLoader.js", "vendor/loaders/OBJLoader.js"),
    ("examples/jsm/controls/OrbitControls.js", "vendor/controls/OrbitControls.js"),
    ("examples/jsm/exporters/STLExporter.js", "vendor/exporters/STLExporter.js"),
]

EXPECTED_SHA256 = {
    "vendor/three.module.js": "76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495",
    "vendor/three.min.js": "170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa",
    "vendor/OrbitControls.js": "5a44a9e86a2a0fb11933eed69bc2cd33c76a496854c1aed6ed776efa87d7b064",
    "vendor/STLLoader.js": "896d006a48b8f125385a485ccae154dadee801a953f0b45ceffe7ddd8a29ca93",
    "vendor/STLExporter.js": "d64440877b68a973c9c2fe6a0474c9c9ab996a12f1fa835fbc4ffa29158f176b",
}

def sha256_of(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()

def fetch_github(src_path: str, dest: pathlib.Path) -> bool:
    api = f"{BASE_API}/{src_path}?ref={THREE_VERSION}"
    print(f"→ {src_path} -> {dest}")
    try:
        with urllib.request.urlopen(api) as r:
            j = json.load(r)
        if j.get("content"):
            data = base64.b64decode(j["content"])
        else:
            blob_url = j["git_url"]
            with urllib.request.urlopen(blob_url) as rb:
                jb = json.load(rb)
                data = base64.b64decode(jb["content"])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"  OK: {len(data)} bytes")
        for key, expected in EXPECTED_SHA256.items():
            if dest.as_posix().endswith(key):
                actual = hashlib.sha256(data).hexdigest()
                if actual != expected:
                    print(f"  ⚠ SHA256 mismatch: ожидалось {expected}, получено {actual}", file=sys.stderr)
                else:
                    print(f"  ✓ SHA256 OK")
                break
        return True
    except Exception as e:
        print(f"  Ошибка: {e}", file=sys.stderr)
        return False

def main():
    roots = [
        pathlib.Path(__file__).parent.parent / "web",
        pathlib.Path(__file__).parent.parent / "openlight" / "web",
    ]
    ok_all = True
    for root in roots:
        for src, rel in FILES:
            dest = root / rel
            if dest.exists() and dest.stat().st_size > 100:
                print(f"· {dest} уже есть ({dest.stat().st_size} bytes) — пропускаем")
                continue
            ok = fetch_github(src, dest)
            if not ok:
                if not dest.exists():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_text("// placeholder — запустите python build/vendor.py с интернетом\n", encoding="utf-8")
                ok_all = False
        # проверка обязательных плоских
        for src, rel in FILES:
            if rel.startswith("vendor/") and rel.count("/") == 1:  # плоские в vendor/
                flat = root / rel
                if not flat.exists() or flat.stat().st_size < 100:
                    print(f"⚠ Нет обязательного {flat}", file=sys.stderr)
                    ok_all = False
    if ok_all:
        print("\n✓ Вендор готов — интернет больше не нужен, всё офлайн.")
    else:
        print("\n⚠ Часть файлов не скачалась — проверьте интернет и запустите снова.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
