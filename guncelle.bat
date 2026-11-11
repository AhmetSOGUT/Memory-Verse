@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=%USERPROFILE%\miniconda3\envs\memoryverse"
if not exist "%NODE_DIR%\node.exe" goto yok_node
set "PATH=%NODE_DIR%;%NODE_DIR%\Library\bin;%NODE_DIR%\Scripts;%PATH%"

:derle
cls
echo ============================================
echo   Site derleniyor...
echo ============================================
echo.
"%NODE_DIR%\node.exe" node_modules\vite\bin\vite.js build
if errorlevel 1 goto hata

echo.
echo Tamam. Site guncellendi.
echo Sunucu kodu degistiyse baslat.bat penceresini kapatip yeniden ac.
goto sor

:hata
echo.
echo HATA: Derleme basarisiz. Yukaridaki mesaji oku.
goto sor

:sor
echo.
choice /C EK /N /M "Yeniden derle: E   |   Kapat: K "
if errorlevel 2 goto cik
goto derle

:cik
exit /b 0

:yok_node
echo HATA: Node bulunamadi: %NODE_DIR%\node.exe
pause
exit /b 1
