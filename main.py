"""
OpenLight — точка входа (Этап 7, фаза B).
Окно pywebview 1400x900, офлайн, js_api: файлы + реальное ядро МКЭ/SIMP.
"""
import os
import sys
import pathlib
import json
import base64
import time
import threading
import traceback
from datetime import datetime

APP_NAME = "OpenLight"
GITHUB_URL = "https://github.com/Igorr112323/OpenLight"
LICENSE_NAME = "MIT"

def get_version() -> str:
    # версия из build (нет хардкода) — читаем VERSION, иначе git describe, иначе fallback
    for cand in [pathlib.Path(__file__).parent / "VERSION", pathlib.Path(__file__).parent / "build" / "VERSION", pathlib.Path("VERSION"), pathlib.Path("build/VERSION")]:
        try:
            if cand.exists():
                v=cand.read_text(encoding="utf-8").strip()
                if v:
                    return v
        except: pass
    # try git describe
    try:
        import subprocess
        out=subprocess.check_output(["git","describe","--tags","--always"], text=True, stderr=subprocess.DEVNULL).strip()
        if out:
            return out.lstrip("v")
    except: pass
    return "1.0.0"
APP_VERSION = get_version()

def get_app_data_dir() -> pathlib.Path:
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
        return pathlib.Path(base) / APP_NAME
    elif sys.platform == 'darwin':
        return pathlib.Path.home() / 'Library' / 'Application Support' / APP_NAME
    else:
        xdg = os.environ.get('XDG_DATA_HOME', os.path.join(os.path.expanduser('~'), '.config'))
        return pathlib.Path(xdg) / APP_NAME

# ——— DIAG: флаг --diag — лог в файл + debug ———
DIAG_MODE = "--diag" in sys.argv

def _diag_log_path() -> pathlib.Path:
    base = get_app_data_dir()
    p = base / "logs" / "init.log"
    return p

def diag_log(msg: str):
    # всегда пишет в файл если --diag, иначе только при ошибке
    try:
        path = _diag_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        line = f"[{ts}] {msg}\n"
        with open(path, "a", encoding="utf-8") as f:
            f.write(line)
        if DIAG_MODE:
            try:
                print(line, end="")
            except:
                pass
    except Exception as e:
        try:
            print(f"diag_log failed: {e}")
        except:
            pass

if DIAG_MODE:
    # свежий лог на каждый запуск с --diag
    try:
        p = _diag_log_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        # ротация: если >1МБ — перезаписать
        if p.exists() and p.stat().st_size > 1024*1024:
            p.write_text("", encoding="utf-8")
        diag_log(f"=== OpenLight {APP_VERSION} --diag start ===")
        diag_log(f"argv={sys.argv}")
        diag_log(f"exe={sys.executable} cwd={os.getcwd()} frozen={getattr(sys,'frozen',False)}")
        # _MEIPASS/web
        meipass = getattr(sys, '_MEIPASS', None)
        diag_log(f"_MEIPASS={meipass}")
        base = pathlib.Path(__file__).parent
        if meipass:
            base = pathlib.Path(meipass)
        web_root = base / "web"
        diag_log(f"web_root={web_root} exists={web_root.exists()}")
        idx = web_root / "index.html"
        diag_log(f"web/index.html exists={idx.exists()} size={idx.stat().st_size if idx.exists() else 'NA'}")
        for rel in ["vendor/three.module.js","vendor/OrbitControls.js","vendor/STLLoader.js","vendor/STLExporter.js","vendor/three.min.js"]:
            fp = web_root / rel
            diag_log(f"web/{rel} exists={fp.exists()} size={(fp.stat().st_size if fp.exists() else 'NA')}")
        for cand in [pathlib.Path(__file__).parent / "VERSION", pathlib.Path("VERSION"), pathlib.Path(meipass)/"VERSION" if meipass else None]:
            if cand:
                diag_log(f"VERSION cand {cand} exists={cand.exists()} val={(cand.read_text(encoding='utf-8').strip()[:40] if cand.exists() else 'NA')}")
        diag_log(f"APPDATA={get_app_data_dir()} exists={get_app_data_dir().exists()}")
        # WebView2 detection (Windows)
        if os.name == 'nt':
            try:
                import subprocess, shutil
                # via reg query
                out = subprocess.run(["reg","query",r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients"], capture_output=True, text=True, timeout=3)
                diag_log(f"WebView2 reg query rc={out.returncode} out_len={len(out.stdout)}")
                if out.returncode==0:
                    diag_log(out.stdout[:600])
                # via Get-ItemProperty for Edge version
                ps = subprocess.run(["powershell","-Command","(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\*' -ErrorAction SilentlyContinue | Select-Object -First 1 pv).pv"], capture_output=True, text=True, timeout=3)
                diag_log(f"WebView2 ps pv={ps.stdout.strip()[:200]}")
            except Exception as e:
                diag_log(f"WebView2 detect error: {e}")
    except Exception as e:
        diag_log(f"diag init error: {e}\n{traceback.format_exc()}")

# --selftest флаг (без окна) для CI проверки exe — работает и в --windowed (без консоли)
if "--selftest" in sys.argv:
    diag_log(f"--selftest start version={APP_VERSION}") if DIAG_MODE else None
    # в windowed-сборке консоли нет — пробуем AllocConsole, иначе пишем в stderr
    try:
        if os.name == 'nt':
            import ctypes
            ctypes.windll.kernel32.AllocConsole()
    except:
        pass
    print(f"OpenLight {APP_VERSION}")
    sys.stdout.flush()
    if DIAG_MODE:
        diag_log("--selftest done, exit 0")
    sys.exit(0)

# --diag без окна (только лог) для проверки Controlled Folder Access
if DIAG_MODE and "--diag-headless" in sys.argv:
    diag_log("--diag-headless: log only, exit 0")
    print(f"OpenLight {APP_VERSION} diag headless OK, log at {_diag_log_path()}")
    sys.exit(0)

APP_DATA_DIR = get_app_data_dir()
AUTOSAVE_PATH = APP_DATA_DIR / 'autosave.olight.json'
RECENT_PATH = APP_DATA_DIR / 'recent.json'

def ensure_app_data():
    try:
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
ensure_app_data()

def load_recent():
    try:
        if RECENT_PATH.exists():
            data = json.loads(RECENT_PATH.read_text(encoding='utf-8'))
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []

def save_recent(lst):
    try:
        RECENT_PATH.write_text(json.dumps(lst, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception as e:
        print('save_recent error', e)

def add_recent(path_str):
    try:
        lst = load_recent()
        lst = [p for p in lst if p.get('path') != path_str]
        lst.insert(0, {'path': path_str, 'name': os.path.basename(path_str), 'ts': int(time.time())})
        lst = lst[:5]
        save_recent(lst)
    except Exception as e:
        print('add_recent error', e)

def get_web_path() -> str:
    base = pathlib.Path(__file__).parent
    candidates = [
        base / "web" / "index.html",
        base / "openlight" / "web" / "index.html",
        pathlib.Path.cwd() / "web" / "index.html",
        pathlib.Path.cwd() / "openlight" / "web" / "index.html",
    ]
    for p in candidates:
        if p.exists():
            return p.resolve().as_uri()
    return (base / "web" / "index.html").resolve().as_uri()

# ——— оптимизация: фоновые задачи ———
_jobs = {}
_jobs_lock = threading.Lock()
_job_counter = 0

def _next_job_id():
    global _job_counter
    with _jobs_lock:
        _job_counter += 1
        return f"job-{_job_counter}-{int(time.time())}"

class Api:
    """Методы доступны в JS как window.pywebview.api.*"""

    def diag_log_js(self, msg: str):
        diag_log(f"JS: {msg}")
        return {'ok': True}

    def diag_ping(self, marker: str):
        diag_log(f"marker {marker}")
        return {'ok': True}

    # —— базовые ——
    def get_app_info(self):
        diag_log("API get_app_info called")
        try:
            ensure_app_data()
            # версия из build/VERSION, лицензия ждёт куратора, ссылка на GitHub
            res = {'version': APP_VERSION, 'appData': str(APP_DATA_DIR), 'name': APP_NAME, 'license': LICENSE_NAME, 'github': GITHUB_URL}
            diag_log(f"API get_app_info OK version={APP_VERSION} appData={APP_DATA_DIR}")
            return res
        except Exception as e:
            diag_log(f"API get_app_info ERROR {e}\n{traceback.format_exc()}")
            raise

    def get_recent(self):
        diag_log("API get_recent called")
        res = load_recent()
        diag_log(f"API get_recent OK len={len(res)}")
        return res

    def open_model(self):
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            file_types = ('3D модели (*.stl;*.obj;*.step;*.stp)', 'Все файлы (*.*)')
            result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
            if not result:
                return None
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path or not os.path.exists(path):
                return None
            ext = os.path.splitext(path)[1].lower()
            with open(path, 'rb') as f:
                data = f.read()
            if len(data) > 50 * 1024 * 1024:
                return {'error': 'Файл слишком большой (>50 МБ)'}
            b64 = base64.b64encode(data).decode('ascii')
            return {'name': os.path.basename(path), 'size': len(data), 'data': b64, 'path': path, 'ext': ext}
        except Exception as e:
            traceback.print_exc()
            return {'error': str(e)}

    def save_stl(self, b64_data, suggested_name="optimized.stl"):
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            file_types = ('STL (*.stl)', 'Все файлы (*.*)')
            result = win.create_file_dialog(webview.SAVE_DIALOG, allow_multiple=False, file_types=file_types, save_filename=suggested_name)
            if not result:
                return {'cancelled': True}
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path:
                return {'cancelled': True}
            if not os.path.splitext(path)[1]:
                path += '.stl'
            if isinstance(b64_data, str) and b64_data.startswith('data:'):
                b64_data = b64_data.split(',', 1)[-1]
            raw = base64.b64decode(b64_data)
            with open(path, 'wb') as f:
                f.write(raw)
            return {'ok': True, 'path': path}
        except Exception as e:
            traceback.print_exc()
            return {'error': str(e)}

    def save_project(self, json_str, suggested_name=None):
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            if not suggested_name:
                suggested_name = 'project.olight.json'
            if not suggested_name.endswith('.olight.json'):
                if not os.path.splitext(suggested_name)[1]:
                    suggested_name += '.olight.json'
            file_types = ('OpenLight проект (*.olight.json)', 'JSON (*.json)', 'Все файлы (*.*)')
            result = win.create_file_dialog(webview.SAVE_DIALOG, allow_multiple=False, file_types=file_types, save_filename=suggested_name)
            if not result:
                return {'cancelled': True}
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path:
                return {'cancelled': True}
            if not path.endswith('.olight.json') and not path.endswith('.json'):
                path += '.olight.json'
            json.loads(json_str)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(json_str)
            add_recent(path)
            return {'ok': True, 'path': path}
        except Exception as e:
            traceback.print_exc()
            return {'error': str(e)}

    def open_project(self):
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            file_types = ('OpenLight проект (*.olight.json)', 'JSON (*.json)', 'Все файлы (*.*)')
            result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
            if not result:
                return None
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path or not os.path.exists(path):
                return None
            with open(path, 'r', encoding='utf-8') as f:
                data = f.read()
            json.loads(data)
            add_recent(path)
            return {'ok': True, 'path': path, 'data': data, 'name': os.path.basename(path)}
        except Exception as e:
            traceback.print_exc()
            return {'error': str(e)}

    def open_project_path(self, path):
        try:
            if not path or not os.path.exists(path):
                return {'error': 'Файл не найден'}
            with open(path, 'r', encoding='utf-8') as f:
                data = f.read()
            json.loads(data)
            add_recent(path)
            return {'ok': True, 'path': path, 'data': data, 'name': os.path.basename(path)}
        except Exception as e:
            return {'error': str(e)}

    def autosave(self, json_str):
        try:
            ensure_app_data()
            payload = json.loads(json_str)
            payload['_autosave_ts'] = int(time.time())
            with open(AUTOSAVE_PATH, 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False)
            return {'ok': True}
        except Exception as e:
            return {'error': str(e)}

    def get_autosave_info(self):
        try:
            if not AUTOSAVE_PATH.exists():
                return {'exists': False}
            mtime = AUTOSAVE_PATH.stat().st_mtime
            age = time.time() - mtime
            if age > 7 * 24 * 3600:
                return {'exists': False, 'tooOld': True}
            data = AUTOSAVE_PATH.read_text(encoding='utf-8')
            json.loads(data)
            return {'exists': True, 'mtime': mtime, 'age': age, 'data': data}
        except Exception as e:
            return {'exists': False, 'error': str(e)}

    def clear_autosave(self):
        try:
            if AUTOSAVE_PATH.exists():
                AUTOSAVE_PATH.unlink()
            return {'ok': True}
        except Exception as e:
            return {'error': str(e)}

    # —— реальное ядро Этапа 7 ——
    def start_optimization(self, payload_json: str):
        """
        Запуск воксельного МКЭ+SIMP в фоне.
        payload: {stl_b64, supports, forces, keepZones, material, relief, resolution}
        Возвращает {job_id}
        """
        try:
            payload = json.loads(payload_json) if isinstance(payload_json, str) else payload_json
        except Exception as e:
            return {'error': f'Невалидный payload: {e}'}
        job_id = _next_job_id()
        with _jobs_lock:
            _jobs[job_id] = {
                'status': 'running',
                'progress': 0,
                'phase': 'Вокселизация',
                'msg': 'Подготовка...',
                'iteration': 0,
                'total_iter': 20,
                'result': None,
                'error': None,
                'start': time.time(),
            }
        def run():
            try:
                # ленивый импорт — чтобы не падать если нет зависимостей
                try:
                    # пробуем из openlight.solver или solver
                    try:
                        from openlight.solver import optimize_topology
                    except ImportError:
                        from solver import optimize_topology
                except Exception as e:
                    with _jobs_lock:
                        _jobs[job_id].update({'status': 'error', 'error': f'Модуль solver не найден: {e}'})
                    return

                def cb(info):
                    # info: {phase, pct, msg, elapsed, iteration}
                    with _jobs_lock:
                        if job_id in _jobs and _jobs[job_id]['status'] == 'running':
                            _jobs[job_id].update({
                                'phase': info.get('phase', ''),
                                'progress': float(info.get('pct', 0)),
                                'msg': info.get('msg', ''),
                                'iteration': info.get('iteration', 0),
                            })

                # вызов оптимизатора — E2 units, A2 process, A3 loadcases, A5 STEP
                result = optimize_topology(
                    stl_b64=payload.get('stl_b64'),
                    supports=payload.get('supports', []),
                    forces=payload.get('forces', []),
                    keep_zones=payload.get('keepZones', payload.get('keep_zones', [])),
                    material=payload.get('material', 'steel'),
                    relief=float(payload.get('relief', payload.get('targetRelief', 0.4))),
                    resolution=int(payload.get('resolution', 64)),
                    progress_cb=cb,
                    timeout=float(payload.get('timeout', 45)),
                    process=payload.get('process', 'cnc'),
                    units=payload.get('units', 'mm'),
                    file_name=payload.get('file_name', payload.get('importedName')),
                )
                with _jobs_lock:
                    _jobs[job_id].update({'status': 'done', 'progress': 100, 'phase': 'Готово', 'result': result})
            except TimeoutError as te:
                with _jobs_lock:
                    _jobs[job_id].update({'status': 'timeout', 'error': str(te), 'phase': 'Тайм-аут'})
            except Exception as e:
                traceback.print_exc()
                with _jobs_lock:
                    _jobs[job_id].update({'status': 'error', 'error': str(e), 'phase': 'Ошибка'})

        t = threading.Thread(target=run, daemon=True)
        t.start()
        return {'job_id': job_id, 'ok': True}

    def get_optimization_progress(self, job_id: str):
        with _jobs_lock:
            job = _jobs.get(job_id)
            if not job:
                return {'error': 'Задача не найдена'}
            # вернуть копию без тяжёлого result (но если done — с result)
            out = {k: v for k, v in job.items() if k != 'result'}
            if job['status'] == 'done' and job.get('result'):
                out['result'] = job['result']
            return out

    def get_optimization_result(self, job_id: str):
        with _jobs_lock:
            job = _jobs.get(job_id)
            if not job:
                return {'error': 'Задача не найдена'}
            if job['status'] != 'done':
                return {'error': 'Ещё не готово', 'status': job['status']}
            return {'ok': True, 'result': job['result']}

    def cancel_optimization(self, job_id: str):
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id]['status'] = 'cancelled'
                return {'ok': True}
        return {'error': 'Не найдено'}

    # —— управление окном (frameless) — светофор справа ——
    def minimize_window(self):
        diag_log("ui: minimize clicked")
        try:
            import webview
            if webview.windows:
                try:
                    webview.windows[0].minimize()
                    diag_log("ui: minimize via pywebview")
                except Exception as e:
                    diag_log(f"ui: minimize pywebview fail {e}, fallback ctypes")
                    raise
            return {'ok': True}
        except Exception as e:
            diag_log(f"ui: minimize error {e}")
            # fallback ctypes SW_MINIMIZE
            try:
                if os.name == 'nt':
                    import ctypes
                    hwnd = ctypes.windll.user32.FindWindowW(None, "OpenLight")
                    if hwnd:
                        ctypes.windll.user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
                        diag_log(f"ui: minimize via ctypes hwnd={hwnd}")
                        return {'ok': True}
            except Exception as ce:
                diag_log(f"ui: minimize ctypes fail {ce}")
            return {'error': str(e)}

    def maximize_window(self):
        diag_log("ui: maximize clicked")
        try:
            import webview
            if webview.windows:
                w = webview.windows[0]
                try:
                    if getattr(w, '_is_maximized', False):
                        try:
                            w.restore()
                        except Exception:
                            # ctypes restore
                            if os.name == 'nt':
                                import ctypes
                                hwnd = ctypes.windll.user32.FindWindowW(None, "OpenLight")
                                if hwnd:
                                    ctypes.windll.user32.ShowWindow(hwnd, 9)
                        w._is_maximized = False
                        diag_log("ui: restore")
                    else:
                        try:
                            w.maximize()
                        except Exception:
                            if os.name == 'nt':
                                import ctypes
                                hwnd = ctypes.windll.user32.FindWindowW(None, "OpenLight")
                                if hwnd:
                                    ctypes.windll.user32.ShowWindow(hwnd, 3)
                        w._is_maximized = True
                        diag_log("ui: maximize")
                except Exception as e:
                    diag_log(f"ui: maximize inner fail {e}")
                    w.maximize()
            return {'ok': True}
        except Exception as e:
            diag_log(f"ui: maximize error {e}")
            # fallback ctypes toggle
            try:
                if os.name == 'nt':
                    import ctypes
                    hwnd = ctypes.windll.user32.FindWindowW(None, "OpenLight")
                    if hwnd:
                        # check zoomed
                        is_max = ctypes.windll.user32.IsZoomed(hwnd)
                        cmd = 9 if is_max else 3  # SW_RESTORE / SW_MAXIMIZE
                        ctypes.windll.user32.ShowWindow(hwnd, cmd)
                        diag_log(f"ui: maximize ctypes hwnd={hwnd} is_max={is_max} cmd={cmd}")
                        return {'ok': True}
            except Exception as ce:
                diag_log(f"ui: maximize ctypes fail {ce}")
            return {'error': str(e)}

    def close_window(self):
        diag_log("ui: close clicked")
        try:
            import webview
            if webview.windows:
                webview.windows[0].destroy()
                diag_log("ui: close via pywebview destroy")
            return {'ok': True}
        except Exception as e:
            diag_log(f"ui: close error {e}")
            return {'error': str(e)}


def main():
    # двойной запуск из exe не открывает второе окно — только один инстанс
    diag_log(f"main() start diag={DIAG_MODE} version={APP_VERSION}")
    try:
        import webview
    except ImportError as e:
        diag_log(f"pywebview missing {e}")
        print("pywebview не установлен. Установите зависимости: pip install -r requirements.txt")
        import webbrowser
        url = get_web_path()
        print(f"Открываю {url} в браузере...")
        webbrowser.open(url)
        return
    url = get_web_path()
    diag_log(f"web url={url}")
    api = Api()
    # Фаза A: системную плашку скрываем — frameless окно (дизайн web/* не менялся)
    # На Windows frameless убирает чёрную системную плашку, оставляя только dot-grid пилюли
    diag_log("create_window frameless=True easy_drag=True")
    window = webview.create_window(
        "OpenLight",
        url=url,
        width=1400,
        height=900,
        min_size=(1100, 700),
        resizable=True,
        frameless=True,
        easy_drag=True,
        focus=True,
        js_api=api,
        background_color="#F9F9FB"
    )
    # обработчики событий для лога
    def _on_loaded():
        diag_log("event loaded")
    def _on_shown():
        diag_log("event shown")
    try:
        window.events.loaded += _on_loaded
        window.events.shown += _on_shown
    except Exception as e:
        diag_log(f"events bind error {e}")
    diag_log(f"webview.start debug={DIAG_MODE}")
    try:
        webview.start(debug=DIAG_MODE, http_port=42000 if DIAG_MODE else None)
        diag_log("webview.start returned")
    except Exception as e:
        diag_log(f"webview.start ERROR {e}\n{traceback.format_exc()}")
        raise

if __name__ == "__main__":
    main()
