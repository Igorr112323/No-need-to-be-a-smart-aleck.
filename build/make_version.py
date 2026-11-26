"""
make_version.py — генерирует VERSION из git тега/коммита для окна «О программе».
Версия берётся из: GITHUB_REF (ci), git describe --tags, или VERSION файла, fallback 1.0.0.
Пишет в VERSION (корень) и build/VERSION для pyinstaller --add-data.
"""
import pathlib, subprocess, os, sys

def get_version():
    # 1. env GITHUB_REF_NAME (tag push)
    ref = os.environ.get("GITHUB_REF", "")
    if ref.startswith("refs/tags/"):
        return ref.split("/")[-1].lstrip("v")
    # 2. git describe
    try:
        out = subprocess.check_output(["git", "describe", "--tags", "--always", "--dirty"], text=True).strip()
        # normalize v prefix
        if out.startswith("v"):
            out = out[1:]
        return out
    except:
        pass
    # 3. existing VERSION file
    for p in [pathlib.Path("VERSION"), pathlib.Path("build/VERSION")]:
        if p.exists():
            txt = p.read_text().strip()
            if txt:
                return txt
    return "1.0.0"

def main():
    ver = get_version()
    # write both
    pathlib.Path("VERSION").write_text(ver + "\n", encoding="utf-8")
    pathlib.Path("build/VERSION").parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path("build/VERSION").write_text(ver + "\n", encoding="utf-8")
    print(f"VERSION={ver}")
    return ver

if __name__ == "__main__":
    main()
