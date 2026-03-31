@echo off
chcp 65001 > nul
echo.
echo  ========================================
echo    로젠 x 카페24 송장 매니저 실행 중...
echo  ========================================
echo.
cd /d "%~dp0"

:: 기존 서버 프로세스 종료 (포트 8080)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

:: 브라우저 열기
start "" "http://localhost:8080/"

:: 로젠 JWT 자동 획득 (백그라운드)
start "로젠 토큰 획득" /min python -X utf8 logen_get_token.py

:: 서버 시작 (이 창이 살아있는 동안 서버 유지)
echo  서버 실행 중... 이 창을 닫으면 서버가 종료됩니다.
echo.
python -X utf8 run_server.py
