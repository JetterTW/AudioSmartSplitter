import os
import sys
import time
import threading
import webbrowser
import uvicorn

# 處理 PyInstaller 與便攜目錄路徑
if getattr(sys, "frozen", False):
    # 如果是打包後的 EXE
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.executable)))
    APP_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    # 原始碼運行
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = BASE_DIR

# 將 backend 加入 module 搜尋路徑
backend_dir = os.path.join(BASE_DIR, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# 匯入後端 app
from backend.app import app

def open_browser():
    """延遲開啟瀏覽器"""
    time.sleep(1.5)
    url = "http://127.0.0.1:8128"
    print(f"\n[INFO] 正在開啟瀏覽器: {url} ...")
    webbrowser.open(url)

def main():
    print("=" * 60)
    print("   Audio Smart Splitter v1.1.2 (綠色可攜獨立版)")
    print("   AI 智慧歌詞斷句音訊切片工作站")
    print("=" * 60)
    print("[*] 服務位址: http://127.0.0.1:8128 (亦可由區域網路 IP 連線)")
    print("[*] 運作模式: 便攜免安裝模式")
    print("[*] 提示: 關閉此視窗即可停止服務\n")

    # 啟動自動開啟瀏覽器線程
    threading.Thread(target=open_browser, daemon=True).start()

    # 啟動 Uvicorn 服務
    uvicorn.run(app, host="0.0.0.0", port=8128, log_level="info")

if __name__ == "__main__":
    main()
