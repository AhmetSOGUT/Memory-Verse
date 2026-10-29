@echo off
setlocal
cd /d "%~dp0"

if not exist "ayarlar.local.bat" goto yok_ayar
call "ayarlar.local.bat"
if "%MV_HOST%"=="" goto yok_ayar

set "NODE_DIR=%USERPROFILE%\miniconda3\envs\memoryverse"
if not exist "%NODE_DIR%\node.exe" goto yok_node
set "PATH=%NODE_DIR%;%NODE_DIR%\Library\bin;%NODE_DIR%\Scripts;%PATH%"

if not exist "dist\index.html" goto yok_dist

set "ALLOWED_HOSTS=%MV_HOST%"
set "TRUST_PROXY=1"

echo.
echo Memory Verse basliyor...
echo Adres: https://%MV_HOST%
echo Kapatmak icin bu pencereyi kapat veya Ctrl+C bas.
echo.

cd server
"%NODE_DIR%\node.exe" --import tsx src/index.ts

echo.
echo Sunucu durdu.
pause
exit /b 0

:yok_ayar
echo HATA: ayarlar.local.bat bulunamadi veya MV_HOST bos.
echo Ana klasorde ayarlar.local.bat adli dosya olustur, icine su satiri yaz:
echo   set "MV_HOST=ahsu.tailXXXX.ts.net"
pause
exit /b 1

:yok_node
echo HATA: Node bulunamadi: %NODE_DIR%\node.exe
echo Conda ortami adi veya yeri farkli olabilir.
pause
exit /b 1

:yok_dist
echo HATA: Site derlenmemis (dist klasoru yok). Once guncelle.bat calistir.
pause
exit /b 1