@echo off
chcp 65001 >nul
title Audio Smart Splitter - 智慧音訊切片工作站

echo ===================================================
echo     Audio Smart Splitter (智慧歌詞斷句音訊切片)
echo ===================================================
echo.

cd /d "%~dp0"

:: 檢查虛擬環境
if not exist "venv\Scripts\python.exe" (
    echo [提示] 首次執行，正在建立 Python 虛擬環境...
    python -m venv venv
    echo [提示] 正在安裝相依套件...
    call .\venv\Scripts\pip install -r requirements.txt
)

:: 自動開啟瀏覽器
echo [提示] 正在啟動伺服器並開啟瀏覽器...
start "" "http://127.0.0.1:8128"

:: 啟動後端服務
cd backend
..\venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8128

pause
