@echo off
setlocal
title Wake Up, Dev - Lanzador

REM ==========================================================================
REM  Lanzador de "Wake Up, Dev": abre TODO lo necesario para jugar con IA.
REM   1) Servidor del juego (Vite dev) en http://localhost:5175
REM   2) Oraculo headless (bridge) en 127.0.0.1:8137  ->  npm run bridge
REM   3) Chrome apuntando al juego
REM  Si algo ya esta corriendo, NO lo duplica. Cerra las ventanas del servidor
REM  y del Oraculo cuando termines de jugar (eso los apaga).
REM ==========================================================================

REM Raiz del repo = dos carpetas arriba de este script (tools\launcher\).
pushd "%~dp0..\.." || (echo No encuentro la carpeta del proyecto. & pause & exit /b 1)
set "REPO=%CD%"
popd

echo Proyecto: %REPO%
echo.

REM --- 1) Servidor del juego (Vite dev) en 5175 ---
call :puertoEnUso 5175
if errorlevel 1 (
  echo [1/3] Iniciando servidor del juego en http://localhost:5175 ...
  start "Wake Up Dev - Servidor 5175" /D "%REPO%" cmd /k "npm run dev -- --port 5175 --strictPort"
) else (
  echo [1/3] El servidor del juego ya estaba corriendo en 5175.
)

REM --- 2) Oraculo headless (bridge) en 8137 ---
call :puertoEnUso 8137
if errorlevel 1 (
  echo [2/3] Iniciando el Oraculo ^(bridge headless^) en 127.0.0.1:8137 ...
  start "Wake Up Dev - Oraculo 8137" /D "%REPO%" cmd /k "npm run bridge"
) else (
  echo [2/3] El Oraculo ya estaba corriendo en 8137.
)

REM --- 3) Esperar a que el servidor responda y abrir Chrome ---
echo [3/3] Esperando al servidor del juego...
set /a intentos=0
:esperar
call :puertoEnUso 5175
if not errorlevel 1 goto abrir
set /a intentos+=1
if %intentos% geq 30 goto abrir
REM Espera ~1s con ping (timeout falla si el stdin esta redirigido).
ping -n 2 127.0.0.1 >nul
goto esperar

:abrir
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" "http://localhost:5175/"
) else (
  echo No encontre Chrome; abro el navegador por defecto.
  start "" "http://localhost:5175/"
)

echo.
echo Listo. A jugar. (Esta ventana se cierra sola)
ping -n 4 127.0.0.1 >nul
exit /b 0

REM --- Subrutina: errorlevel 0 si el puerto %1 esta en uso, 1 si esta libre ---
:puertoEnUso
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
