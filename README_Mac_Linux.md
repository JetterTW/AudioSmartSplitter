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

使用 Docker 的最大好處是**完全不需要在主機安裝 Python 或 FFmpeg**，容器內部已封裝所有環境！

### 1. 安裝 Docker（若電腦尚未安裝）
* **🍏 macOS**：前往官網下載安裝 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)（選擇 Apple Silicon 或 Intel），安裝完成後打開 Docker Desktop 即可。
* **🐧 Linux (Ubuntu / Debian)**：
  ```bash
  sudo apt update && sudo apt install -y docker.io docker-compose-v2
  sudo usermod -aG docker $USER
  newgrp docker
  ```

### 2. 下載專案並啟動
```bash
# 1. 複製專案庫
git clone https://github.com/JetterTW/AudioSmartSplitter.git
cd AudioSmartSplitter

# 2. 一鍵啟動容器 (首次執行會自動下載 Linux Python 映像檔並安裝 FFmpeg)
docker compose up -d
```

啟動後直接在瀏覽器打開：  
👉 **http://127.0.0.1:8128**

### 3. 常用維護指令
```bash
# 查看即時日誌
docker compose logs -f

# 重啟服務
docker compose restart

# 停止服務
docker compose down
```

---

## 🌟 核心功能
- **避詞智慧切片**：同一句歌詞絕不切斷，支援 VAD 能量間隔、SRT 字幕、LRC 歌詞或 Whisper 辨識。
- **DAW 專業波形視覺化**：WaveSurfer.js 雙軌波形 + 獨立歌詞軌道，可直接拖曳切點、增刪切點與智慧吸附。
- **片段即時試聽**：切點微調後可直接點擊單片試聽，確認前後不切字。
- **多格式批次切片**：支援 MP3 (320kbps)、WAV (無損)、M4A (AAC)，自動打包為 ZIP 下載。
- **專案工作檔存取**：支援原生 Windows / Mac 另存新檔與開啟舊檔，完整保存所有切點與設定。
