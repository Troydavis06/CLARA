@echo off
echo Stopping any existing CLARA processes...

REM Kill processes on port 8000 (backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R "[ ]:8000 " 2^>nul') do (
    if not "%%a"=="" taskkill /PID %%a /F >nul 2>&1
)

REM Kill processes on port 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R "[ ]:5173 " 2^>nul') do (
    if not "%%a"=="" taskkill /PID %%a /F >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo Starting backend...
start "CLARA Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo Starting frontend...
start "CLARA Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo CLARA started:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
