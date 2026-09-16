# 🎵 Audio Smart Splitter - 智慧歌詞斷句音訊切片工作站

一套專門為**音樂、歌曲、人聲演講切片**打造的智慧音訊切割工具。
解決一般定長切割（例如每 20 秒切一刀）常會將**歌詞字句腰斬、切斷呼吸與尾音**的痛點！

---

## ✨ 核心特色

1. **支援多種音訊格式匯入**
   - 完整支援 **MP3、WAV、M4A、AAC、FLAC、OGG** 等音訊格式。
2. **智慧避開歌詞 (Sentence Boundary Protection)**
   - 設定目標秒數（如 20 秒），演算法自動尋找每句歌詞/人聲之間的**呼吸停頓與靜音空隙 (Gap)** 下刀。
   - **嚴格約束：絕不在任何一句話或歌詞內部切斷！**
   - 支援 **快速 VAD 人聲能量間隔分析 (毫秒級秒出)**、**Whisper AI 時間戳辨識** 與 **LRC 歌詞檔對齊** 三種模式。
3. **專業 DAW 圖形化波形編輯器 (Wavesurfer.js)**
   - 完整波形展示、時間軸標尺 (Timeline)、毫秒級縮放 (Zoom In/Out)。
   - 底層視覺化標示每句歌詞的區間與內容。
   - **紅色的切割線標記可自由用滑鼠左右拖曳**，即時微調下刀時間。
   - **🧲 智慧吸附功能 (Smart Gap Snap)**：拖曳切點接近歌詞空隙時自動精確對齊中心，避免手滑。
4. **自由新增與刪除切點**
   - 點擊「在游標處下刀」按鈕或在波形上按 **Shift + 點擊** 隨意新增切點。
   - 點擊切點頂部的 **✕** 按鈕即可精準刪除單一切點。
5. **單獨切片即時試聽**
   - 列表清楚列出切出的每個片段（序號、檔名、起始時間、結束時間、片長、涵蓋歌詞）。
   - 點擊 **「▶ 試聽此段」** 即可精確只播放該片段（到達切點自動暫停），秒速確認前後有無切到字。
6. **多格式高品質批次匯出**
   - 支援匯出為 **MP3 (320kbps 高音質)**、**WAV (無損 PCM)**、**M4A (AAC 256kbps)**。
   - FFmpeg 高速精確切片，一鍵打包下載為 **ZIP 壓縮檔**。

---

## 🚀 啟動與使用方式

### 方案 A：獨立綠色可攜免安裝版 (推薦，無需 Python 與任何環境)
1. 直接開啟資料夾 **[AudioSmartSplitter_綠色免安裝版](file:///d:/AntigravityProjects/AudioAI/AudioSmartSplitter_綠色免安裝版)**。
2. 雙擊執行 **`AudioSmartSplitter.exe`**。
3. 程式會自帶所有轉碼依賴與 FFmpeg，並自動在瀏覽器開啟 `http://127.0.0.1:8128`！
*(您也可以直接取用 [AudioSmartSplitter_綠色免安裝可攜版.zip](file:///d:/AntigravityProjects/AudioAI/AudioSmartSplitter_綠色免安裝可攜版.zip) 傳到任何 Windows 電腦解壓即用)*

### 方案 B：透過 run.bat 啟動 (原始碼模式)
在專案根目錄下**雙擊執行 `run.bat`** 即可。

---

## 🛠️ 手動啟動方法 (開發者)

```bash
# 1. 啟用虛擬環境
.\venv\Scripts\activate

# 2. 啟動伺服器
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8128 --reload
```

啟動後於瀏覽器造訪 `http://127.0.0.1:8128` 即可開始使用！

---

## 📂 專案結構

```
AudioAI/
├── backend/
│   ├── app.py                 # FastAPI 後端主服務與 REST API
│   ├── audio_processor.py     # FFmpeg 音訊探測、精確切片與 ZIP 打包
│   ├── sentence_detector.py   # 人聲語句偵測 (VAD / Whisper / LRC)
│   └── splitter_algo.py       # 智慧避詞切點計算演算法
├── frontend/
│   ├── index.html             # 工作站主頁面 (暗黑音樂工作室風格)
│   ├── style.css              # DAW 視覺樣式表
│   ├── app.js                 # 波形互動、切點拖曳、吸附與試聽控制器
│   └── libs/                  # WaveSurfer.js 本地離線庫與插件
├── uploads/                   # 音訊上傳暫存目錄
├── outputs/                   # 切片成品與 ZIP 壓縮包目錄
├── test_integration.py        # 完整功能整合測試指令碼
├── run.bat                    # Windows 一鍵啟動指令檔
└── requirements.txt           # Python 套件依賴
```
