# Audio Smart Splitter v1.0.1 (macOS & Linux 快速啟動指南)

本軟體支援在 **macOS (Intel / Apple Silicon M1~M4)** 及 **各大 Linux 發行版 (Ubuntu, Debian, Fedora, Arch)** 上直接執行！

提供兩種便捷啟動方式：
1. **原生一鍵腳本啟動 (`./run.sh`)**（推薦，原生效能最佳）
2. **Docker 一鍵容器啟動 (`docker compose up`)**（免裝任何環境，自帶 FFmpeg）

---

## 方案一：原生一鍵腳本啟動 (推薦)

### 1. 前置依賴需求
請確保系統已安裝 **Python 3.9+** 與 **FFmpeg**：

#### 🍏 macOS (使用 Homebrew)：
```bash
# 若尚未安裝 Homebrew，請參考 https://brew.sh
brew install python3 ffmpeg
```

#### 🐧 Ubuntu / Debian Linux：
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv ffmpeg
```

#### 🐧 Fedora / RHEL Linux：
```bash
sudo dnf install python3 python3-pip ffmpeg
```

#### 🐧 Arch Linux：
```bash
sudo pacman -S python python-pip ffmpeg
```

---

### 2. 啟動軟體
解壓縮後，在終端機 (Terminal) 進入本專案資料夾，執行：

```bash
# 賦予執行權限 (首次執行)
chmod +x run.sh

# 啟動軟體
./run.sh
```

腳本將會自動：
- 建立專屬 Python 獨立虛擬環境 (`.venv`)
- 自動安裝所需輕量依賴套件
- 啟動後端服務並**自動於瀏覽器中開啟**：👉 **http://127.0.0.1:8128**

*(若要停止服務，於終端機按下 `Ctrl + C` 即可)*

---

## 方案二：Docker 容器一鍵啟動 (免裝 Python 與 FFmpeg)

若您的電腦已安裝 Docker，可完全無需在本機配置任何環境：

```bash
# 啟動容器 (自動編譯、自帶 FFmpeg)
docker compose up -d
```

啟動後直接在瀏覽器打開：  
👉 **http://127.0.0.1:8128**

若要停止容器：
```bash
docker compose down
```

---

## 🌟 核心功能
- **避詞智慧切片**：同一句歌詞絕不切斷，支援 VAD 能量間隔、SRT 字幕、LRC 歌詞或 Whisper 辨識。
- **DAW 專業波形視覺化**：WaveSurfer.js 雙軌波形 + 獨立歌詞軌道，可直接拖曳切點、增刪切點與智慧吸附。
- **片段即時試聽**：切點微調後可直接點擊單片試聽，確認前後不切字。
- **多格式批次切片**：支援 MP3 (320kbps)、WAV (無損)、M4A (AAC)，自動打包為 ZIP 下載。
- **專案工作檔存取**：支援原生 Windows / Mac 另存新檔與開啟舊檔，完整保存所有切點與設定。
