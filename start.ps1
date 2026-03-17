# Script PowerShell para iniciar Backend e Frontend juntos

Write-Host "🚀 Iniciando Maestro..." -ForegroundColor Cyan
Write-Host ""

# Verifica se as pastas existem
if (-not (Test-Path "backend")) {
    Write-Host "❌ Pasta 'backend' não encontrada!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "maestro")) {
    Write-Host "❌ Pasta 'maestro' não encontrada!" -ForegroundColor Red
    exit 1
}

Write-Host "🔵 Iniciando Backend (API)..." -ForegroundColor Blue
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -PassThru

Start-Sleep -Seconds 2

Write-Host "🟢 Iniciando Frontend (Angular)..." -ForegroundColor Green
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd maestro; npm start" -PassThru

Write-Host ""
Write-Host "✅ Aplicação iniciada!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Backend API: http://localhost:3000" -ForegroundColor Yellow
Write-Host "🌐 Frontend: http://localhost:4200" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pressione Ctrl+C para parar este script (os servidores continuarão rodando)" -ForegroundColor Gray
Write-Host "Para parar os servidores, feche as janelas do PowerShell que foram abertas" -ForegroundColor Gray

# Mantém o script rodando
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n👋 Script finalizado" -ForegroundColor Cyan
}
