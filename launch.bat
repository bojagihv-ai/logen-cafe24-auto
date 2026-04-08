@echo off
chcp 65001 > nul
cd /d "C:\Users\kua\Desktop\projects\kuaai\kuaai-main"

:: 1. 기존 프로세스 종료
taskkill /F /IM wscript.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak > nul

:: 2. 새 CMD 창으로 서버 실행 (창이 닫히면 서버도 종료됨)
start "Logen-Cafe24 Server" /min "C:\Users\kua\AppData\Local\Programs\Python\Python311\python.exe" -X utf8 "C:\Users\kua\Desktop\projects\kuaai\kuaai-main\server_launcher.py"

:: 3. 서버 뜰 때까지 대기
timeout /t 6 /nobreak > nul

:: 4. 브라우저 열기
start "" "http://localhost:8080/"

exit
