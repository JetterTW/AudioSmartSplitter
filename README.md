# 🎵 Audio Smart Splitter v1.0.1 - 智慧歌詞斷句音訊切片工作站

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/JetterTW/AudioSmartSplitter/releases)
[![Python](https://img.shields.io/badge/python-3.9+-brightgreen.svg)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/JetterTW/AudioSmartSplitter)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

一套專為**音樂、歌曲、人聲演講切片**量身打造的現代化 DAW 智慧音訊切割工作站。  
徹底解決一般定長切割（例如每 20 秒切一刀）常會將**歌詞字句腰斬、切斷尾音與呼吸聲**的痛點！

---

## 🌟 核心特色

1. **智慧避開歌詞 (Sentence Boundary Protection)**
   - 設定目標秒數（如 20 秒），演算法自動尋找每句歌詞/人聲之間的**呼吸停頓與靜音空隙 (Gap)** 精準下刀。
   - **嚴格約束：絕不在任何一句話或歌詞內部切斷！**
   - 支援四種偵測模式：
     - ⚡ **快速 VAD 能量分析**：毫秒級極速分析，離線可用。
     - 🤖 **Whisper AI 辨識**：深度學習時間軸識別（支援自動平滑降級）。
     - 📑 **SRT 字幕檔案對齊**：毫秒級時間軸對齊字幕起訖。
     - 🎵 **LRC 動態歌詞對齊**：精準解析動態歌詞標記。
2. **專業 DAW 圖形化波形編輯器 (WaveSurfer.js)**
   - 完整波形展示、時間軸刻度尺 (Timeline)、毫秒級縮放 (Zoom In/Out)。
   - **獨立歌詞/語句軌道**：置於波形正下方，文字清晰高對比，不再與波形混疊。
   - **垂直切點標記線可自由用滑鼠左右拖曳**，即時以 `mm:ss.xx` 格式微調下刀時間。
   - **🧲 智慧吸附功能 (Smart Gap Snap)**：拖曳切點接近歌詞空隙時自動吸附在空隙正中央。
3. **自由增刪切點與片段試聽**
   - 點擊「在游標處下刀」按鈕或在波形上按 **Shift + 滑鼠點擊** 自由新增切點。
   - 點擊切點頂部的 **✕** 按鈕即可精準刪除該切點。
   - 清單列出切出的每個片段，提供 **「▶ 試聽此段」**（播放至該段結束切點自動暫停）。
4. **多格式批次高品質匯出 (自訂詳細時間戳記)**
   - 支援匯出為 **MP3 (320kbps 高音質)**、**WAV (無損 PCM)**、**M4A (AAC 256kbps)**。
   - 檔名帶有精確起訖時間與片段長度標籤（例：`歌曲_part_01-0000.00-0019.83(19.84).mp3`）。
   - 由 FFmpeg 引擎精確切片，一鍵打包下載為 **ZIP 壓縮檔**。
5. **專案工作檔存取 (桌面級另存新檔 / 開啟舊檔)**
   - 點擊 **「💾 儲存工作檔」** 呼叫系統原生「另存新檔」視窗，自由挑選儲存路徑與命名（`.assp.json`）。
   - 點擊 **「📂 開啟工作檔」** 呼叫系統原生「開啟舊檔」視窗，無縫還原所有切點、歌詞與秒數設定。
   - **智慧音訊重連**：異地開啟專案時若音訊遺失，系統會完整保留切點並引導選取原音訊接軌。
6. **支援區域網路 (LAN) 跨裝置存取**
   - 服務綁定 `0.0.0.0:8128`，同 Wi-Fi 網路下的 iPad、手機或其他電腦皆可透過區網 IP 連線編輯。

---

## 🚀 下載、安裝與啟動教學

本專案支援 **Windows**、**macOS (Intel / Apple Silicon M 系列)** 與 **各大 Linux 發行版**。請依據您的作業系統選擇適合的方式：

---

### 🪟 Windows 使用教學

#### 方案 A：綠色免安裝可攜版 (最推薦，無環境依賴)
> 免裝 Python、免設定任何環境變數、自帶 FFmpeg 轉碼核心！

1. 前往 GitHub 的 [Releases 頁面](https://github.com/JetterTW/AudioSmartSplitter/releases) 下載最新版的 **`AudioSmartSplitter_綠色免安裝可攜版.zip`**。
2. 解壓縮至電腦中任何資料夾。
3. 雙擊執行資料夾內的 **`AudioSmartSplitter.exe`**。
4. 程式會自動啟動後端並在您的瀏覽器打開：👉 **http://127.0.0.1:8128**。

---

#### 方案 B：透過 Git Clone 原始碼安裝 (使用虛擬環境)

```powershell
# 1. 複製專案庫
git clone https://github.com/JetterTW/AudioSmartSplitter.git
cd AudioSmartSplitter

# 2. 一鍵自動啟動 (推薦：會自動建立 venv 虛擬環境並安裝依賴)
.\run.bat
```

> **手動虛擬環境安裝方式**：
> ```powershell
> python -m venv venv
> .\venv\Scripts\activate
> pip install --upgrade pip
> pip install -r requirements.txt
> python -m uvicorn backend.app:app --host 0.0.0.0 --port 8128
> ```

---

### 🍏 macOS 使用教學 (Intel & Apple Silicon M1~M4)

#### 1. 前置工具安裝 (使用 Homebrew)
macOS 需安裝 Python 3 與 FFmpeg 音訊核心：
```bash
# 若尚未安裝 Homebrew，請先至 https://brew.sh 安裝
brew install python3 ffmpeg
```

#### 2. 下載與啟動軟體
```bash
# 1. 複製專案庫
git clone https://github.com/JetterTW/AudioSmartSplitter.git
cd AudioSmartSplitter

# 2. 賦予執行權限並啟動腳本
chmod +x run.sh
./run.sh
```

`run.sh` 腳本將會自動：
- 建立專屬 Python 隔離虛擬環境 (`.venv`)
- 自動安裝所需依賴套件
- 啟動伺服器並自動在您的預設瀏覽器中開啟：👉 **http://127.0.0.1:8128**

---

### 🐧 Linux 使用教學 (Ubuntu / Debian / Fedora / Arch)

#### 1. 前置依賴安裝
```bash
# Ubuntu / Debian:
sudo apt update && sudo apt install -y python3 python3-pip python3-venv ffmpeg

# Fedora / RHEL:
sudo dnf install -y python3 python3-pip ffmpeg

# Arch Linux:
sudo pacman -S python python-pip ffmpeg
```

#### 2. 下載與啟動
```bash
git clone https://github.com/JetterTW/AudioSmartSplitter.git
cd AudioSmartSplitter

chmod +x run.sh
./run.sh
```

---

### 🐳 Docker 跨平台一鍵容器啟動 (Mac / Linux / Windows 通用)

若您的電腦已安裝 Docker，可完全無需在主機配置 Python 或 FFmpeg：

```bash
# 啟動容器 (自動建構鏡像並背景常駐)
docker compose up -d
```
啟動後直接在瀏覽器開啟：👉 **http://127.0.0.1:8128**  
停止服務只需執行：`docker compose down`

---

## 🌐 區域網路 (LAN) 跨裝置存取

服務預設監聽 `0.0.0.0:8128`。只要同一區域網路（同 Wi-Fi）下的其他裝置，在瀏覽器輸入主機的 IP 即可遠端使用：
```
http://<您的主機IP>:8128
例如：http://192.168.1.98:8128
```
可在平板 (iPad)、手機或另一台工作站直接進行波形編輯與試聽！

---

## 📂 專案結構

```
AudioSmartSplitter/
├── backend/
│   ├── app.py                 # FastAPI 後端主服務與 RESTful API
│   ├── audio_processor.py     # FFmpeg 音訊探測、精確切片與 ZIP 打包
│   ├── sentence_detector.py   # 人聲語句偵測 (VAD / Whisper / SRT / LRC)
│   ├── splitter_algo.py       # 智慧避詞切點計算動態尋優演算法
│   └── utils.py               # 跨平台 FFmpeg / FFprobe 自動路徑探索
├── frontend/
│   ├── index.html             # 工作站主頁面 (暗黑音樂工作室風格)
│   ├── style.css              # DAW 專業視覺樣式表
│   ├── app.js                 # 波形互動、切點拖曳、智慧吸附與試聽控制器
│   ├── favicon.svg            # 高解析度向量應用程式圖示
│   ├── favicon.ico            # 多規格圖示
│   └── libs/                  # WaveSurfer.js 本地離線庫與插件
├── bin/                       # (可選) 本地 FFmpeg 執行檔目錄
├── Dockerfile                 # 跨平台 Docker 容器映像檔定義
├── docker-compose.yml         # Docker Compose 一鍵啟動設定檔
├── requirements.txt           # Python 依賴清單
├── run.bat                    # Windows 一鍵自動虛擬環境啟動腳本
├── run.sh                     # macOS / Linux 一鍵自動虛擬環境啟動腳本
└── README.md                  # 專案中文說明文件
```

---

## 📄 開源授權

本專案採用 [MIT License](LICENSE) 授權開源。歡迎自由使用、修改與提出 Issue / PR 貢獻！
