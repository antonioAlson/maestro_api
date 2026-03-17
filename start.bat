@echo off
echo ==================================
echo  Iniciando Maestro
echo ==================================
echo.

REM Inicia Backend
echo [Backend] Iniciando API...
start "Maestro Backend" cmd /k "cd backend && npm run dev"

REM Aguarda 2 segundos
timeout /t 2 /nobreak >nul

REM Inicia Frontend
echo [Frontend] Iniciando Angular...
start "Maestro Frontend" cmd /k "cd maestro && npm start"

echo.
echo ==================================
echo  Aplicacao iniciada!
echo ==================================
echo.
echo  Backend API: http://localhost:3000
echo  Frontend:    http://localhost:4200
echo.
echo Pressione qualquer tecla para fechar esta janela...
echo (Os servidores continuarao rodando)
pause >nul
