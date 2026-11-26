"""
OpenLight — точка входа.
Создаёт окно pywebview 1400x900 с заголовком «OpenLight»,
загружает локальный web/index.html. Работает офлайн.
"""
import os
import sys
import pathlib

def get_web_path() -> str:
    # путь к index.html рядом с main.py (для PyInstaller и обычного запуска)
    base = pathlib.Path(__file__).parent
    # приоритет: openlight/web/index.html если запущено из корня, иначе web/index.html
    candidates = [
        base / "web" / "index.html",
        base / "openlight" / "web" / "index.html",
        pathlib.Path.cwd() / "web" / "index.html",
        pathlib.Path.cwd() / "openlight" / "web" / "index.html",
    ]
    for p in candidates:
        if p.exists():
            return p.resolve().as_uri()
    # fallback — относительный
    return (base / "web" / "index.html").resolve().as_uri()

def main():
    try:
        import webview
    except ImportError:
        print("pywebview не установлен. Установите зависимости: pip install -r requirements.txt")
        # пробуем открыть в браузере как fallback для отладки
        import webbrowser
        url = get_web_path()
        print(f"Открываю {url} в браузере...")
        webbrowser.open(url)
        return

    url = get_web_path()
    # окно 1400x900, заголовок OpenLight
    window = webview.create_window(
        "OpenLight",
        url=url,
        width=1400,
        height=900,
        min_size=(1100, 700),
        resizable=True,
    )
    # запуск без отладочной панели, офлайн
    webview.start(debug=False)

if __name__ == "__main__":
    main()
