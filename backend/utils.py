import os
import sys
import shutil

def get_ffmpeg_paths():
    """尋找 ffmpeg 與 ffprobe 的最佳可執行路徑 (相容可攜版打包與原始碼模式)"""
    candidate_dirs = []

    # 1. PyInstaller 打包時的暫存解壓目錄
    if hasattr(sys, "_MEIPASS"):
        candidate_dirs.append(os.path.join(sys._MEIPASS, "bin"))
        candidate_dirs.append(sys._MEIPASS)

    # 2. 獨立 EXE 檔案所在的目錄
    exe_dir = os.path.dirname(os.path.abspath(sys.executable))
    candidate_dirs.append(os.path.join(exe_dir, "bin"))
    candidate_dirs.append(exe_dir)

    # 3. 專案根目錄的 bin
    current_file_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_file_dir)
    candidate_dirs.append(os.path.join(project_root, "bin"))

    ffmpeg_path = None
    ffprobe_path = None

    for d in candidate_dirs:
        for name in ["ffmpeg", "ffmpeg.exe"]:
            ff = os.path.join(d, name)
            if os.path.isfile(ff) and not ffmpeg_path:
                ffmpeg_path = ff
        for name in ["ffprobe", "ffprobe.exe"]:
            fp = os.path.join(d, name)
            if os.path.isfile(fp) and not ffprobe_path:
                ffprobe_path = fp

    # 若未在本地目錄找到，使用系統 PATH
    if not ffmpeg_path:
        ffmpeg_path = shutil.which("ffmpeg") or "ffmpeg"
    if not ffprobe_path:
        ffprobe_path = shutil.which("ffprobe") or "ffprobe"

    return ffmpeg_path, ffprobe_path
