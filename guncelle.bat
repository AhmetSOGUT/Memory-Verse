@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=%USERPROFILE%\miniconda3\envs\memoryverse"
if not exist "%NODE_DIR%\node.exe" goto yok_node
set "PATH=%NODE_DIR%;%NODE_DIR%\Library\bin;%NODE_DIR%\Scripts;%PATH%"

echo Site derleniyor...
"%NODE_DIR%\node.exe" node_modules\vite\bin\vite.js build
if errorlevel 1 goto hata

echo.
echo Tamam. Site guncellendi.
echo Sunucu kodu degistiyse baslat.bat penceresini kapatip yeniden ac.
pause
exit /b 0

:yok_node
echo HATA: Node bulunamadi: %NODE_DIR%\node.exe
pause
exit /b 1

:hata
echo HATA: Derleme basarisiz. Yukaridaki mesaji oku.
pause
exit /b 1