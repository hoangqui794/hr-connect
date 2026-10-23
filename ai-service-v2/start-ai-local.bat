@echo off
chcp 65001 >nul
title HR Connect - AI service v2
cd /d "%~dp0"

echo ==========================================
echo   HR Connect - Bat AI service v2 tren may
echo ==========================================
echo.

echo [1/3] Kiem tra tunnel Cloudflare...
sc query Cloudflared | find "RUNNING" >nul
if errorlevel 1 (
    echo     Tunnel dang tat, dang bat lai...
    net start Cloudflared >nul 2>&1
    sc query Cloudflared | find "RUNNING" >nul
    if errorlevel 1 (
        echo     KHONG bat duoc tunnel. Chuot phai file nay ^> "Run as administrator" roi chay lai.
        pause
        exit /b 1
    )
)
echo     Tunnel: RUNNING
echo.

echo [2/3] Kiem tra cong 8001...
netstat -ano | find ":8001" | find "LISTENING" >nul
if not errorlevel 1 (
    echo     AI service da chay san tren cong 8001, khong bat them.
    goto check
)
if not exist ".venv\Scripts\python.exe" (
    echo     Chua co .venv trong ai-service-v2. Can cai moi truong Python truoc.
    pause
    exit /b 1
)
echo     Dang bat AI service trong cua so moi (giu cua so do mo, dong la tat service)...
start "HR Connect - AI service v2 (log)" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo     Cho service san sang (lan dau co the mat 30-60 giay de nap mo hinh)...
set /a tries=0
:wait
set /a tries+=1
curl.exe -s -o nul --max-time 3 http://127.0.0.1:8001/health && goto check
if %tries% geq 60 (
    echo     Qua 2 phut van chua len. Xem loi trong cua so log.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait

:check
echo.
echo [3/3] Kiem tra suc khoe:
echo     Tren may :
curl.exe -s --max-time 10 http://127.0.0.1:8001/health
echo.
echo     Qua tunnel (Render goi vao):
curl.exe -s --max-time 20 https://ai-dev.hrconnectvn.online/health
echo.
echo.
echo Ca hai dong tren phai la {"status":"ok","service":"ai-service-v2"}.
echo.
echo Duong dan (Ctrl + click de mo):
echo     Swagger qua tunnel : https://ai-dev.hrconnectvn.online/docs
echo     Swagger tren may   : http://127.0.0.1:8001/docs
echo     Health             : https://ai-dev.hrconnectvn.online/health
echo     (Swagger can API_DOCS_ENABLED=true trong file .env)
echo.
pause
