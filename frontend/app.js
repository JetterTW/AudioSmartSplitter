/**
 * Audio Smart Splitter - Frontend Controller
 */

// 全域狀態管理
const state = {
  currentFileId: null,
  currentFileName: null,
  audioDuration: 0,
  currentAudioData: null,
  sentences: [],       // [{ id, start, end, text, type }, ...]
  cutPoints: [],       // [20.15, 41.2, ...] (排序後的秒數)
  isPlayingSegment: false,
  segmentPlayEnd: null,
  activeSegmentIdx: null,
  isDraggingCut: false,
  draggedCutIndex: null,
  uploadedLyrics: [],
  savedProjects: [],
  currentProjectId: null,
  pendingProjectRebind: null,
};

// DOM 元素快取
const dom = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("audioFileInput"),
  browseBtn: document.getElementById("browseBtn"),
  uploadTitle: document.getElementById("uploadTitle"),
  targetDurationSlider: document.getElementById("targetDurationSlider"),
  targetDurationInput: document.getElementById("targetDurationInput"),
  targetDurationVal: document.getElementById("targetDurationVal"),
  detectMode: document.getElementById("detectMode"),
  lyricFileContainer: document.getElementById("lyricFileContainer"),
  lyricInputLabel: document.getElementById("lyricInputLabel"),
  chooseLyricFileBtn: document.getElementById("chooseLyricFileBtn"),
  lyricFileInput: document.getElementById("lyricFileInput"),
  lyricTextInput: document.getElementById("lyricTextInput"),
  savedLyricsRow: document.getElementById("savedLyricsRow"),
  savedLyricsSelect: document.getElementById("savedLyricsSelect"),
  deleteLyricBtn: document.getElementById("deleteLyricBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  recalcBtn: document.getElementById("recalcBtn"),
  audioInfoBar: document.getElementById("audioInfoBar"),
  infoFilename: document.getElementById("infoFilename"),
  infoDuration: document.getElementById("infoDuration"),
  infoSampleRate: document.getElementById("infoSampleRate"),
  infoSentenceCount: document.getElementById("infoSentenceCount"),
  infoCutCount: document.getElementById("infoCutCount"),
  waveformContainer: document.querySelector(".waveform-container"),
  waveformEl: document.getElementById("waveform"),
  timelineEl: document.getElementById("timeline"),
  markersOverlay: null,
  sentenceOverlay: null,
  playPauseBtn: document.getElementById("playPauseBtn"),
  playIcon: document.getElementById("playIcon"),
  pauseIcon: document.getElementById("pauseIcon"),
  stopBtn: document.getElementById("stopBtn"),
  currentTime: document.getElementById("currentTime"),
  totalTime: document.getElementById("totalTime"),
  zoomSlider: document.getElementById("zoomSlider"),
  snapGapToggle: document.getElementById("snapGapToggle"),
  addCutAtCursorBtn: document.getElementById("addCutAtCursorBtn"),
  clearAllCutsBtn: document.getElementById("clearAllCutsBtn"),
  resetWorkspaceBtn: document.getElementById("resetWorkspaceBtn"),
  exportFormat: document.getElementById("exportFormat"),
  customPrefix: document.getElementById("customPrefix"),
  exportSrtToggle: document.getElementById("exportSrtToggle"),
  exportBtn: document.getElementById("exportBtn"),
  segmentsTableBody: document.getElementById("segmentsTableBody"),
  loadingModal: document.getElementById("loadingModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalDesc: document.getElementById("modalDesc"),
  headerStatus: document.getElementById("headerStatus"),
  uploadedHistoryCard: document.getElementById("uploadedHistoryCard"),
  uploadedHistoryList: document.getElementById("uploadedHistoryList"),
  uploadCountBadge: document.getElementById("uploadCountBadge"),
  refreshUploadsBtn: document.getElementById("refreshUploadsBtn"),
  savedProjectsSelect: document.getElementById("savedProjectsSelect"),
  deleteProjectBtn: document.getElementById("deleteProjectBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  importProjectBtn: document.getElementById("importProjectBtn"),
  projectFileInput: document.getElementById("projectFileInput"),
  saveAsModal: document.getElementById("saveAsModal"),
  saveAsNameInput: document.getElementById("saveAsNameInput"),
  closeSaveAsModalBtn: document.getElementById("closeSaveAsModalBtn"),
  cancelSaveAsBtn: document.getElementById("cancelSaveAsBtn"),
  confirmSaveAsBtn: document.getElementById("confirmSaveAsBtn"),
};

let statusTimer = null;
function setTemporaryHeaderStatus(text, type = "ready", duration = 4000) {
  if (!dom.headerStatus) return;
  if (statusTimer) clearTimeout(statusTimer);

  let bg = "rgba(59, 130, 246, 0.15)";
  let color = "#60a5fa";
  let border = "rgba(59, 130, 246, 0.3)";

  if (type === "success") {
    bg = "rgba(16, 185, 129, 0.2)";
    color = "#34d399";
    border = "rgba(16, 185, 129, 0.3)";
  } else if (type === "warning") {
    bg = "rgba(245, 158, 11, 0.2)";
    color = "#fbbf24";
    border = "rgba(245, 158, 11, 0.3)";
  } else if (type === "danger") {
    bg = "rgba(239, 68, 68, 0.2)";
    color = "#f87171";
    border = "rgba(239, 68, 68, 0.3)";
  }

  dom.headerStatus.innerHTML = `<span class="status-badge" style="background: ${bg}; color: ${color}; border-color: ${border};">${escapeHtml(text)}</span>`;

  if (duration > 0) {
    statusTimer = setTimeout(() => {
      dom.headerStatus.innerHTML = `<span class="status-badge ready">系統就緒</span>`;
    }, duration);
  }
}

// ==============================
// 狀態持久化 (防止 F5 重新整理消失)
// ==============================
const STATE_STORAGE_KEY = "audio_smart_splitter_state_v1";

function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function saveAppState() {
  try {
    const dataToSave = {
      timestamp: Date.now(),
      currentFileId: state.currentFileId,
      currentFileName: state.currentFileName,
      audioDuration: state.audioDuration,
      currentAudioData: state.currentAudioData || null,
      sentences: state.sentences || [],
      cutPoints: state.cutPoints || [],
      settings: {
        targetDuration: dom.targetDurationSlider ? dom.targetDurationSlider.value : "20",
        detectMode: dom.detectMode ? dom.detectMode.value : "vad",
        lyricText: dom.lyricTextInput ? dom.lyricTextInput.value : "",
        savedLyricId: dom.savedLyricsSelect ? dom.savedLyricsSelect.value : "",
        customPrefix: dom.customPrefix ? dom.customPrefix.value : "",
        exportFormat: dom.exportFormat ? dom.exportFormat.value : "MP3",
        exportSrt: dom.exportSrtToggle ? dom.exportSrtToggle.checked : true,
        snapGap: dom.snapGapToggle ? dom.snapGapToggle.checked : true,
        zoom: dom.zoomSlider ? dom.zoomSlider.value : "30",
      },
    };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn("自動儲存狀態失敗:", err);
  }
}

function clearSavedAppState() {
  try {
    localStorage.removeItem(STATE_STORAGE_KEY);
  } catch (err) {
    console.warn("清除暫存狀態失敗:", err);
  }
}

function resetEntireWorkspace() {
  clearSavedAppState();

  state.currentFileId = null;
  state.currentFileName = null;
  state.audioDuration = 0;
  state.currentAudioData = null;
  state.sentences = [];
  state.cutPoints = [];

  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }

  dom.audioInfoBar.style.display = "none";
  dom.analyzeBtn.disabled = true;
  dom.exportBtn.disabled = true;
  dom.recalcBtn.style.display = "none";
  if (dom.resetWorkspaceBtn) dom.resetWorkspaceBtn.style.display = "none";
  dom.uploadTitle.textContent = "點擊或將音訊檔拖曳至此";
  dom.headerStatus.innerHTML = `<span class="status-badge" style="background: rgba(156,163,175,0.2); color: #9ca3af; border-color: rgba(156,163,175,0.3);">未載入音訊</span>`;

  if (dom.markersOverlay) dom.markersOverlay.innerHTML = "";
  if (dom.sentenceOverlay) dom.sentenceOverlay.innerHTML = "";
  dom.segmentsTableBody.innerHTML = `
    <tr><td colspan="7" class="empty-hint">尚未產生切點，請先上傳音訊並點選「執行智慧避詞分析」</td></tr>
  `;

  highlightActiveHistoryItem(null);
}

// 初始化 WaveSurfer
let wavesurfer = null;

function initWaveSurfer() {
  if (wavesurfer) {
    wavesurfer.destroy();
  }

  // 使用 WaveSurfer v7
  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#3b82f6",
    progressColor: "#00f2fe",
    cursorColor: "#ffffff",
    cursorWidth: 2,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 120,
    normalize: true,
    minPxPerSec: parseInt(dom.zoomSlider.value, 10),
    autoCenter: false,
    autoScroll: true,
    plugins: [
      WaveSurfer.Timeline.create({
        container: "#timeline",
        primaryLabelInterval: 10,
        secondaryLabelInterval: 1,
        style: {
          color: "#9ca3af",
          fontSize: "10px",
        },
      }),
    ],
  });

  // 時間更新事件
  wavesurfer.on("timeupdate", (time) => {
    dom.currentTime.textContent = formatTime(time);

    // 若正在播放特定切片，到達結束時間則自動停止
    if (state.isPlayingSegment && state.segmentPlayEnd !== null) {
      if (time >= state.segmentPlayEnd) {
        wavesurfer.pause();
        state.isPlayingSegment = false;
        state.segmentPlayEnd = null;
        updateSegmentPlayButtons();
      }
    }
  });

  // 播放結束
  wavesurfer.on("finish", () => {
    updatePlayPauseIcons(false);
    state.isPlayingSegment = false;
    updateSegmentPlayButtons();
  });

  // 播放/暫停狀態改變
  wavesurfer.on("play", () => updatePlayPauseIcons(true));
  wavesurfer.on("pause", () => updatePlayPauseIcons(false));

  // 點擊波形時處理 Shift+點擊新增切點
  dom.waveformEl.addEventListener("click", (e) => {
    if (e.shiftKey && state.audioDuration > 0) {
      const clickTime = wavesurfer.getCurrentTime();
      addCutPoint(clickTime);
    }
  });
}

// 格式化時間 (mm:ss.xx)
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00.00";
  const totalHundredths = Math.round(seconds * 100);
  const mins = Math.floor(totalHundredths / 6000);
  const remHundredths = totalHundredths % 6000;
  const secs = Math.floor(remHundredths / 100);
  const hundredths = remHundredths % 100;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

// 格式化切點標籤時間為 mm:ss.xx (例如 01:00.77)
function formatSeconds(seconds) {
  return formatTime(seconds);
}

// 格式化時間標籤 (例如 0.0 -> 0000.00, 19.83 -> 0019.83)
function formatTimeTag(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0000.00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}${secs.toFixed(2).padStart(5, "0")}`;
}

// 彈出/關閉 Loading Modal
function showLoading(title, desc) {
  dom.modalTitle.textContent = title;
  dom.modalDesc.textContent = desc;
  dom.loadingModal.style.display = "flex";
}

function hideLoading() {
  dom.loadingModal.style.display = "none";
}

// 更新播放/暫停圖示
function updatePlayPauseIcons(isPlaying) {
  dom.playIcon.style.display = isPlaying ? "none" : "block";
  dom.pauseIcon.style.display = isPlaying ? "block" : "none";
}

// 事件綁定：檔案選擇與點擊
dom.browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dom.fileInput.click();
});

dom.dropZone.addEventListener("click", () => {
  dom.fileInput.click();
});

// 全域拖曳管理 (避免子元素閃爍與瀏覽器預設開啟檔案)
let dragCounter = 0;
const globalOverlay = document.getElementById("globalDragOverlay");

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

window.addEventListener("dragenter", (e) => {
  dragCounter++;
  if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    if (globalOverlay) globalOverlay.classList.add("active");
    dom.dropZone.classList.add("dragover");
  }
});

window.addEventListener("dragover", (e) => {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "copy";
  }
});

window.addEventListener("dragleave", (e) => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    if (globalOverlay) globalOverlay.classList.remove("active");
    dom.dropZone.classList.remove("dragover");
  }
});

window.addEventListener("drop", (e) => {
  dragCounter = 0;
  if (globalOverlay) globalOverlay.classList.remove("active");
  dom.dropZone.classList.remove("dragover");

  const files = e.dataTransfer ? e.dataTransfer.files : null;
  if (files && files.length > 0) {
    handleFileUpload(files[0]);
  }
});

dom.fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFileUpload(e.target.files[0]);
  }
});

// 輔助函式：HTML 逸出
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 輔助函式：檔案大小格式化
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// 統一套用音訊中繼資料並載入波形
function applyAudioData(data, keepState = false) {
  state.currentFileId = data.file_id;
  state.currentFileName = data.filename;
  state.audioDuration = data.duration;
  state.currentAudioData = data;

  if (!keepState) {
    state.sentences = [];
    state.cutPoints = [];
  }

  // 更新介面資訊
  dom.uploadTitle.textContent = `已載入: ${data.filename}`;
  dom.infoFilename.textContent = data.filename;
  dom.infoDuration.textContent = formatTime(data.duration);
  dom.infoSampleRate.textContent = `${data.sample_rate || 44100} Hz (${(data.format || "AUDIO").toUpperCase()})`;
  dom.infoSentenceCount.textContent = state.sentences.length > 0 ? `${state.sentences.length} 句` : "尚未分析";
  dom.infoCutCount.textContent = state.cutPoints.length > 0 ? `${state.cutPoints.length} 處` : "尚未切分";
  dom.audioInfoBar.style.display = "flex";
  dom.totalTime.textContent = formatTime(data.duration);
  dom.recalcBtn.style.display = state.sentences.length > 0 ? "inline-flex" : "none";
  if (dom.resetWorkspaceBtn) dom.resetWorkspaceBtn.style.display = "inline-flex";

  // 載入 WaveSurfer 波形
  initWaveSurfer();
  wavesurfer.load(data.audio_url);

  wavesurfer.on("ready", () => {
    hideLoading();
    dom.analyzeBtn.disabled = false;
    dom.exportBtn.disabled = false;

    // 注入樣式並初始化歌詞與切點層
    setupOverlays();

    renderMarkers();
    renderSentenceOverlay();
    updateSegmentsTable();

    if (keepState) {
      dom.headerStatus.innerHTML = `<span class="status-badge" style="background: rgba(16,185,129,0.2); color: #34d399; border-color: rgba(16,185,129,0.3);">⚡ 工作狀態已自動復原</span>`;
    } else {
      dom.headerStatus.innerHTML = `<span class="status-badge">音訊已載入</span>`;
    }

    highlightActiveHistoryItem(data.file_id);
    saveAppState();
  });
}

// 處理音訊上傳
async function handleFileUpload(file) {
  const formData = new FormData();
  formData.append("file", file);

  dom.uploadTitle.textContent = `正在上傳: ${file.name}...`;
  showLoading("正在上傳與讀取音訊", `解析 ${file.name} 中繼資料與格式...`);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "上傳失敗");
    }

    const data = await res.json();
    if (state.pendingProjectRebind) {
      applyAudioData(data, true);
      state.pendingProjectRebind = null;
      setTemporaryHeaderStatus(`⚡ 已成功綁定音訊：${data.filename}`, "success", 4000);
    } else {
      applyAudioData(data);
    }
    fetchUploadedFiles();
  } catch (err) {
    hideLoading();
    alert(`上傳失敗: ${err.message}`);
    dom.uploadTitle.textContent = "點擊或將音訊檔拖曳至此";
  }
}

// 目標秒數聯動
dom.targetDurationSlider.addEventListener("input", (e) => {
  const val = e.target.value;
  dom.targetDurationInput.value = val;
  dom.targetDurationVal.textContent = val;
});

dom.targetDurationInput.addEventListener("input", (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) val = 20;
  dom.targetDurationSlider.value = val;
  dom.targetDurationVal.textContent = val;
});

// 模式切換 (顯示或隱藏 SRT / LRC 歌詞輸入框)
dom.detectMode.addEventListener("change", (e) => {
  const mode = e.target.value;
  if (mode === "srt" || mode === "lrc") {
    dom.lyricFileContainer.style.display = "block";
    if (mode === "srt") {
      dom.lyricInputLabel.textContent = "SRT 字幕內容：";
      dom.lyricTextInput.placeholder = "1\n00:00:01,200 --> 00:00:04,500\n第一句歌詞\n\n2\n00:00:05,100 --> 00:00:08,200\n第二句歌詞";
    } else {
      dom.lyricInputLabel.textContent = "LRC 歌詞內容：";
      dom.lyricTextInput.placeholder = "[00:12.34]第一句歌詞\n[00:17.50]第二句歌詞";
    }
  } else {
    dom.lyricFileContainer.style.display = "none";
  }
});

// 取得已上傳字幕/歌詞檔案清單
async function fetchUploadedLyrics(selectedId = null) {
  try {
    const res = await fetch("/api/lyrics");
    if (res.ok) {
      const lyrics = await res.json();
      state.uploadedLyrics = lyrics || [];
      renderUploadedLyrics(state.uploadedLyrics, selectedId);
    }
  } catch (err) {
    console.error("載入已上傳字幕清單失敗:", err);
  }
}

function renderUploadedLyrics(lyrics, selectedId = null) {
  if (!dom.savedLyricsSelect) return;
  dom.savedLyricsSelect.innerHTML = `<option value="">📁 從已上傳字幕庫選取 (${lyrics.length} 個)...</option>`;

  lyrics.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.id;
    const fmt = (l.format || "TXT").toUpperCase();
    opt.textContent = `[${fmt}] ${l.filename} (${l.upload_time || ""})`;
    dom.savedLyricsSelect.appendChild(opt);
  });

  if (selectedId) {
    dom.savedLyricsSelect.value = selectedId;
    if (dom.deleteLyricBtn) dom.deleteLyricBtn.style.display = "inline-flex";
  } else {
    if (dom.deleteLyricBtn) dom.deleteLyricBtn.style.display = "none";
  }
}

// 選擇已上傳字幕檔案
if (dom.savedLyricsSelect) {
  dom.savedLyricsSelect.addEventListener("change", (e) => {
    const lyricId = e.target.value;
    if (!lyricId) {
      if (dom.deleteLyricBtn) dom.deleteLyricBtn.style.display = "none";
      return;
    }

    const lyric = state.uploadedLyrics.find((item) => item.id === lyricId);
    if (lyric) {
      dom.lyricTextInput.value = lyric.content || "";
      const fmt = (lyric.format || "").toLowerCase();
      if (fmt === "srt") {
        dom.detectMode.value = "srt";
        dom.lyricInputLabel.textContent = "SRT 字幕內容：";
      } else if (fmt === "lrc") {
        dom.detectMode.value = "lrc";
        dom.lyricInputLabel.textContent = "LRC 歌詞內容：";
      }
      if (dom.deleteLyricBtn) dom.deleteLyricBtn.style.display = "inline-flex";
    }
  });
}

// 刪除選取的字幕檔案
if (dom.deleteLyricBtn) {
  dom.deleteLyricBtn.addEventListener("click", async () => {
    const lyricId = dom.savedLyricsSelect.value;
    if (!lyricId) return;

    const lyric = state.uploadedLyrics.find((item) => item.id === lyricId);
    const name = lyric ? lyric.filename : "此字幕檔案";

    if (!confirm(`確定要刪除「${name}」嗎？`)) return;

    try {
      const res = await fetch(`/api/lyrics/${encodeURIComponent(lyricId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "刪除失敗");
      }

      dom.lyricTextInput.value = "";
      await fetchUploadedLyrics();
    } catch (err) {
      alert(`刪除字幕檔案失敗: ${err.message}`);
    }
  });
}

// 處理選取新字幕檔案並上傳到後端字幕庫
async function handleLyricFileUpload(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  // 本地 FileReader 立即呈現
  const reader = new FileReader();
  reader.onload = (evt) => {
    dom.lyricTextInput.value = evt.target.result;
    if (ext === "srt") {
      dom.detectMode.value = "srt";
      dom.lyricInputLabel.textContent = "SRT 字幕內容：";
    } else if (ext === "lrc") {
      dom.detectMode.value = "lrc";
      dom.lyricInputLabel.textContent = "LRC 歌詞內容：";
    }
    dom.detectMode.dispatchEvent(new Event("change"));
    saveAppState();
  };
  reader.readAsText(file);

  // 同步上傳至後端字幕庫
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload_lyric", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      await fetchUploadedLyrics(data.id);
      saveAppState();
    }
  } catch (err) {
    console.error("上傳字幕庫失敗:", err);
  }
}

// 點擊選取 SRT / LRC 檔案
if (dom.chooseLyricFileBtn) {
  dom.chooseLyricFileBtn.addEventListener("click", () => {
    dom.lyricFileInput.click();
  });
}

if (dom.lyricFileInput) {
  dom.lyricFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLyricFileUpload(e.target.files[0]);
    }
  });
}

// 執行智慧分析
dom.analyzeBtn.addEventListener("click", async () => {
  if (!state.currentFileId) return;

  const targetSec = parseFloat(dom.targetDurationInput.value) || 20;
  const mode = dom.detectMode.value;
  const lyricText = dom.lyricTextInput.value;

  showLoading(
    "智慧避詞分析中",
    mode === "whisper"
      ? "AI 正在辨識歌詞語句起訖時間，請稍候..."
      : mode === "srt"
      ? "正在精準對齊 SRT 字幕時間戳記..."
      : mode === "lrc"
      ? "正在精準對齊 LRC 歌詞時間戳記..."
      : "正在分析人聲能量與語句空隙..."
  );

  const formData = new FormData();
  formData.append("file_id", state.currentFileId);
  formData.append("target_duration", targetSec);
  formData.append("mode", mode);
  if (mode === "srt") {
    formData.append("srt_text", lyricText);
  } else if (mode === "lrc") {
    formData.append("lrc_text", lyricText);
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "分析失敗");
    }

    const data = await res.json();
    state.sentences = data.sentences || [];
    state.cutPoints = data.cut_points || [];

    dom.infoSentenceCount.textContent = `${state.sentences.length} 句`;
    dom.infoCutCount.textContent = `${state.cutPoints.length} 處`;
    dom.recalcBtn.style.display = "inline-flex";

    renderSentenceOverlay();
    renderMarkers();
    updateSegmentsTable();
    saveAppState();

    hideLoading();

    // 若有後端提示 (例如自動切換 VAD)
    if (data.notice) {
      alert(`💡 系統提示：\n${data.notice}`);
    }
  } catch (err) {
    hideLoading();
    alert(`分析失敗: ${err.message}`);
  }
});

// 依新秒數重算切點
dom.recalcBtn.addEventListener("click", async () => {
  if (!state.currentFileId) return;
  const targetSec = parseFloat(dom.targetDurationInput.value) || 20;

  try {
    const res = await fetch("/api/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_id: state.currentFileId,
        target_duration: targetSec,
      }),
    });

    if (!res.ok) throw new Error("重算切點失敗");
    const data = await res.json();
    state.cutPoints = data.cut_points || [];

    dom.infoCutCount.textContent = `${state.cutPoints.length} 處`;
    renderMarkers();
    updateSegmentsTable();
    saveAppState();
  } catch (err) {
    alert(err.message);
  }
});

// 更新軌道總寬度 (使時間軸、波形、歌詞軌、切線在縮放時完全聯動)
function updateTrackWidth() {
  const wrapper = document.getElementById("waveformTrackWrapper");
  if (!wrapper || state.audioDuration <= 0) return;
  const minPxPerSec = parseInt(dom.zoomSlider.value, 10);
  const containerW = dom.waveformContainer.clientWidth;
  const totalPx = Math.max(containerW, Math.ceil(state.audioDuration * minPxPerSec));
  wrapper.style.width = `${totalPx}px`;
}

// 縮放滑桿
dom.zoomSlider.addEventListener("input", (e) => {
  if (wavesurfer) {
    const px = parseInt(e.target.value, 10);
    wavesurfer.zoom(px);
    updateTrackWidth();
    renderSentenceOverlay();
    renderMarkers();
  }
});

// 播放 / 暫停控制
dom.playPauseBtn.addEventListener("click", () => {
  if (!wavesurfer) return;
  state.isPlayingSegment = false;
  state.segmentPlayEnd = null;
  wavesurfer.playPause();
});

dom.stopBtn.addEventListener("click", () => {
  if (!wavesurfer) return;
  wavesurfer.stop();
  wavesurfer.setTime(0);
  state.isPlayingSegment = false;
  state.segmentPlayEnd = null;
  updateSegmentPlayButtons();
});

// 鍵盤快捷鍵：空白鍵播放/暫停、Ctrl+S 另存新檔
document.addEventListener("keydown", (e) => {
  // Ctrl+S / Cmd+S 另存新檔
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
    e.preventDefault();
    saveProjectWorkflow();
    return;
  }

  // 空白鍵播放/暫停 (避免在輸入框中打字時觸發)
  if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    if (wavesurfer) {
      state.isPlayingSegment = false;
      state.segmentPlayEnd = null;
      wavesurfer.playPause();
    }
  }
});

// 在目前游標處下刀
dom.addCutAtCursorBtn.addEventListener("click", () => {
  if (!wavesurfer || state.audioDuration <= 0) return;
  const currTime = wavesurfer.getCurrentTime();
  addCutPoint(currTime);
});

// 清空所有切點
dom.clearAllCutsBtn.addEventListener("click", () => {
  if (confirm("確定要清空所有切點嗎？")) {
    state.cutPoints = [];
    dom.infoCutCount.textContent = "0 處";
    renderMarkers();
    updateSegmentsTable();
    saveAppState();
  }
});

// 新增切點
function addCutPoint(time) {
  let targetTime = Math.max(0.1, Math.min(state.audioDuration - 0.1, time));

  // 若開啟智慧吸附，檢查附近是否有空隙
  if (dom.snapGapToggle.checked) {
    targetTime = snapToNearestGap(targetTime);
  }

  // 避免與現有切點太接近 (< 0.2s)
  const isTooClose = state.cutPoints.some((c) => Math.abs(c - targetTime) < 0.2);
  if (isTooClose) return;

  state.cutPoints.push(Math.round(targetTime * 100) / 100);
  state.cutPoints.sort((a, b) => a - b);

  dom.infoCutCount.textContent = `${state.cutPoints.length} 處`;
  renderMarkers();
  updateSegmentsTable();
  saveAppState();
}

// 刪除切點
function removeCutPoint(index) {
  state.cutPoints.splice(index, 1);
  dom.infoCutCount.textContent = `${state.cutPoints.length} 處`;
  renderMarkers();
  updateSegmentsTable();
  saveAppState();
}

// 尋找最近的歌詞間隙吸附點 (Snap to Gap)
function snapToNearestGap(time) {
  if (!state.sentences || state.sentences.length === 0) return time;

  let bestGapCenter = null;
  let minDiff = 1.2; // 吸附範圍半徑 1.2 秒內

  // 檢查所有句間空隙
  for (let i = 0; i < state.sentences.length - 1; i++) {
    const end = state.sentences[i].end;
    const nextStart = state.sentences[i + 1].start;
    const center = (end + nextStart) / 2;
    const diff = Math.abs(center - time);
    if (diff < minDiff) {
      minDiff = diff;
      bestGapCenter = center;
    }
  }

  return bestGapCenter !== null ? bestGapCenter : time;
}

// 注入 Shadow DOM 專用樣式，確保切點與歌詞在 WaveSurfer Shadow DOM 內部正確渲染
function injectShadowStyles() {
  if (!wavesurfer) return;
  const wrapper = wavesurfer.getWrapper();
  if (!wrapper) return;
  const shadow = wrapper.getRootNode();
  if (!shadow) return;

  if (shadow.getElementById && shadow.getElementById("smart-splitter-shadow-style")) {
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.id = "smart-splitter-shadow-style";
  styleEl.textContent = `
    :host .wrapper {
      position: relative !important;
      overflow: visible !important;
      min-height: 160px !important;
      padding-bottom: 38px !important;
      box-sizing: border-box !important;
    }
    :host .scroll {
      scrollbar-width: thin !important;
      scrollbar-color: #374151 #0d0f15 !important;
    }
    :host .scroll::-webkit-scrollbar {
      height: 8px !important;
    }
    :host .scroll::-webkit-scrollbar-track {
      background: #0d0f15 !important;
      border-top: 1px solid #1a202c !important;
    }
    :host .scroll::-webkit-scrollbar-thumb {
      background: #374151 !important;
      border-radius: 4px !important;
    }
    :host .scroll::-webkit-scrollbar-thumb:hover {
      background: #4b5563 !important;
    }

    .sentence-overlay {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 36px !important;
      background-color: rgba(17, 20, 30, 0.95) !important;
      border-top: 1px solid #252d40 !important;
      pointer-events: none !important;
      z-index: 5 !important;
    }

    .sentence-box {
      position: absolute !important;
      top: 5px !important;
      height: 26px !important;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.6), rgba(109, 40, 217, 0.5)) !important;
      border: 1px solid rgba(167, 139, 250, 0.85) !important;
      border-radius: 4px !important;
      color: #ffffff !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      font-family: inherit !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      padding: 0 6px !important;
      line-height: 24px !important;
      user-select: none !important;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.15s ease !important;
      pointer-events: auto !important;
      cursor: default !important;
      box-sizing: border-box !important;
      text-align: center !important;
    }

    .sentence-box:hover {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(109, 40, 217, 0.8)) !important;
      border-color: #ffffff !important;
      z-index: 8 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 10px rgba(139, 92, 246, 0.4) !important;
    }

    .markers-overlay {
      position: absolute !important;
      top: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      pointer-events: none !important;
      z-index: 10 !important;
    }

    .cut-marker {
      position: absolute !important;
      top: 0 !important;
      bottom: 0 !important;
      width: 2px !important;
      background-color: #ff3b30 !important;
      pointer-events: auto !important;
      cursor: ew-resize !important;
      z-index: 10 !important;
      transition: background-color 0.1s ease !important;
    }

    .cut-marker::before {
      content: "" !important;
      position: absolute !important;
      top: 0 !important;
      bottom: 0 !important;
      left: -8px !important;
      width: 18px !important;
      cursor: ew-resize !important;
    }

    .cut-marker:hover, .cut-marker.dragging {
      background-color: #ffffff !important;
      box-shadow: 0 0 10px rgba(255, 56, 56, 0.8) !important;
    }

    .cut-handle {
      position: absolute !important;
      top: 2px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background-color: #ff3b30 !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
      font-variant-numeric: tabular-nums !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      white-space: nowrap !important;
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
      user-select: none !important;
      pointer-events: auto !important;
    }

    .cut-marker:hover .cut-handle, .cut-marker.dragging .cut-handle {
      background-color: #ef4444 !important;
      transform: translateX(-50%) scale(1.05) !important;
    }

    .cut-delete-btn {
      display: inline-block !important;
      cursor: pointer !important;
      padding: 0 2px !important;
      border-radius: 2px !important;
      line-height: 1 !important;
      opacity: 0.85 !important;
      transition: opacity 0.15s !important;
    }

    .cut-delete-btn:hover {
      opacity: 1 !important;
      background-color: rgba(0, 0, 0, 0.3) !important;
      color: #ffffff !important;
    }
  `;

  shadow.appendChild(styleEl);
}

// 初始化並掛載切點與歌詞覆蓋層
function setupOverlays() {
  if (!wavesurfer) return;
  const wrapper = wavesurfer.getWrapper();
  if (!wrapper) return;

  injectShadowStyles();

  // 取得或建立歌詞層
  let sOverlay = wrapper.querySelector(".sentence-overlay");
  if (!sOverlay) {
    sOverlay = document.createElement("div");
    sOverlay.className = "sentence-overlay";
    wrapper.appendChild(sOverlay);
  }
  dom.sentenceOverlay = sOverlay;

  // 取得或建立切點標記層
  let mOverlay = wrapper.querySelector(".markers-overlay");
  if (!mOverlay) {
    mOverlay = document.createElement("div");
    mOverlay.className = "markers-overlay";
    wrapper.appendChild(mOverlay);
  }
  dom.markersOverlay = mOverlay;
}

// 繪製波形底層的歌詞/語句區間 (Sentence Overlay)
function renderSentenceOverlay() {
  if (!dom.sentenceOverlay || !dom.sentenceOverlay.parentElement) {
    setupOverlays();
  }
  if (!dom.sentenceOverlay) return;
  dom.sentenceOverlay.innerHTML = "";
  if (!state.sentences || state.sentences.length === 0 || state.audioDuration <= 0) return;

  const totalDur = state.audioDuration;

  state.sentences.forEach((s) => {
    const leftPct = (s.start / totalDur) * 100;
    const widthPct = ((s.end - s.start) / totalDur) * 100;

    const box = document.createElement("div");
    box.className = "sentence-box";
    box.style.position = "absolute";
    box.style.left = `${leftPct}%`;
    box.style.width = `${Math.max(widthPct, 0.4)}%`;
    box.style.top = "5px";
    box.style.height = "26px";
    box.style.boxSizing = "border-box";
    box.title = `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`;
    box.textContent = s.text || `句 #${s.id}`;

    dom.sentenceOverlay.appendChild(box);
  });
}

// 繪製切點標記線與拖曳手柄 (Markers Overlay)
function renderMarkers() {
  if (!dom.markersOverlay || !dom.markersOverlay.parentElement) {
    setupOverlays();
  }
  if (!dom.markersOverlay) return;
  dom.markersOverlay.innerHTML = "";
  if (state.audioDuration <= 0) return;

  const totalDur = state.audioDuration;

  state.cutPoints.forEach((cutTime, idx) => {
    const leftPct = (cutTime / totalDur) * 100;

    const marker = document.createElement("div");
    marker.className = "cut-marker";
    marker.style.position = "absolute";
    marker.style.top = "0";
    marker.style.bottom = "0";
    marker.style.left = `${leftPct}%`;
    marker.style.width = "2px";
    marker.dataset.index = idx;

    const handle = document.createElement("div");
    handle.className = "cut-handle";
    handle.innerHTML = `
      <span>✂️ ${formatSeconds(cutTime)}</span>
      <span class="cut-delete-btn" title="刪除切點">✕</span>
    `;

    // 點擊 ✕ 刪除切點
    const delBtn = handle.querySelector(".cut-delete-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCutPoint(idx);
    });

    // 拖曳切點邏輯 (Mouse Drag)
    marker.addEventListener("mousedown", (e) => {
      if (e.target === delBtn) return;
      e.preventDefault();
      e.stopPropagation();

      state.isDraggingCut = true;
      state.draggedCutIndex = idx;
      marker.classList.add("dragging");

      const overlayRect = dom.markersOverlay.getBoundingClientRect();

      function onMouseMove(moveEvent) {
        if (!state.isDraggingCut) return;

        let relativeX = moveEvent.clientX - overlayRect.left;
        relativeX = Math.max(0, Math.min(relativeX, overlayRect.width));

        let newTime = (relativeX / overlayRect.width) * totalDur;

        // 智慧吸附
        if (dom.snapGapToggle.checked) {
          newTime = snapToNearestGap(newTime);
        }

        newTime = Math.round(newTime * 100) / 100;
        state.cutPoints[idx] = newTime;

        // 即時更新標記位置與時間文字
        const newLeftPct = (newTime / totalDur) * 100;
        marker.style.left = `${newLeftPct}%`;
        handle.querySelector("span:first-child").textContent = `✂️ ${formatSeconds(newTime)}`;
      }

      function onMouseUp() {
        state.isDraggingCut = false;
        marker.classList.remove("dragging");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        // 拖曳結束後重新排序切點並更新片段清單
        state.cutPoints.sort((a, b) => a - b);
        renderMarkers();
        updateSegmentsTable();
        saveAppState();
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    marker.appendChild(handle);
    dom.markersOverlay.appendChild(marker);
  });
}

// 計算並更新切片表格清單 (Segments List)
function updateSegmentsTable() {
  const cuts = [0, ...state.cutPoints, state.audioDuration];
  cuts.sort((a, b) => a - b);

  dom.segmentsTableBody.innerHTML = "";

  if (cuts.length <= 1 || state.audioDuration <= 0) {
    dom.segmentsTableBody.innerHTML = `
      <tr><td colspan="7" class="empty-hint">尚未產生切點，請先上傳音訊並點選「執行智慧避詞分析」</td></tr>
    `;
    return;
  }

  const baseName = dom.customPrefix.value.trim() || (state.currentFileName ? state.currentFileName.replace(/\.[^/.]+$/, "") : "segment");
  const ext = dom.exportFormat.value.toLowerCase();

  let segIndex = 1;
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    const dur = end - start;
    if (dur < 0.05) continue;

    // 尋找涵蓋的歌詞文字
    const containedLyrics = state.sentences
      .filter((s) => s.start >= start - 0.2 && s.end <= end + 0.2)
      .map((s) => s.text)
      .filter(Boolean)
      .join(" / ");

    const tr = document.createElement("tr");
    tr.dataset.index = segIndex - 1;
    tr.dataset.start = start;
    tr.dataset.end = end;

    const timeTag = `-${formatTimeTag(start)}-${formatTimeTag(end)}(${dur.toFixed(2)})`;
    const segmentFilename = `${baseName}_part_${String(segIndex).padStart(2, "0")}${timeTag}.${ext}`;

    tr.innerHTML = `
      <td class="col-num"><strong>#${String(segIndex).padStart(2, "0")}</strong></td>
      <td class="col-name"><code>${escapeHtml(segmentFilename)}</code></td>
      <td class="col-time">${formatTime(start)}</td>
      <td class="col-time">${formatTime(end)}</td>
      <td class="col-dur"><span class="info-value text-accent">${dur.toFixed(2)} 秒</span></td>
      <td class="col-lyric"><div class="lyric-preview" title="${escapeHtml(containedLyrics)}">${escapeHtml(containedLyrics) || "(純音樂 / 前後奏)"}</div></td>
      <td class="col-action">
        <div class="table-action-group">
          <button class="btn-play-seg" data-start="${start}" data-end="${end}" title="試聽此片段">
            ▶ 試聽
          </button>
          <button class="btn-export-seg" data-seg-index="${segIndex}" title="單獨切片匯出此段">
            ⬇️ 匯出
          </button>
        </div>
      </td>
    `;

    const playSegBtn = tr.querySelector(".btn-play-seg");
    playSegBtn.addEventListener("click", () => {
      playSegment(start, end, playSegBtn);
    });

    const exportSegBtn = tr.querySelector(".btn-export-seg");
    const currentSegIdx = segIndex;
    exportSegBtn.addEventListener("click", () => {
      exportAudio(currentSegIdx);
    });

    dom.segmentsTableBody.appendChild(tr);
    segIndex++;
  }
}

// 平滑滾動波形將目標時間置於視野內 (解決片段試聽波形位置不對的問題)
function scrollToTime(time) {
  if (!wavesurfer || state.audioDuration <= 0) return;
  const wrapper = wavesurfer.getWrapper();
  if (!wrapper) return;
  const scrollContainer = wrapper.parentElement;
  if (!scrollContainer) return;

  const totalWidth = wrapper.scrollWidth || wrapper.clientWidth;
  const containerWidth = scrollContainer.clientWidth;

  if (totalWidth > containerWidth) {
    const targetX = (time / state.audioDuration) * totalWidth;
    // 將起點時間置於可視區域左側約 20% 處，保留前奏視野，展開後續音訊
    const scrollLeft = Math.max(0, targetX - containerWidth * 0.2);
    scrollContainer.scrollTo({
      left: scrollLeft,
      behavior: "smooth",
    });
  }
}

// 單獨片段試聽控制
function playSegment(start, end, btn) {
  if (!wavesurfer) return;

  if (state.isPlayingSegment && state.segmentPlayEnd === end) {
    // 正在播放這一段 -> 暫停
    wavesurfer.pause();
    state.isPlayingSegment = false;
    state.segmentPlayEnd = null;
    updateSegmentPlayButtons();
    return;
  }

  // 自動平滑滾動波形到該片段起點
  scrollToTime(start);

  // 開始播放該片段
  wavesurfer.setTime(start);
  state.isPlayingSegment = true;
  state.segmentPlayEnd = end;
  wavesurfer.play();

  updateSegmentPlayButtons(btn);
}

function updateSegmentPlayButtons(activeBtn = null) {
  const allBtns = document.querySelectorAll(".btn-play-seg");
  allBtns.forEach((b) => {
    if (b === activeBtn && state.isPlayingSegment) {
      b.textContent = "⏸ 暫停";
      b.classList.add("playing");
    } else {
      b.textContent = "▶ 試聽";
      b.classList.remove("playing");
    }
  });
}

// 格式更動時即時更新表格預覽
dom.exportFormat.addEventListener("change", () => {
  updateSegmentsTable();
  saveAppState();
});
dom.customPrefix.addEventListener("input", () => {
  updateSegmentsTable();
  saveAppState();
});

// 匯出音訊核心函式 (支援全選批次匯出 或 單片段匯出)
async function exportAudio(singleIndex = null) {
  if (!state.currentFileId) return;

  const format = dom.exportFormat.value;
  const customName = dom.customPrefix.value.trim();
  const exportSrt = dom.exportSrtToggle ? dom.exportSrtToggle.checked : true;

  const isSingle = singleIndex !== null;
  const title = isSingle ? `正在匯出片段 #${singleIndex}` : "正在批次切片並打包";
  const desc = isSingle
    ? `使用 FFmpeg 轉碼為 ${format.toUpperCase()}${exportSrt ? " 並產生相對時間 SRT 字幕" : ""}...`
    : `使用 FFmpeg 轉碼為 ${format.toUpperCase()}${exportSrt ? " 並產生各段 SRT 字幕" : ""} 中...`;

  showLoading(title, desc);

  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_id: state.currentFileId,
        cut_points: state.cutPoints,
        format: format,
        custom_name: customName || null,
        export_srt: exportSrt,
        sentences: state.sentences || [],
        single_segment_index: singleIndex,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "匯出失敗");
    }

    const data = await res.json();
    hideLoading();

    // 觸發下載
    const downloadUrl = data.download_url || data.zip_download_url;
    if (downloadUrl) {
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = "";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }

    if (isSingle) {
      setTemporaryHeaderStatus(
        `⬇️ 片段 #${singleIndex} 匯出成功${exportSrt ? " (含相對時間 SRT)" : ""}！已開始下載`,
        "success",
        5000
      );
    } else {
      setTemporaryHeaderStatus(
        `📦 成功切成 ${data.segment_count} 個片段${exportSrt ? " (含各段相對時間 SRT)" : ""}，已開始下載 ZIP！`,
        "success",
        5000
      );
    }
  } catch (err) {
    hideLoading();
    setTemporaryHeaderStatus(`❌ 匯出失敗: ${err.message}`, "danger", 5000);
  }
}

// 點擊批次切片按鈕
dom.exportBtn.addEventListener("click", () => {
  exportAudio(null);
});

// 頁面初始化檢查系統能力
async function checkSystemCapabilities() {
  try {
    const res = await fetch("/api/system_info");
    if (res.ok) {
      const data = await res.json();
      const whisperOpt = dom.detectMode.querySelector('option[value="whisper"]');
      if (whisperOpt) {
        if (data.whisper_ready) {
          whisperOpt.textContent = "Whisper AI 語音/歌詞時間軸辨識 (已就緒)";
        } else {
          whisperOpt.textContent = "Whisper AI (未安裝，將自動切換為VAD)";
        }
      }
    }
  } catch (e) {
    // 忽略
  }
}

// 取得已上傳音訊檔案清單
async function fetchUploadedFiles() {
  try {
    const res = await fetch("/api/uploads");
    if (res.ok) {
      const files = await res.json();
      renderUploadedFiles(files);
    }
  } catch (err) {
    console.error("載入已上傳檔案清單失敗:", err);
  }
}

function renderUploadedFiles(files) {
  if (!dom.uploadedHistoryList) return;
  if (dom.uploadCountBadge) {
    dom.uploadCountBadge.textContent = files ? files.length : 0;
  }

  if (!files || files.length === 0) {
    dom.uploadedHistoryList.innerHTML = '<div class="history-empty">目前沒有已上傳的音訊</div>';
    return;
  }

  dom.uploadedHistoryList.innerHTML = "";
  files.forEach((f) => {
    const item = document.createElement("div");
    item.className = `history-item ${state.currentFileId === f.file_id ? "active" : ""}`;
    item.dataset.fileId = f.file_id;

    const sizeStr = f.size_bytes ? formatBytes(f.size_bytes) : "";
    const durStr = f.duration ? formatTime(f.duration) : "";

    item.innerHTML = `
      <div class="history-item-info" title="${escapeHtml(f.filename)}">
        <div class="history-item-name">${escapeHtml(f.filename)}</div>
        <div class="history-item-meta">
          <span>⏱️ ${durStr}</span>
          ${sizeStr ? `<span>💾 ${sizeStr}</span>` : ""}
          <span>📅 ${f.upload_time || ""}</span>
        </div>
      </div>
      <div class="history-item-actions">
        <button type="button" class="btn-tiny btn-use" title="載入此音訊進行切分">▶ 載入</button>
        <button type="button" class="btn-tiny btn-tiny-danger btn-delete" title="刪除此檔案">🗑️</button>
      </div>
    `;

    // 點擊「載入」按鈕
    item.querySelector(".btn-use").addEventListener("click", (e) => {
      e.stopPropagation();
      loadUploadedFile(f);
    });

    // 點選整列亦可載入
    item.addEventListener("click", () => {
      loadUploadedFile(f);
    });

    // 點擊「刪除」按鈕
    item.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteUploadedFile(f.file_id, f.filename);
    });

    dom.uploadedHistoryList.appendChild(item);
  });
}

function highlightActiveHistoryItem(fileId) {
  if (!dom.uploadedHistoryList) return;
  const items = dom.uploadedHistoryList.querySelectorAll(".history-item");
  items.forEach((it) => {
    if (it.dataset.fileId === fileId) {
      it.classList.add("active");
    } else {
      it.classList.remove("active");
    }
  });
}

function loadUploadedFile(fileData) {
  if (state.currentFileId === fileData.file_id) {
    return; // 已是目前開啟檔案
  }
  showLoading("載入音訊", `正在載入已上傳檔案：${fileData.filename}...`);
  applyAudioData(fileData);
}

async function deleteUploadedFile(fileId, filename) {
  if (!confirm(`確定要刪除「${filename}」嗎？\n刪除後伺服器將不再保留此檔案。`)) {
    return;
  }

  try {
    const res = await fetch(`/api/uploads/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "刪除失敗");
    }

    // 若刪除的是當前正在編輯的音訊，清空波形與狀態
    if (state.currentFileId === fileId) {
      resetEntireWorkspace();
    }

    await fetchUploadedFiles();
  } catch (err) {
    alert(`刪除失敗: ${err.message}`);
  }
}

// 監聽重新整理已上傳檔案按鈕
if (dom.refreshUploadsBtn) {
  dom.refreshUploadsBtn.addEventListener("click", () => {
    fetchUploadedFiles();
  });
}

// 復原先前的狀態 (防止 F5 刷新後遺失)
async function restoreAppState() {
  const raw = localStorage.getItem(STATE_STORAGE_KEY);
  if (!raw) return false;

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (e) {
    clearSavedAppState();
    return false;
  }

  if (!saved) return false;

  // 1. 復原表單與控制項設定
  if (saved.settings) {
    const s = saved.settings;
    if (s.targetDuration) {
      dom.targetDurationSlider.value = s.targetDuration;
      dom.targetDurationInput.value = s.targetDuration;
      dom.targetDurationVal.textContent = s.targetDuration;
    }
    if (s.detectMode) {
      dom.detectMode.value = s.detectMode;
      dom.detectMode.dispatchEvent(new Event("change"));
    }
    if (s.lyricText) {
      dom.lyricTextInput.value = s.lyricText;
    }
    if (s.customPrefix !== undefined) {
      dom.customPrefix.value = s.customPrefix;
    }
    if (s.exportFormat) {
      dom.exportFormat.value = s.exportFormat;
    }
    if (s.exportSrt !== undefined && dom.exportSrtToggle) {
      dom.exportSrtToggle.checked = s.exportSrt;
    }
    if (s.snapGap !== undefined) {
      dom.snapGapToggle.checked = s.snapGap;
    }
    if (s.zoom) {
      dom.zoomSlider.value = s.zoom;
    }
  }

  // 2. 復原音訊波形與切點標記
  if (saved.currentFileId && saved.currentAudioData) {
    try {
      const chkRes = await fetch(`/api/audio/${encodeURIComponent(saved.currentFileId)}`);
      if (!chkRes.ok) {
        console.warn("暫存的音訊檔案在伺服器上無法取得 (HTTP " + chkRes.status + ")");
        return false;
      }
    } catch (e) {
      console.warn("無法連接伺服器驗證暫存音訊:", e);
      return false;
    }

    state.sentences = Array.isArray(saved.sentences) ? saved.sentences : [];
    state.cutPoints = Array.isArray(saved.cutPoints) ? saved.cutPoints : [];

    showLoading("復原工作狀態", `正在復原「${saved.currentAudioData.filename}」的音訊波形與切點...`);
    applyAudioData(saved.currentAudioData, true);
    return true;
  }

  return false;
}

// 重設工作區按鈕
if (dom.resetWorkspaceBtn) {
  dom.resetWorkspaceBtn.addEventListener("click", () => {
    if (confirm("確定要重設工作區並清空目前的所有切點與暫存狀態嗎？\n（伺服器上已上傳的檔案仍會保留）")) {
      resetEntireWorkspace();
    }
  });
}

// 各輸入控制項變更監聽與自動儲存
dom.targetDurationSlider.addEventListener("change", saveAppState);
dom.targetDurationInput.addEventListener("change", saveAppState);
dom.detectMode.addEventListener("change", saveAppState);
dom.lyricTextInput.addEventListener("input", debounce(saveAppState, 400));
if (dom.savedLyricsSelect) {
  dom.savedLyricsSelect.addEventListener("change", saveAppState);
}
if (dom.exportSrtToggle) {
  dom.exportSrtToggle.addEventListener("change", saveAppState);
}
dom.snapGapToggle.addEventListener("change", saveAppState);
dom.zoomSlider.addEventListener("change", saveAppState);
window.addEventListener("beforeunload", saveAppState);

// ==========================================
// 工作檔 (專案檔) 儲存、取出與匯入/匯出模組
// ==========================================

// 抓取伺服器已存工作檔清單
async function fetchSavedProjects(selectedId = null) {
  try {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const projects = await res.json();
      state.savedProjects = projects || [];
      renderSavedProjects(state.savedProjects, selectedId);
    }
  } catch (err) {
    console.error("載入專案清單失敗:", err);
  }
}

// 渲染工作檔下拉選單
function renderSavedProjects(projects, selectedId = null) {
  if (!dom.savedProjectsSelect) return;
  dom.savedProjectsSelect.innerHTML = `<option value="">📁 已存工作檔 (${projects.length} 個)...</option>`;

  projects.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.project_id;
    const durStr = p.audio_duration ? ` · ${formatTime(p.audio_duration)}` : "";
    const cutsStr = p.cuts_count ? ` · ✂️${p.cuts_count}` : "";
    opt.textContent = `${p.project_name}${durStr}${cutsStr}`;
    if (selectedId && p.project_id === selectedId) {
      opt.selected = true;
    }
    dom.savedProjectsSelect.appendChild(opt);
  });

  if (dom.deleteProjectBtn) {
    dom.deleteProjectBtn.style.display = dom.savedProjectsSelect.value ? "inline-flex" : "none";
  }
}

// 封裝當前工作區為專案資料物件
function buildProjectData(projectName) {
  return {
    project_id: state.currentProjectId || null,
    project_name: projectName,
    project_version: "1.1.2",
    created_at: new Date().toISOString(),
    audio: {
      file_id: state.currentFileId,
      filename: state.currentFileName,
      duration: state.audioDuration,
      sample_rate: state.currentAudioData ? state.currentAudioData.sample_rate : 44100,
      format: state.currentAudioData ? state.currentAudioData.format : "audio",
      audio_url: state.currentAudioData ? state.currentAudioData.audio_url : (state.currentFileId ? `/api/audio/${state.currentFileId}` : "")
    },
    detection: {
      mode: dom.detectMode.value,
      lyric_text: dom.lyricTextInput.value,
      saved_lyric_id: dom.savedLyricsSelect ? dom.savedLyricsSelect.value : "",
      sentences: state.sentences || []
    },
    cut_points: state.cutPoints || [],
    settings: {
      target_duration: dom.targetDurationSlider.value,
      custom_prefix: dom.customPrefix.value,
      export_format: dom.exportFormat.value,
      snap_gap: dom.snapGapToggle.checked,
      zoom: dom.zoomSlider.value
    }
  };
}

// 另存新檔 (支援本機系統原生另存對話框，以及跨網段/非本機暗黑對話框)
async function saveProjectWorkflow() {
  if (!state.currentFileId && state.cutPoints.length === 0) {
    setTemporaryHeaderStatus("⚠️ 目前工作區尚未載入音訊或未產生切點", "warning", 3000);
    return;
  }

  const defaultBaseName = state.currentFileName
    ? `${state.currentFileName.replace(/\.[^/.]+$/, "")}_切片專案`
    : "音訊切片專案";

  // 1. 若環境支援 File System Access API (本機 localhost 或 HTTPS)，優先呼叫系統原生「另存新檔」檔案總管視窗
  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `${defaultBaseName}.json`,
        types: [
          {
            description: "Audio Smart Splitter 工作檔 (*.json)",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
      });

      // 使用者在系統「另存新檔」視窗確認存檔後取得檔名
      const chosenFileName = fileHandle.name;
      const projectName = chosenFileName.replace(/(\.assp)?\.json$/i, "") || defaultBaseName;
      const projectData = buildProjectData(projectName);

      // 寫入使用者指定的本機檔案路徑
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(projectData, null, 2));
      await writable.close();

      // 同步備份至伺服器專案庫
      syncProjectToServer(projectData);

      setTemporaryHeaderStatus(`💾 已成功另存新檔：${chosenFileName}`, "success", 4000);
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        // 使用者點擊「取消」另存新檔
        return;
      }
      console.warn("showSaveFilePicker 不支援或處於跨網段 HTTP，切換至另存新檔對話框:", err);
    }
  }

  // 2. 跨網段 / 非本機 / HTTP 環境：開啟專屬「另存工作檔」對話框
  openSaveAsModal(defaultBaseName);
}

// 開啟跨網段/非本機另存新檔對話框
function openSaveAsModal(defaultName) {
  if (!dom.saveAsModal) return;
  dom.saveAsNameInput.value = defaultName;
  dom.saveAsModal.style.display = "flex";
  setTimeout(() => {
    dom.saveAsNameInput.focus();
    dom.saveAsNameInput.select();
  }, 100);
}

function closeSaveAsModal() {
  if (dom.saveAsModal) {
    dom.saveAsModal.style.display = "none";
  }
}

// 執行另存新檔並下載
async function executeSaveAsDownload() {
  const inputName = dom.saveAsNameInput.value.trim();
  const defaultBaseName = state.currentFileName
    ? `${state.currentFileName.replace(/\.[^/.]+$/, "")}_切片專案`
    : "音訊切片專案";
  const projectName = inputName || defaultBaseName;

  closeSaveAsModal();
  showLoading("另存工作檔", `正在另存工作檔「${projectName}」...`);

  const projectData = buildProjectData(projectName);

  // 1. 同步備份至伺服器
  await syncProjectToServer(projectData);

  // 2. 觸發本機下載
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  hideLoading();
  setTemporaryHeaderStatus(`💾 工作檔已另存至電腦：${projectName}.json`, "success", 4000);
}

// 同步工作檔至伺服器專案庫
async function syncProjectToServer(projectData) {
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectData),
    });
    if (res.ok) {
      const savedResult = await res.json();
      state.currentProjectId = savedResult.project_id;
      if (typeof fetchSavedProjects === "function") {
        await fetchSavedProjects(savedResult.project_id);
      }
    }
  } catch (e) {
    console.warn("同步至伺服器專案庫失敗:", e);
  }
}

// 載入工作檔 (專案檔) 資料
async function loadProjectData(projectData) {
  if (!projectData) return;

  showLoading("載入工作檔", `正在載入專案「${projectData.project_name || "未命名專案"}」...`);

  state.currentProjectId = projectData.project_id || null;

  // 1. 還原設定與表單
  if (projectData.settings) {
    const s = projectData.settings;
    if (s.target_duration) {
      dom.targetDurationSlider.value = s.target_duration;
      dom.targetDurationInput.value = s.target_duration;
      dom.targetDurationVal.textContent = s.target_duration;
    }
    if (s.custom_prefix !== undefined) {
      dom.customPrefix.value = s.custom_prefix;
    }
    if (s.export_format) {
      dom.exportFormat.value = s.export_format;
    }
    if (s.snap_gap !== undefined) {
      dom.snapGapToggle.checked = s.snap_gap;
    }
    if (s.zoom) {
      dom.zoomSlider.value = s.zoom;
    }
  }

  // 2. 還原斷句模式與歌詞文字
  if (projectData.detection) {
    const d = projectData.detection;
    if (d.mode) {
      dom.detectMode.value = d.mode;
      dom.detectMode.dispatchEvent(new Event("change"));
    }
    if (d.lyric_text) {
      dom.lyricTextInput.value = d.lyric_text;
    }
    if (d.saved_lyric_id && dom.savedLyricsSelect) {
      dom.savedLyricsSelect.value = d.saved_lyric_id;
    }
  }

  // 3. 還原斷句與切點
  state.sentences = Array.isArray(projectData.detection?.sentences) ? projectData.detection.sentences : [];
  state.cutPoints = Array.isArray(projectData.cut_points) ? projectData.cut_points : [];

  // 4. 檢查並還原音訊
  const audio = projectData.audio;
  let audioReachable = false;
  if (audio && audio.file_id) {
    try {
      const chk = await fetch(`/api/audio/${encodeURIComponent(audio.file_id)}`);
      if (chk.ok) audioReachable = true;
    } catch (e) {}
  }

  if (audioReachable) {
    state.pendingProjectRebind = null;
    applyAudioData(audio, true);
    setTemporaryHeaderStatus(`⚡ 工作檔已載入：${projectData.project_name || "專案"}`, "success", 4000);
  } else {
    // 伺服器無此音訊 (可能換電腦或檔案已刪除)
    hideLoading();
    state.pendingProjectRebind = projectData;

    dom.uploadTitle.textContent = `請選取原音訊以重新綁定：${audio?.filename || ""}`;
    dom.infoFilename.textContent = `${audio?.filename || "未知"} (待重新綁定音訊)`;
    dom.infoDuration.textContent = audio?.duration ? formatTime(audio.duration) : "--:--";
    dom.infoSentenceCount.textContent = `${state.sentences.length} 句 (已自專案載入)`;
    dom.infoCutCount.textContent = `${state.cutPoints.length} 處 (已自專案載入)`;
    dom.audioInfoBar.style.display = "flex";
    updateSegmentsTable();

    setTemporaryHeaderStatus(`⚠️ 工作檔已載入，請選取原音訊【${audio?.filename || "音訊"}】重新綁定波形`, "warning", 6000);
  }
}

// 刪除伺服器專案
async function deleteProjectWorkflow(projectId) {
  const proj = state.savedProjects.find((p) => p.project_id === projectId);
  const name = proj ? proj.project_name : "此工作檔";

  if (!confirm(`確定要刪除工作檔「${name}」嗎？\n刪除後伺服器將不再保留此專案。`)) return;

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "刪除專案失敗");
    }

    if (state.currentProjectId === projectId) {
      state.currentProjectId = null;
    }

    await fetchSavedProjects();
  } catch (err) {
    setTemporaryHeaderStatus(`❌ 刪除專案失敗: ${err.message}`, "danger", 4000);
  }
}

// 工作檔按鈕事件綁定
if (dom.saveProjectBtn) {
  dom.saveProjectBtn.addEventListener("click", () => {
    saveProjectWorkflow();
  });
}

if (dom.importProjectBtn) {
  dom.importProjectBtn.addEventListener("click", () => {
    dom.projectFileInput.click();
  });
}

if (dom.projectFileInput) {
  dom.projectFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const projectData = JSON.parse(evt.target.result);
        loadProjectData(projectData);
      } catch (err) {
        setTemporaryHeaderStatus(`❌ 專案檔格式錯誤: ${err.message}`, "danger", 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}

if (dom.savedProjectsSelect) {
  dom.savedProjectsSelect.addEventListener("change", async (e) => {
    const projId = e.target.value;
    if (dom.deleteProjectBtn) {
      dom.deleteProjectBtn.style.display = projId ? "inline-flex" : "none";
    }
    if (!projId) return;

    try {
      showLoading("載入專案", "正在從伺服器讀取工作檔資料...");
      const res = await fetch(`/api/projects/${encodeURIComponent(projId)}`);
      if (!res.ok) throw new Error("讀取專案失敗");
      const projectData = await res.json();
      loadProjectData(projectData);
    } catch (err) {
      hideLoading();
      alert(`載入專案失敗: ${err.message}`);
    }
  });
}

if (dom.deleteProjectBtn) {
  dom.deleteProjectBtn.addEventListener("click", () => {
    const projId = dom.savedProjectsSelect ? dom.savedProjectsSelect.value : null;
    if (projId) {
      deleteProjectWorkflow(projId);
    }
  });
}

// 另存新檔 Modal 事件綁定
if (dom.closeSaveAsModalBtn) {
  dom.closeSaveAsModalBtn.addEventListener("click", closeSaveAsModal);
}
if (dom.cancelSaveAsBtn) {
  dom.cancelSaveAsBtn.addEventListener("click", closeSaveAsModal);
}
if (dom.confirmSaveAsBtn) {
  dom.confirmSaveAsBtn.addEventListener("click", executeSaveAsDownload);
}
if (dom.saveAsNameInput) {
  dom.saveAsNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeSaveAsDownload();
    } else if (e.key === "Escape") {
      closeSaveAsModal();
    }
  });
}

// 頁面初始化載入
async function initApp() {
  await checkSystemCapabilities();
  await fetchUploadedFiles();
  await fetchSavedProjects();

  // 讀取暫存中已選取的字幕 ID (若有)
  let savedLyricId = null;
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      savedLyricId = parsed?.settings?.savedLyricId || null;
    }
  } catch (e) {}

  await fetchUploadedLyrics(savedLyricId);
  await restoreAppState();
}

initApp();
