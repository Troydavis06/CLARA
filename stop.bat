@echo off
echo Stopping CLARA...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R "[ ]:8000 " 2^>nul') do (
    if not "%%a"=="" (
        echo Killing PID %%a (port 8000)
        taskkill /PID %%a /F >nul 2>&1
    )
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R "[ ]:5173 " 2^>nul') do (
    if not "%%a"=="" (
        echo Killing PID %%a (port 5173)
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo Done.
