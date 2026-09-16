import os
import subprocess
import json
import zipfile
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    from utils import get_ffmpeg_paths
except ImportError:
    from backend.utils import get_ffmpeg_paths

class AudioProcessor:
    def __init__(self, ffmpeg_path: Optional[str] = None, ffprobe_path: Optional[str] = None):
        auto_ffmpeg, auto_ffprobe = get_ffmpeg_paths()
        self.ffmpeg_path = ffmpeg_path or auto_ffmpeg
        self.ffprobe_path = ffprobe_path or auto_ffprobe

    def get_audio_info(self, file_path: str) -> Dict[str, Any]:
        """使用 ffprobe 取得音訊時長、格式、採樣率等詳細資訊"""
        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if result.returncode != 0:
            raise RuntimeError(f"FFprobe error: {result.stderr}")
        
        data = json.loads(result.stdout)
        format_info = data.get("format", {})
        streams = data.get("streams", [])
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), {})
        
        duration = float(format_info.get("duration", 0.0) or audio_stream.get("duration", 0.0))
        sample_rate = int(audio_stream.get("sample_rate", 44100))
        channels = int(audio_stream.get("channels", 2))
        codec_name = audio_stream.get("codec_name", "")
        
        return {
            "duration": duration,
            "sample_rate": sample_rate,
            "channels": channels,
            "codec": codec_name,
            "bit_rate": format_info.get("bit_rate"),
            "filename": os.path.basename(file_path),
            "size_bytes": int(format_info.get("size", 0))
        }

    def convert_to_wav(self, input_path: str, output_path: str, sample_rate: int = 16000) -> str:
        """轉換為單聲道 16kHz WAV 供 ASR / VAD 語音分析使用"""
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_path,
            "-ar", str(sample_rate),
            "-ac", "1",
            "-vn",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Convert to WAV failed: {result.stderr}")
        return output_path

    @staticmethod
    def format_time_tag(seconds: float) -> str:
        """將秒數格式化為 mmss.ss，例如 0.0 秒 -> 0000.00，19.83 秒 -> 0019.83"""
        m = int(seconds // 60)
        s = seconds % 60
        return f"{m:02d}{s:05.2f}"

    def split_audio(
        self,
        input_path: str,
        cut_points: List[float],
        output_dir: str,
        output_format: str = "mp3",
        base_name: str = "segment"
    ) -> List[Dict[str, Any]]:
        """
        根據切點清單將音訊檔精確切片並儲存至 output_dir
        檔名格式範例: L.Y.A.-閃耀舞台-Mastering_part_01-0000.00-0019.83(19.84).m4a
        """
        os.makedirs(output_dir, exist_ok=True)
        info = self.get_audio_info(input_path)
        total_duration = info["duration"]

        if base_name == "segment":
            base_name = Path(input_path).stem

        # 將 0 與總長度加入切點，並去重排序
        points = sorted(list(set([0.0] + [p for p in cut_points if 0.0 < p < total_duration] + [total_duration])))
        
        # 建立片段區間 [(start, end), ...]
        segments = []
        for i in range(len(points) - 1):
            start = points[i]
            end = points[i + 1]
            if end - start > 0.05:  # 忽略過短切片
                segments.append((start, end))

        output_format = output_format.lower().strip()
        if output_format not in ["mp3", "wav", "m4a"]:
            output_format = "mp3"

        # 設定轉碼參數
        codec_args = []
        if output_format == "mp3":
            codec_args = ["-c:a", "libmp3lame", "-b:a", "320k"]
        elif output_format == "wav":
            codec_args = ["-c:a", "pcm_s16le"]
        elif output_format == "m4a":
            codec_args = ["-c:a", "aac", "-b:a", "256k"]

        exported_files = []
        for idx, (start, end) in enumerate(segments, start=1):
            dur = end - start
            time_tag = f"-{self.format_time_tag(start)}-{self.format_time_tag(end)}({dur:.2f})"
            out_filename = f"{base_name}_part_{idx:02d}{time_tag}.{output_format}"
            out_filepath = os.path.join(output_dir, out_filename)

            # ffmpeg 精確切片：使用 -ss 與 -to
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-ss", f"{start:.3f}",
                "-to", f"{end:.3f}",
                "-i", input_path,
                "-vn",
            ] + codec_args + [out_filepath]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                # 備用容錯指令
                cmd = [
                    self.ffmpeg_path,
                    "-y",
                    "-i", input_path,
                    "-ss", f"{start:.3f}",
                    "-to", f"{end:.3f}",
                    "-vn",
                ] + codec_args + [out_filepath]
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    raise RuntimeError(f"Failed to export segment {idx}: {result.stderr}")

            exported_files.append({
                "index": idx,
                "filename": out_filename,
                "filepath": out_filepath,
                "start": round(start, 3),
                "end": round(end, 3),
                "duration": round(dur, 3),
                "size_bytes": os.path.getsize(out_filepath) if os.path.exists(out_filepath) else 0
            })

        return exported_files

    def create_zip(self, files: List[Dict[str, Any]], zip_path: str) -> str:
        """將切片好的檔案打包成 ZIP 壓縮檔"""
        os.makedirs(os.path.dirname(zip_path), exist_ok=True)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for item in files:
                fpath = item["filepath"]
                fname = item["filename"]
                if os.path.exists(fpath):
                    zipf.write(fpath, arcname=fname)
        return zip_path
