@echo off
chcp 65001 >nul
echo === OpenLight — сборка .exe (Windows 10/11 x64) ===
echo.

REM 1. Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
  echo [Ошибка] Python не найден. Установите Python 3.10+ с https://python.org и добавьте в PATH.
  pause
  exit /b 1
)
echo [1/5] Python найден:
python --version

REM 2. Зависимости
echo.
echo [2/5] Установка зависимостей...
pip install -r requirements.txt
if errorlevel 1 (
  echo [Ошибка] pip install не удалось
  pause
  exit /b 1
)

REM 3. Вендор — интернет нужен только один раз, для вендора
echo.
echo [3/5] Проверка вендора (интернет нужен только один раз)...
python build/vendor.py
if errorlevel 1 (
  echo [Предупреждение] vendor.py завершился с ошибкой — проверьте интернет, затем запустите снова
  pause
  exit /b 1
)

REM 3b. Версия из build (нет хардкода)
echo.
echo [4/5] Генерация VERSION...
python build/make_version.py
if errorlevel 1 (
  echo [Предупреждение] make_version.py не удался — используем fallback 0.9.2-test
  echo 0.9.2-test> VERSION
)

REM 4. Сборка
echo.
echo [5/5] Сборка PyInstaller...
REM --add-data "web;web" — для Windows (на Linux было бы "web:web"), добавляем VERSION и LICENSE
pyinstaller --onefile --windowed --name OpenLight --icon assets/openlight.ico --add-data "web;web" --add-data "assets;assets" --add-data "VERSION;." --add-data "LICENSE;." main.py
if errorlevel 1 (
  echo [Ошибка] PyInstaller не удался
  pause
  exit /b 1
)

echo.
echo ==========================================
echo  Готово: dist\OpenLight.exe
echo  Размер: 
dir dist\OpenLight.exe | findstr OpenLight.exe
echo  Двойной клик — окно 1400x900, весь сценарий офлайн.
echo ==========================================
pause
