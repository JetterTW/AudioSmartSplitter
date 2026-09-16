import os
import subprocess
import requests
import time
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_AUDIO = os.path.join(BASE_DIR, "test_speech_sample.mp3")

def generate_test_audio():
    """
    使用 ffmpeg 生成一段 60 秒的測試音訊，包含 3 段聲音和明確的靜音間隙：
    - 00:00 ~ 00:15: 聲音 (440Hz 正弦波)
    - 00:15 ~ 00:18: 靜音 (3 秒間隙，理想切點 ~16.5s)
    - 00:18 ~ 00:36: 聲音 (554Hz 正弦波)
    - 00:36 ~ 00:40: 靜音 (4 秒間隙，理想切點 ~38.0s)
    - 00:40 ~ 00:60: 聲音 (659Hz 正弦波)
    """
    print(">> [1/5] 正在生成測試音訊 (含有模擬歌詞句段與靜音間隙)...")
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=440:duration=15",
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo:d=3",
        "-f", "lavfi",
        "-i", "sine=frequency=554:duration=18",
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo:d=4",
        "-f", "lavfi",
        "-i", "sine=frequency=659:duration=20",
        "-filter_complex", "[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[outa]",
        "-map", "[outa]",
        "-b:a", "192k",
        TEST_AUDIO
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg generate failed: {res.stderr}")
    print(f"   測試音訊建立完成: {TEST_AUDIO} (時長 60 秒)")

def test_api():
    base_url = "http://127.0.0.1:8128"
    
    # 1. 測試上傳
    print("\n>> [2/5] 測試 API: 上傳 MP3 音訊...")
    with open(TEST_AUDIO, "rb") as f:
        r = requests.post(f"{base_url}/api/upload", files={"file": ("test_speech.mp3", f, "audio/mpeg")})
    assert r.status_code == 200, f"Upload failed: {r.text}"
    upload_res = r.json()
    file_id = upload_res["file_id"]
    duration = upload_res["duration"]
    print(f"   上傳成功! File ID: {file_id}, Duration: {duration}s")
    assert abs(duration - 60.0) < 1.0, f"Duration expected ~60s, got {duration}"

    # 2. 測試智慧分析 (VAD 模式，目標 20 秒)
    print("\n>> [3/5] 測試 API: 執行智慧分析 (避開歌詞句段，目標 20 秒)...")
    r = requests.post(f"{base_url}/api/analyze", data={
        "file_id": file_id,
        "target_duration": 20.0,
        "mode": "vad"
    })
    assert r.status_code == 200, f"Analyze failed: {r.text}"
    analyze_res = r.json()
    sentences = analyze_res["sentences"]
    cuts = analyze_res["cut_points"]
    print(f"   偵測到句子/人聲段數: {len(sentences)}")
    for s in sentences:
        print(f"     - 句子 #{s['id']}: {s['start']}s ~ {s['end']}s ({s['text']})")
    print(f"   演算法計算的切點: {cuts}")

    # 驗證切點約束：不能切到任何一個句子內部
    for c in cuts:
        for s in sentences:
            in_sentence = s["start"] < c < s["end"]
            assert not in_sentence, f"錯誤！切點 {c} 竟然落在了句子內部 [{s['start']}, {s['end']}]！"
    print("   [PASS] 成功驗證：所有切點皆嚴格落在句間空隙，絕無切斷任何歌詞！")

    # 測試 Whisper 模式 (或容錯 Fallback)
    print("\n>> 額外驗證：測試 Whisper AI 分析模式...")
    r_w = requests.post(f"{base_url}/api/analyze", data={
        "file_id": file_id,
        "target_duration": 20.0,
        "mode": "whisper"
    })
    assert r_w.status_code == 200, f"Whisper analyze failed: {r_w.text}"
    w_data = r_w.json()
    print(f"   [PASS] Whisper API 響應正常 (使用模式: {w_data['mode_used']}, 切點數: {len(w_data['cut_points'])})")

    # 3. 測試匯出 MP3
    print("\n>> [4/5] 測試 API: 批次匯出為 MP3 與 ZIP 打包...")
    r = requests.post(f"{base_url}/api/export", json={
        "file_id": file_id,
        "cut_points": cuts,
        "format": "mp3",
        "custom_name": "demo_song"
    })
    assert r.status_code == 200, f"Export MP3 failed: {r.text}"
    export_res = r.json()
    print(f"   匯出成功: 切成 {export_res['segment_count']} 個片段")
    zip_url = export_res["zip_download_url"]
    print(f"   ZIP 下載路徑: {zip_url}")

    # 4. 測試下載 ZIP
    print("\n>> [5/5] 測試 API: 下載並檢驗 ZIP 檔案...")
    r = requests.get(f"{base_url}{zip_url}")
    assert r.status_code == 200, f"Download zip failed: {r.status_code}"
    assert len(r.content) > 1000, "Zip file too small"
    print(f"   [PASS] ZIP 下載檢驗成功！大小: {len(r.content)} bytes")

    # 額外測試：WAV 與 M4A 格式匯出
    print("\n>> 額外驗證：測試 WAV 與 M4A 匯出...")
    for fmt in ["wav", "m4a"]:
        r = requests.post(f"{base_url}/api/export", json={
            "file_id": file_id,
            "cut_points": cuts,
            "format": fmt,
            "custom_name": f"demo_song_{fmt}"
        })
        assert r.status_code == 200, f"Export {fmt} failed"
        print(f"   [PASS] {fmt.upper()} 格式切片與匯出成功！")

    print("\n=======================================================")
    print("[SUCCESS] All integration tests passed! Audio import, sentence-aware cutting, MP3/WAV/M4A export all work perfectly!")
    print("=======================================================")

if __name__ == "__main__":
    generate_test_audio()
    test_api()
