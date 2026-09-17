#!/usr/bin/env bash
# ==========================================================
# Audio Smart Splitter v1.1.2 (macOS & Linux 啟動腳本)
# ==========================================================

set -e

# 切換至腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "   Audio Smart Splitter v1.1.2"
echo "   AI 智慧歌詞斷句音訊切片工作站 (macOS / Linux)"
echo "=========================================================="

# 1. 檢查 Python 3
if ! command -v python3 &> /dev/null; then
    echo "[錯誤] 未偵測到 Python 3，請先安裝 Python 3.9 或以上版本。"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS 安裝提示: brew install python3"
    else
        echo "Linux 安裝提示: sudo apt update && sudo apt install -y python3 python3-venv python3-pip"
    fi
    exit 1
fi

# 2. 檢查 FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "[警告] 系統中未檢測到 ffmpeg 指令。"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "[建議] 請在終端機執行: brew install ffmpeg"
    else
        echo "[建議] 請在終端機執行: sudo apt update && sudo apt install -y ffmpeg"
    fi
    echo "----------------------------------------------------------"
    read -p "是否仍要繼續啟動？(若無 FFmpeg 切片可能無法完成) [y/N]: " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        exit 1
    fi
fi

# 3. 建立並啟用虛擬環境
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] 首次執行，正在建立 Python 虛擬環境 (.venv)..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# 4. 安裝或檢查 Python 依賴套件
echo "[*] 正在檢查並安裝依賴套件..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

# 5. 自動在瀏覽器開啟
open_browser() {
    sleep 2
    URL="http://127.0.0.1:8128"
    echo "[*] 正在開啟瀏覽器: $URL ..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$URL"
    fi
}

open_browser &

# 6. 啟動後端服務
echo "[*] 啟動伺服器於 0.0.0.0:8128 (本地: http://127.0.0.1:8128 / 支援區網 IP) ..."
echo "[*] 提示: 按 Ctrl + C 即可關閉服務"
echo ""
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8128
