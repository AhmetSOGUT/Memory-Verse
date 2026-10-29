@echo off
setlocal
cd /d "%~dp0"

if not exist "ayarlar.local.bat" goto yok_ayar
call "ayarlar.local.bat"
if "%MV_BACKUP_DIR%"=="" goto yok_ayar

set "NODE_DIR=%USERPROFILE%\miniconda3\envs\memoryverse"
if not exist "%NODE_DIR%\node.exe" goto yok_node
set "PATH=%NODE_DIR%;%NODE_DIR%\Library\bin;%NODE_DIR%\Scripts;%PATH%"

if not exist "%MV_BACKUP_DIR%\" goto yok_klasor

cd server
"%NODE_DIR%\node.exe" --import tsx src/cli/backup.ts create --to "%MV_BACKUP_DIR%"

echo.
pause
exit /b 0

:yok_ayar
echo HATA: ayarlar.local.bat icinde MV_BACKUP_DIR tanimli degil.
echo Su satiri ekle ^(kendi Drive yolunla^):
echo   set "MV_BACKUP_DIR=G:\Drive'im\MemoryVerse-yedek"
pause
exit /b 1

:yok_node
echo HATA: Node bulunamadi: %NODE_DIR%\node.exe
pause
exit /b 1

:yok_klasor
echo HATA: Yedek klasoru bulunamadi: %MV_BACKUP_DIR%
echo Google Drive programi acik ve giris yapilmis mi? Klasor Drive icinde var mi?
pause
exit /b 1