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
LICENSE_NAME = "MIT (ожидает выбора куратора)"

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
    return "0.9.3-test"
APP_VERSION = get_version()

# --selftest флаг (без окна) для CI проверки exe
if "--selftest" in sys.argv:
    print(f"OpenLight {APP_VERSION}")
    sys.exit(0)

def get_app_data_dir() -> pathlib.Path:
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
        return pathlib.Path(base) / APP_NAME
    elif sys.platform == 'darwin':
        return pathlib.Path.home() / 'Library' / 'Application Support' / APP_NAME
    else:
        xdg = os.environ.get('XDG_DATA_HOME', os.path.join(os.path.expanduser('~'), '.config'))
        return pathlib.Path(xdg) / APP_NAME

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

    # —— базовые ——
    def get_app_info(self):
        ensure_app_data()
        # версия из build/VERSION, лицензия ждёт куратора, ссылка на GitHub
        return {'version': APP_VERSION, 'appData': str(APP_DATA_DIR), 'name': APP_NAME, 'license': LICENSE_NAME, 'github': GITHUB_URL}

    def get_recent(self):
        return load_recent()

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

                # вызов оптимизатора
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


def main():
    try:
        import webview
    except ImportError:
        print("pywebview не установлен. Установите зависимости: pip install -r requirements.txt")
        import webbrowser
        url = get_web_path()
        print(f"Открываю {url} в браузере...")
        webbrowser.open(url)
        return
    url = get_web_path()
    api = Api()
    window = webview.create_window(
        "OpenLight",
        url=url,
        width=1400,
        height=900,
        min_size=(1100, 700),
        resizable=True,
        js_api=api
    )
    webview.start(debug=False)

if __name__ == "__main__":
    main()
