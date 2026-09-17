import os
import sys
import uuid
import shutil
import json
import datetime
from typing import List, Optional

# 專案路徑設定
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from audio_processor import AudioProcessor
from sentence_detector import SentenceDetector
from splitter_algo import SmartSplitter

if getattr(sys, "frozen", False):
    BUNDLE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.executable)))
    EXE_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    BUNDLE_DIR = os.path.dirname(BASE_DIR)
    EXE_DIR = BUNDLE_DIR

UPLOAD_DIR = os.path.join(EXE_DIR, "uploads")
LYRICS_DIR = os.path.join(UPLOAD_DIR, "lyrics")
PROJECTS_DIR = os.path.join(EXE_DIR, "projects")
OUTPUT_DIR = os.path.join(EXE_DIR, "outputs")

# 優先讀取 EXE 同目錄下的 frontend (若有)，否則讀取內置 bundle
external_frontend = os.path.join(EXE_DIR, "frontend")
if os.path.isdir(external_frontend):
    FRONTEND_DIR = external_frontend
else:
    FRONTEND_DIR = os.path.join(BUNDLE_DIR, "frontend")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(LYRICS_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI(title="Audio AI Smart Splitter API", version="1.1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = AudioProcessor()
detector = SentenceDetector()

# 儲存進行中或已分析的音訊資料結構快取
# session_id -> {filepath, info, sentences, cuts}
session_store = {}

def find_and_restore_session(file_id: str):
    """自快取或磁碟 UPLOAD_DIR 還原 session 狀態"""
    if file_id in session_store:
        return session_store[file_id]

    if not os.path.exists(UPLOAD_DIR):
        return None

    for fname in os.listdir(UPLOAD_DIR):
        fpath = os.path.join(UPLOAD_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        if fname.startswith(f"{file_id}_"):
            orig_name = fname[len(file_id) + 1:]
            try:
                info = processor.get_audio_info(fpath)
                session_store[file_id] = {
                    "filepath": fpath,
                    "filename": orig_name,
                    "base_name": os.path.splitext(orig_name)[0],
                    "info": info,
                    "sentences": [],
                    "cuts": []
                }
                return session_store[file_id]
            except Exception:
                pass
        elif fname == file_id:
            try:
                info = processor.get_audio_info(fpath)
                session_store[file_id] = {
                    "filepath": fpath,
                    "filename": fname,
                    "base_name": os.path.splitext(fname)[0],
                    "info": info,
                    "sentences": [],
                    "cuts": []
                }
                return session_store[file_id]
            except Exception:
                pass
    return None

class RecalculateRequest(BaseModel):
    file_id: str
    target_duration: float = 20.0
    min_segment_duration: float = 6.0

class ExportRequest(BaseModel):
    file_id: str
    cut_points: List[float]
    format: str = "mp3"  # mp3, wav, m4a
    custom_name: Optional[str] = None
    export_srt: bool = False
    sentences: Optional[List[dict]] = None
    single_segment_index: Optional[int] = None

@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """上傳音訊檔案並讀取中繼資料"""
    valid_extensions = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".wma"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的檔案格式：{ext}。請上傳 MP3, WAV 或 M4A 檔案。"
        )

    orig_filename = file.filename
    try:
        orig_filename = orig_filename.encode('latin-1').decode('utf-8')
    except Exception:
        pass

    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}_{orig_filename}"
    saved_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        info = processor.get_audio_info(saved_path)
    except Exception as e:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(status_code=500, detail=f"讀取音訊中繼資料失敗：{str(e)}")

    session_store[file_id] = {
        "filepath": saved_path,
        "filename": orig_filename,
        "base_name": os.path.splitext(orig_filename)[0],
        "info": info,
        "sentences": [],
        "cuts": []
    }

    return {
        "file_id": file_id,
        "filename": orig_filename,
        "duration": info["duration"],
        "sample_rate": info["sample_rate"],
        "channels": info["channels"],
        "format": info["codec"],
        "size_bytes": info["size_bytes"],
        "audio_url": f"/api/audio/{file_id}"
    }

@app.get("/api/uploads")
async def list_uploads():
    """列出所有已上傳的音訊檔案"""
    import datetime
    if not os.path.exists(UPLOAD_DIR):
        return []

    files = []
    for fname in os.listdir(UPLOAD_DIR):
        fpath = os.path.join(UPLOAD_DIR, fname)
        if not os.path.isfile(fpath):
            continue

        if "_" in fname:
            file_id, orig_name = fname.split("_", 1)
        else:
            file_id = fname
            orig_name = fname

        # 取得音訊資訊
        if file_id in session_store:
            info = session_store[file_id]["info"]
        else:
            try:
                info = processor.get_audio_info(fpath)
                session_store[file_id] = {
                    "filepath": fpath,
                    "filename": orig_name,
                    "base_name": os.path.splitext(orig_name)[0],
                    "info": info,
                    "sentences": [],
                    "cuts": []
                }
            except Exception:
                continue

        stat = os.stat(fpath)
        upload_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

        files.append({
            "file_id": file_id,
            "filename": orig_name,
            "duration": info["duration"],
            "sample_rate": info["sample_rate"],
            "channels": info["channels"],
            "format": info["codec"],
            "size_bytes": info["size_bytes"],
            "upload_time": upload_time,
            "mtime": stat.st_mtime,
            "audio_url": f"/api/audio/{file_id}"
        })

    files.sort(key=lambda x: x["mtime"], reverse=True)
    return files

@app.delete("/api/uploads/{file_id}")
async def delete_uploaded_audio(file_id: str):
    """刪除指定已上傳的音訊檔案"""
    found = False
    if file_id in session_store:
        fpath = session_store[file_id]["filepath"]
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"刪除檔案失敗: {str(e)}")
        del session_store[file_id]
        found = True

    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            if fname.startswith(f"{file_id}_") or fname == file_id:
                try:
                    os.remove(os.path.join(UPLOAD_DIR, fname))
                    found = True
                except Exception:
                    pass

    if not found:
        raise HTTPException(status_code=404, detail="找不到欲刪除的檔案")

    return {"message": "檔案已成功刪除", "file_id": file_id}

@app.post("/api/upload_lyric")
async def upload_lyric(file: UploadFile = File(...)):
    """上傳 SRT 或 LRC 字幕/歌詞檔案"""
    import datetime
    valid_extensions = [".srt", ".lrc", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的字幕檔案格式：{ext}。請上傳 .srt, .lrc 或 .txt 檔案。"
        )

    orig_filename = file.filename
    try:
        orig_filename = orig_filename.encode('latin-1').decode('utf-8')
    except Exception:
        pass

    content_bytes = await file.read()
    # 自動嘗試編碼解碼
    content = ""
    for enc in ["utf-8-sig", "utf-8", "cp950", "gb18030", "latin-1"]:
        try:
            content = content_bytes.decode(enc)
            break
        except Exception:
            continue

    lyric_id = str(uuid.uuid4())
    saved_filename = f"{lyric_id}_{orig_filename}"
    saved_path = os.path.join(LYRICS_DIR, saved_filename)

    with open(saved_path, "w", encoding="utf-8") as f:
        f.write(content)

    stat = os.stat(saved_path)
    upload_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

    return {
        "id": lyric_id,
        "filename": orig_filename,
        "format": ext.replace(".", ""),
        "size_bytes": len(content_bytes),
        "upload_time": upload_time,
        "content": content
    }

@app.get("/api/lyrics")
async def list_lyrics():
    """列出所有已上傳的字幕/歌詞檔案"""
    import datetime
    if not os.path.exists(LYRICS_DIR):
        return []

    lyrics = []
    for fname in os.listdir(LYRICS_DIR):
        fpath = os.path.join(LYRICS_DIR, fname)
        if not os.path.isfile(fpath):
            continue

        if "_" in fname:
            lyric_id, orig_name = fname.split("_", 1)
        else:
            lyric_id = fname
            orig_name = fname

        ext = os.path.splitext(orig_name)[1].lower().replace(".", "")
        stat = os.stat(fpath)
        upload_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            content = ""

        lyrics.append({
            "id": lyric_id,
            "filename": orig_name,
            "format": ext,
            "size_bytes": stat.st_size,
            "upload_time": upload_time,
            "mtime": stat.st_mtime,
            "content": content
        })

    lyrics.sort(key=lambda x: x["mtime"], reverse=True)
    return lyrics

@app.delete("/api/lyrics/{lyric_id}")
async def delete_lyric(lyric_id: str):
    """刪除指定已上傳的字幕/歌詞檔案"""
    found = False
    if os.path.exists(LYRICS_DIR):
        for fname in os.listdir(LYRICS_DIR):
            if fname.startswith(f"{lyric_id}_") or fname == lyric_id:
                try:
                    os.remove(os.path.join(LYRICS_DIR, fname))
                    found = True
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"刪除檔案失敗: {str(e)}")

    if not found:
        raise HTTPException(status_code=404, detail="找不到欲刪除的字幕檔案")

    return {"message": "字幕檔案已成功刪除", "id": lyric_id}

class SaveProjectRequest(BaseModel):
    project_id: Optional[str] = None
    project_name: str
    audio: dict
    detection: dict
    cut_points: list
    settings: dict

@app.post("/api/projects")
async def save_project(req: SaveProjectRequest):
    """儲存工作檔 (專案檔)"""
    project_id = req.project_id or str(uuid.uuid4())
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 檔名安全性處理
    safe_name = "".join(c for c in req.project_name if c not in r'\/:*?"<>|').strip() or "project"
    target_fname = f"{project_id}_{safe_name}.json"
    target_path = os.path.join(PROJECTS_DIR, target_fname)

    # 若有舊檔名不同但相同 id，先刪除以覆蓋
    if os.path.exists(PROJECTS_DIR):
        for fname in os.listdir(PROJECTS_DIR):
            if fname.startswith(f"{project_id}_") or fname == f"{project_id}.json":
                try:
                    os.remove(os.path.join(PROJECTS_DIR, fname))
                except Exception:
                    pass

    data = {
        "project_id": project_id,
        "project_name": req.project_name,
        "project_version": "1.1.2",
        "updated_at": now_str,
        "audio": req.audio,
        "detection": req.detection,
        "cut_points": req.cut_points,
        "settings": req.settings
    }

    try:
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"寫入專案檔失敗: {str(e)}")

    return {
        "project_id": project_id,
        "project_name": req.project_name,
        "updated_at": now_str,
        "message": "專案工作檔已成功儲存",
        "project_data": data
    }

@app.get("/api/projects")
async def list_projects():
    """取得所有已儲存工作檔清單"""
    if not os.path.exists(PROJECTS_DIR):
        return []

    projects = []
    for fname in os.listdir(PROJECTS_DIR):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(PROJECTS_DIR, fname)
        if not os.path.isfile(fpath):
            continue

        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            stat = os.stat(fpath)
            projects.append({
                "project_id": data.get("project_id", fname.split("_")[0]),
                "project_name": data.get("project_name", fname[:-5]),
                "audio_filename": data.get("audio", {}).get("filename", ""),
                "audio_duration": data.get("audio", {}).get("duration", 0),
                "cuts_count": len(data.get("cut_points", [])),
                "sentences_count": len(data.get("detection", {}).get("sentences", [])),
                "updated_at": data.get("updated_at") or datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "mtime": stat.st_mtime,
                "size_bytes": stat.st_size
            })
        except Exception:
            continue

    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return projects

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """讀取單一工作檔之完整資料"""
    if not os.path.exists(PROJECTS_DIR):
        raise HTTPException(status_code=404, detail="找不到專案檔案")

    for fname in os.listdir(PROJECTS_DIR):
        if fname.startswith(f"{project_id}_") or fname == f"{project_id}.json":
            fpath = os.path.join(PROJECTS_DIR, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"讀取專案檔失敗: {str(e)}")

    raise HTTPException(status_code=404, detail="找不到指定的專案檔案")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """刪除指定工作檔"""
    found = False
    if os.path.exists(PROJECTS_DIR):
        for fname in os.listdir(PROJECTS_DIR):
            if fname.startswith(f"{project_id}_") or fname == f"{project_id}.json":
                try:
                    os.remove(os.path.join(PROJECTS_DIR, fname))
                    found = True
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"刪除專案檔失敗: {str(e)}")

    if not found:
        raise HTTPException(status_code=404, detail="找不到欲刪除的專案檔案")

    return {"message": "專案檔已成功刪除", "project_id": project_id}

@app.get("/api/system_info")
async def get_system_info():
    """檢查伺服器支援的分析能力"""
    whisper_ready = False
    try:
        import whisper
        whisper_ready = True
    except ImportError:
        whisper_ready = False
    
    return {
        "whisper_ready": whisper_ready,
        "default_mode": "vad"
    }

@app.post("/api/analyze")
async def analyze_audio(
    file_id: str = Form(...),
    target_duration: float = Form(20.0),
    mode: str = Form("vad"),  # "vad", "whisper", "lrc", "srt"
    lrc_text: Optional[str] = Form(None),
    srt_text: Optional[str] = Form(None)
):
    """執行歌詞/人聲斷句偵測與智慧切點計算"""
    session = find_and_restore_session(file_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定的音訊資料")

    filepath = session["filepath"]
    duration = session["info"]["duration"]

    sentences = []
    notice = None
    actual_mode = mode

    # 模式選擇
    if mode == "srt" and srt_text and srt_text.strip():
        sentences = detector.parse_srt(srt_text, duration)
    elif mode == "lrc" and lrc_text and lrc_text.strip():
        sentences = detector.parse_lrc(lrc_text, duration)
    elif mode == "whisper":
        try:
            sentences = detector.detect_sentences_whisper(filepath)
        except Exception as e:
            # Whisper 不可用或未安裝時，平滑 fallback 到快速 VAD
            actual_mode = "vad"
            notice = f"Whisper 模組未安裝或載入失敗（{str(e)}），已自動切換為「快速人聲靜音避詞模式 (VAD)」，切點已成功產生！"
            sentences = detector.detect_sentences_vad(filepath, duration)
    else:
        sentences = detector.detect_sentences_vad(filepath, duration)

    # 執行智慧切點尋優算法
    cuts = SmartSplitter.compute_cut_points(
        total_duration=duration,
        sentences=sentences,
        target_duration=target_duration
    )

    session["sentences"] = sentences
    session["cuts"] = cuts

    return {
        "file_id": file_id,
        "duration": duration,
        "sentences": sentences,
        "cut_points": cuts,
        "mode_used": actual_mode,
        "notice": notice
    }

@app.post("/api/recalculate")
async def recalculate_cuts(req: RecalculateRequest):
    """使用者調整秒數時，重新根據現有句子邊界計算切點"""
    session = find_and_restore_session(req.file_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定的音訊資料")

    duration = session["info"]["duration"]
    sentences = session.get("sentences", [])

    cuts = SmartSplitter.compute_cut_points(
        total_duration=duration,
        sentences=sentences,
        target_duration=req.target_duration,
        min_segment_duration=req.min_segment_duration
    )
    session["cuts"] = cuts

    return {
        "file_id": req.file_id,
        "cut_points": cuts
    }

@app.post("/api/export")
async def export_audio(req: ExportRequest):
    """根據使用者最終確認的切點批次匯出音訊並打包 ZIP，或單獨匯出指定片段（可選附帶相對時間 SRT）"""
    session = find_and_restore_session(req.file_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定的音訊資料")

    filepath = session["filepath"]
    base_name = req.custom_name.strip() if req.custom_name else session["base_name"]

    export_session_id = str(uuid.uuid4())[:8]
    task_output_dir = os.path.join(OUTPUT_DIR, f"export_{export_session_id}")
    
    # 句子資訊：若前端有傳入則優先使用前端傳入的 sentences，否則使用 session["sentences"]
    sentences = req.sentences if req.sentences is not None else session.get("sentences", [])

    try:
        segments = processor.split_audio(
            input_path=filepath,
            cut_points=req.cut_points,
            output_dir=task_output_dir,
            output_format=req.format,
            base_name=base_name,
            export_srt=req.export_srt,
            sentences=sentences,
            single_segment_index=req.single_segment_index
        )

        # 判斷是否為單片段直接下載（未勾選 SRT）
        if req.single_segment_index is not None and not req.export_srt:
            if not segments:
                raise HTTPException(status_code=400, detail="指定的片段索引無效或切片失敗")
            seg = segments[0]
            dest_filename = f"{export_session_id}_{seg['filename']}"
            dest_filepath = os.path.join(OUTPUT_DIR, dest_filename)
            import shutil
            shutil.copy2(seg["filepath"], dest_filepath)

            return {
                "message": f"成功匯出片段 {seg['index']}",
                "segment_count": 1,
                "format": req.format.upper(),
                "segments": segments,
                "download_url": f"/api/download/{dest_filename}",
                "zip_download_url": f"/api/download/{dest_filename}",
                "is_single_file": True
            }

        # 批次匯出 或 單片段+SRT：打包成 ZIP
        if req.single_segment_index is not None:
            seg = segments[0]
            zip_filename = f"{os.path.splitext(seg['filename'])[0]}.zip"
        else:
            zip_filename = f"{base_name}_cut_segments_{req.format.lower()}.zip"

        zip_filepath = os.path.join(OUTPUT_DIR, f"{export_session_id}_{zip_filename}")
        processor.create_zip(segments, zip_filepath)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"切片匯出失敗: {str(e)}")

    return {
        "message": f"成功切成 {len(segments)} 個片段",
        "segment_count": len(segments),
        "format": req.format.upper(),
        "segments": segments,
        "zip_download_url": f"/api/download/{export_session_id}_{zip_filename}",
        "download_url": f"/api/download/{export_session_id}_{zip_filename}",
        "is_single_file": False
    }

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """下載打包的 ZIP 檔案或單一音訊檔案"""
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="找不到下載檔案")

    ext = os.path.splitext(filename)[1].lower()
    media_type = "application/octet-stream"
    if ext == ".zip":
        media_type = "application/zip"
    elif ext == ".mp3":
        media_type = "audio/mpeg"
    elif ext == ".wav":
        media_type = "audio/wav"
    elif ext in [".m4a", ".aac"]:
        media_type = "audio/mp4"

    orig_download_name = filename.split("_", 1)[-1] if "_" in filename else filename
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=orig_download_name
    )

@app.api_route("/api/audio/{file_id}", methods=["GET", "HEAD"])
async def get_audio_stream(file_id: str):
    """串流音訊檔給前端 WaveSurfer 播放器 (支援 GET 與 HEAD)"""
    session = find_and_restore_session(file_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定的音訊")
    
    filepath = session["filepath"]
    ext = os.path.splitext(filepath)[1].lower()
    media_type = "audio/mpeg"
    if ext == ".wav":
        media_type = "audio/wav"
    elif ext in [".m4a", ".aac"]:
        media_type = "audio/mp4"

    return FileResponse(filepath, media_type=media_type)

# 掛載前端靜態頁面
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8128)
