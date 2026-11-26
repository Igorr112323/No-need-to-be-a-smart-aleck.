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
echo [1/4] Python найден:
python --version

REM 2. Зависимости
echo.
echo [2/4] Установка зависимостей...
pip install -r requirements.txt
if errorlevel 1 (
  echo [Ошибка] pip install не удалось
  pause
  exit /b 1
)

REM 3. Вендор — интернет нужен только один раз, для вендора
echo.
echo [3/4] Проверка вендора (интернет нужен только один раз)...
python build/vendor.py
if errorlevel 1 (
  echo [Предупреждение] vendor.py завершился с ошибкой — проверьте интернет, затем запустите снова
  pause
  exit /b 1
)

REM 4. Сборка
echo.
echo [4/4] Сборка PyInstaller...
REM --add-data "web;web" — для Windows (на Linux было бы "web:web")
pyinstaller --onefile --windowed --name OpenLight --icon assets/openlight.ico --add-data "web;web" --add-data "assets;assets" main.py
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
echo  Двойной клик — окно 1400x900, весь сценарий Этапа 5 офлайн.
echo ==========================================
pause
