import os
import re
import subprocess
import json
from typing import List, Dict, Any, Optional

try:
    from utils import get_ffmpeg_paths
except ImportError:
    from backend.utils import get_ffmpeg_paths

class SentenceDetector:
    def __init__(self, ffmpeg_path: Optional[str] = None):
        auto_ffmpeg, _ = get_ffmpeg_paths()
        self.ffmpeg_path = ffmpeg_path or auto_ffmpeg
        self._whisper_model = None

    def detect_sentences_vad(
        self,
        audio_path: str,
        total_duration: float,
        noise_db: float = -30.0,
        min_silence_duration: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        使用 FFmpeg silencedetect 分析人聲段落與靜音間隙 (VAD 模式)
        noise_db: 判定為靜音的音量閥值 (預設 -30dB)
        min_silence_duration: 最小靜音持續秒數 (預設 0.3 秒視為句子間隔)
        """
        cmd = [
            self.ffmpeg_path,
            "-i", audio_path,
            "-af", f"silencedetect=noise={noise_db}dB:d={min_silence_duration}",
            "-f", "null",
            "-"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        
        # 解析 FFmpeg 的 silencedetect 輸出
        # 例如:
        # [silence_detect @ 0x...] silence_start: 4.821
        # [silence_detect @ 0x...] silence_end: 5.612 | silence_duration: 0.791
        silence_intervals = []
        silence_start = None
        for line in result.stderr.splitlines():
            if "silence_start:" in line:
                m = re.search(r"silence_start:\s*([0-9.]+)", line)
                if m:
                    silence_start = float(m.group(1))
            elif "silence_end:" in line and silence_start is not None:
                m = re.search(r"silence_end:\s*([0-9.]+)", line)
                if m:
                    silence_end = float(m.group(1))
                    silence_intervals.append((silence_start, silence_end))
                    silence_start = None

        if silence_start is not None and silence_start < total_duration:
            silence_intervals.append((silence_start, total_duration))

        # 根據靜音區間反推語音/歌詞句子區間
        sentences = []
        last_end = 0.0
        idx = 1
        for s_start, s_end in silence_intervals:
            if s_start > last_end + 0.1:  # 語音段長度大於 0.1 秒
                sentences.append({
                    "id": idx,
                    "start": round(last_end, 3),
                    "end": round(s_start, 3),
                    "text": f"語句/歌詞段落 #{idx}",
                    "type": "speech"
                })
                idx += 1
            last_end = s_end

        if total_duration > last_end + 0.1:
            sentences.append({
                "id": idx,
                "start": round(last_end, 3),
                "end": round(total_duration, 3),
                "text": f"語句/歌詞段落 #{idx}",
                "type": "speech"
            })

        # 若完全未偵測到靜音（背景伴奏極大），以動態能量做更寬鬆偵測或備援
        if not sentences and total_duration > 0:
            sentences.append({
                "id": 1,
                "start": 0.0,
                "end": round(total_duration, 3),
                "text": "完整音訊",
                "type": "speech"
            })

        return sentences

    def parse_lrc(self, lrc_content: str, total_duration: float) -> List[Dict[str, Any]]:
        """解析 LRC 歌詞檔案並產生句子起訖時間"""
        lines = lrc_content.strip().splitlines()
        parsed_lrc = []
        time_regex = re.compile(r"\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)")

        for line in lines:
            m = time_regex.match(line.strip())
            if m:
                mins = int(m.group(1))
                secs = float(m.group(2))
                timestamp = mins * 60 + secs
                lyric = m.group(3).strip()
                if lyric:  # 忽略空行
                    parsed_lrc.append((timestamp, lyric))

        parsed_lrc.sort(key=lambda x: x[0])
        sentences = []
        for i in range(len(parsed_lrc)):
            start_time = parsed_lrc[i][0]
            text = parsed_lrc[i][1]
            if i + 1 < len(parsed_lrc):
                next_time = parsed_lrc[i + 1][0]
                # 假設每句結束於下一句開始前 0.2 秒或最大 8 秒
                end_time = min(next_time, start_time + 8.0)
            else:
                end_time = min(total_duration, start_time + 6.0)

            sentences.append({
                "id": i + 1,
                "start": round(start_time, 3),
                "end": round(end_time, 3),
                "text": text,
                "type": "lyric"
            })
        return sentences

    def parse_srt(self, srt_content: str, total_duration: float) -> List[Dict[str, Any]]:
        """解析 SRT 字幕/歌詞檔案並產生精確句子起訖時間"""
        time_pattern = re.compile(
            r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})"
        )
        blocks = re.split(r"\r?\n\r?\n", srt_content.strip())
        sentences = []
        idx = 1

        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            time_line = None
            text_lines = []
            for line in lines:
                if "-->" in line and time_pattern.search(line):
                    time_line = line
                elif time_line:
                    text_lines.append(line)

            if time_line:
                m = time_pattern.search(time_line)
                if m:
                    h1, m1, s1, ms1 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4).ljust(3, '0')[:3])
                    h2, m2, s2, ms2 = int(m.group(5)), int(m.group(6)), int(m.group(7)), int(m.group(8).ljust(3, '0')[:3])

                    start_sec = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000.0
                    end_sec = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000.0

                    if end_sec > start_sec:
                        sentences.append({
                            "id": idx,
                            "start": round(start_sec, 3),
                            "end": round(min(end_sec, total_duration), 3),
                            "text": " ".join(text_lines) or f"字幕 #{idx}",
                            "type": "srt"
                        })
                        idx += 1

        sentences.sort(key=lambda x: x["start"])
        return sentences

    def detect_sentences_whisper(
        self,
        audio_path: str,
        model_size: str = "base"
    ) -> List[Dict[str, Any]]:
        """使用 Whisper AI 辨識語句與時間戳記"""
        try:
            import whisper
        except ImportError:
            raise RuntimeError("尚未安裝 whisper 套件 (No module named 'whisper')")

        try:
            if self._whisper_model is None:
                # 優先使用 tiny 或 base 模型以確保極速響應
                self._whisper_model = whisper.load_model(model_size)
            
            result = self._whisper_model.transcribe(audio_path, task="transcribe")
            sentences = []
            for idx, seg in enumerate(result.get("segments", []), start=1):
                sentences.append({
                    "id": idx,
                    "start": round(seg["start"], 3),
                    "end": round(seg["end"], 3),
                    "text": seg["text"].strip(),
                    "type": "whisper"
                })
            return sentences
        except Exception as e:
            raise RuntimeError(f"Whisper 模型執行失敗: {str(e)}")
