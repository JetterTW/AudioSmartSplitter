from typing import List, Dict, Any

class SmartSplitter:
    @staticmethod
    def compute_cut_points(
        total_duration: float,
        sentences: List[Dict[str, Any]],
        target_duration: float = 20.0,
        min_segment_duration: float = 8.0
    ) -> List[float]:
        """
        計算智慧切點：
        - 嚴格保證切點不落在任何一句歌詞內部 [start, end]
        - 片段時長盡可能接近 target_duration (例如 20s)
        - 避免產生小於 min_segment_duration 的碎片
        """
        if total_duration <= target_duration:
            return []  # 總時長小於等於目標時長，不需切分

        # 若沒有偵測到任何句子，則退化為固定時間間隔
        if not sentences:
            cuts = []
            curr = target_duration
            while curr < total_duration:
                cuts.append(round(curr, 2))
                curr += target_duration
            return cuts

        # 整理所有可用的合法切刀空隙 (Gap Intervals: [gap_start, gap_end])
        # 空隙包括：
        # 1. 音訊開頭到第一句開始: [0, sentences[0]["start"]]
        # 2. 兩句之間: [sentences[i]["end"], sentences[i+1]["start"]]
        # 3. 最後一句結束到音訊結尾: [sentences[-1]["end"], total_duration]
        valid_gaps = []

        first_speech_start = sentences[0]["start"]
        if first_speech_start > 0.5:
            valid_gaps.append((0.0, first_speech_start))

        for i in range(len(sentences) - 1):
            s_curr_end = sentences[i]["end"]
            s_next_start = sentences[i + 1]["start"]
            
            # 確保區間合理 (即使語句有微小重疊也取交接點)
            if s_next_start >= s_curr_end:
                valid_gaps.append((s_curr_end, s_next_start))
            else:
                # 若模型輸出的兩句微幅重疊，取中點作為瞬時切縫
                mid = (s_curr_end + s_next_start) / 2.0
                valid_gaps.append((mid, mid))

        last_speech_end = sentences[-1]["end"]
        if total_duration > last_speech_end + 0.5:
            valid_gaps.append((last_speech_end, total_duration))

        # 提取每個候選空隙的最佳下刀點 (通常取空隙中心)
        candidate_cut_points = []
        for g_start, g_end in valid_gaps:
            center_point = (g_start + g_end) / 2.0
            if 0.5 < center_point < total_duration - 0.5:
                candidate_cut_points.append(round(center_point, 3))

        candidate_cut_points = sorted(list(set(candidate_cut_points)))
        if not candidate_cut_points:
            return []

        # 尋找最佳切點序列 (貪心法尋找與 target_duration 累計最接近的候選點)
        chosen_cuts = []
        last_cut = 0.0

        i = 0
        while i < len(candidate_cut_points):
            best_candidate = None
            best_diff = float("inf")
            best_idx = -1

            # 評估從 last_cut 出發，哪個候選點的長度最接近 target_duration
            for j in range(i, len(candidate_cut_points)):
                c = candidate_cut_points[j]
                seg_len = c - last_cut

                # 若這點太短，繼續往後看
                if seg_len < min_segment_duration:
                    continue

                diff = abs(seg_len - target_duration)
                if diff < best_diff:
                    best_diff = diff
                    best_candidate = c
                    best_idx = j
                elif seg_len > target_duration and diff > best_diff:
                    # 已經越過最佳接近點，且誤差變大，可以停止搜尋下一個候選點
                    break

            if best_candidate is not None:
                # 檢查若在此切斷，剩下的長度是否會少於最小限制
                remaining_len = total_duration - best_candidate
                if remaining_len < min_segment_duration:
                    # 若剩下太少，不再增加切點，併入最後一段
                    break

                chosen_cuts.append(best_candidate)
                last_cut = best_candidate
                i = best_idx + 1
            else:
                # 找不到合適候選點，取下一個或跳出
                i += 1

        return chosen_cuts
