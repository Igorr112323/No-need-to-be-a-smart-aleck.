"""
OpenLight — точка входа (Этап 5).
Окно pywebview 1400x900, офлайн, js_api для файлов/проектов/автосейва.
"""
import os
import sys
import pathlib
import json
import base64
import time
from datetime import datetime

APP_VERSION = "0.5.0"
APP_NAME = "OpenLight"

def get_app_data_dir() -> pathlib.Path:
    # Windows: %APPDATA%\OpenLight
    # macOS: ~/Library/Application Support/OpenLight
    # Linux: $XDG_DATA_HOME/OpenLight или ~/.config/OpenLight
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
        # убрать дубли
        lst = [p for p in lst if p.get('path') != path_str]
        lst.insert(0, {'path': path_str, 'name': os.path.basename(path_str), 'ts': int(time.time())})
        # оставить 5
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

class Api:
    """Методы доступны в JS как window.pywebview.api.*"""

    def get_app_info(self):
        ensure_app_data()
        return {
            'version': APP_VERSION,
            'appData': str(APP_DATA_DIR),
            'name': APP_NAME
        }

    def get_recent(self):
        return load_recent()

    def open_model(self):
        """Нативный диалог STL/OBJ/STEP, возвращает {name, data(base64), size} или None"""
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            file_types = ('3D модели (*.stl;*.obj;*.step;*.stp)', 'Все файлы (*.*)')
            # pywebview API: create_file_dialog(dialog_type, allow_multiple, file_types, save_filename)
            result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
            if not result:
                return None
            # result может быть tuple/list или строка
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path or not os.path.exists(path):
                return None
            # проверка расширения
            ext = os.path.splitext(path)[1].lower()
            if ext not in ('.stl', '.obj', '.step', '.stp'):
                # всё равно попробуем прочитать
                pass
            with open(path, 'rb') as f:
                data = f.read()
            # ограничим 50 МБ
            if len(data) > 50 * 1024 * 1024:
                return {'error': 'Файл слишком большой (>50 МБ)'}
            b64 = base64.b64encode(data).decode('ascii')
            return {'name': os.path.basename(path), 'size': len(data), 'data': b64, 'path': path, 'ext': ext}
        except Exception as e:
            return {'error': str(e)}

    def save_stl(self, b64_data, suggested_name="optimized.stl"):
        """Сохранить как STL: b64_data — base64, suggested_name — имя по умолчанию"""
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            # диалог сохранения
            file_types = ('STL (*.stl)', 'Все файлы (*.*)')
            # webview SAVE_DIALOG возвращает путь
            # второй аргумент: save_filename — подсказка
            result = win.create_file_dialog(webview.SAVE_DIALOG, allow_multiple=False, file_types=file_types, save_filename=suggested_name)
            if not result:
                return {'cancelled': True}
            path = result[0] if isinstance(result, (list, tuple)) else result
            if not path:
                return {'cancelled': True}
            # если нет расширения — добавить .stl
            if not os.path.splitext(path)[1]:
                path += '.stl'
            # декодировать
            # b64_data может быть с префиксом data:?
            if isinstance(b64_data, str) and b64_data.startswith('data:'):
                # извлечь после запятой
                b64_data = b64_data.split(',', 1)[-1]
            raw = base64.b64decode(b64_data)
            with open(path, 'wb') as f:
                f.write(raw)
            return {'ok': True, 'path': path}
        except Exception as e:
            return {'error': str(e)}

    def save_project(self, json_str, suggested_name=None):
        """Сохранить проект .olight.json — json_str из JS"""
        try:
            import webview
            win = webview.windows[0] if webview.windows else None
            if not win:
                return {'error': 'Нет окна'}
            if not suggested_name:
                suggested_name = 'project.olight.json'
            # если нет расширения
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
            # валидировать JSON
            try:
                json.loads(json_str)
            except Exception:
                return {'error': 'Невалидный JSON'}
            with open(path, 'w', encoding='utf-8') as f:
                f.write(json_str)
            add_recent(path)
            return {'ok': True, 'path': path}
        except Exception as e:
            return {'error': str(e)}

    def open_project(self):
        """Открыть проект — диалог + чтение"""
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
            # валидация
            try:
                json.loads(data)
            except Exception as e:
                return {'error': f'Невалидный проект: {e}'}
            add_recent(path)
            return {'ok': True, 'path': path, 'data': data, 'name': os.path.basename(path)}
        except Exception as e:
            return {'error': str(e)}

    def open_project_path(self, path):
        """Открыть конкретный путь (из последних)"""
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
        """Дебаунс 800мс с JS стороны, пишет autosave"""
        try:
            ensure_app_data()
            # добавить метку времени
            payload = json.loads(json_str)
            payload['_autosave_ts'] = int(time.time())
            with open(AUTOSAVE_PATH, 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False)
            return {'ok': True}
        except Exception as e:
            return {'error': str(e)}

    def get_autosave_info(self):
        """Проверить автосейв свежее 7 дней"""
        try:
            if not AUTOSAVE_PATH.exists():
                return {'exists': False}
            mtime = AUTOSAVE_PATH.stat().st_mtime
            age = time.time() - mtime
            # 7 дней = 604800 сек
            if age > 7 * 24 * 3600:
                return {'exists': False, 'tooOld': True}
            data = AUTOSAVE_PATH.read_text(encoding='utf-8')
            # проверить что валидный
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
