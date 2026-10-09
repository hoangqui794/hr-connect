# Kế hoạch GitNexus: cải thiện độ chính xác chấm điểm AI (6 mục)

## Vấn đề

1. `paraphrase-multilingual-MiniLM-L12-v2` chỉ đọc 128 token; `calculate_similarity` ghép cả CV thành một chuỗi nên CV dài bị cắt,
   điểm ngữ nghĩa chỉ phản ánh phần đầu CV.
2. Chưa có bộ dữ liệu có nhãn của HR để đo AI sai bao nhiêu.
3. Yêu cầu mềm (`OTHER`) bị chấm quá khắt khe: chỉ nhận đúng vài cách diễn đạt viết cứng trong code.
4. So khớp đoạn CV với yêu cầu bằng bi-encoder kém chính xác với câu mơ hồ.
5. Trọng số 0,50/0,20/0,30 là thử nghiệm, chưa hiệu chỉnh bằng dữ liệu.
6. Không có vòng phản hồi so điểm AI với quyết định thật của HR.

## Phân tích GitNexus (impact, upstream)

| Symbol | Risk | Ghi chú |
|---|---|---|
| `SemanticMatcher.calculate_similarity` | UNKNOWN (102 qua lớp) | Text search: chỉ `MatchingService.match`, `tools/benchmark_embedding_models.py`, test. |
| `retrieve_evidence` | UNKNOWN | Chỉ `MatchingService.match` và 1 test. |
| `evaluate_clauses`, `_find_evidence` | CRITICAL (135) | Caller thật duy nhất: `RequirementMatcher.match`. Phần lớn 135 là file React bị index nối nhầm. Vẫn coi là rủi ro cao vì mọi điểm đi qua đây. |
| `MatchingService` | LOW (7) | Dùng bởi `/match`, `/match-file`, worker chấm điểm. |
| `ScoreCalculator` | LOW (7) | Không đổi công thức; chỉ hiệu chỉnh trọng số qua cấu hình. |

Mọi thay đổi đổi điểm số trả về backend → cần chạy lại toàn bộ test và bộ đánh giá trước khi commit.

## Thiết kế

1. **Chấm theo đoạn** (`semantic_matcher.py`): tách CV thành đoạn ≤ ~350 ký tự từ `evidence_spans`; tách JD thành tiêu đề+mô tả và
   từng yêu cầu. Điểm = trung bình (theo đoạn JD) của độ tương đồng cao nhất với một đoạn CV. Giới hạn 256 đoạn CV. Hiệu chỉnh lại
   `SEMANTIC_MATCH_THRESHOLD` bằng benchmark.
2. **Bộ đánh giá có nhãn** `ai-service/evaluation/`: định dạng ca kiểm thử (CV file/text + JD + nhãn HR: điểm, tier, trạng thái từng
   yêu cầu theo `id`), `tools/evaluate_scoring.py` báo MAE, tỷ lệ cùng tier, độ khớp từng yêu cầu. CV thật để trong
   `evaluation/private/` (gitignore).
3. **Từ điển năng lực cấu hình được** `app/data/capability_lexicon.json` (`CAPABILITY_LEXICON_PATH`): thêm cách diễn đạt cho năng
   lực có sẵn và năng lực mới, không cần sửa code. **Điểm một phần nhờ ngữ nghĩa**: yêu cầu `OTHER` chưa đạt mà có đoạn CV đủ giống
   (`EVIDENCE_CREDIT_THRESHOLD`) được nâng `evidenceCoverage` lên tối đa `EVIDENCE_PARTIAL_CREDIT` (0,5), không bao giờ thành
   `MATCHED`, luôn `requiresManualReview` + cảnh báo `SEMANTIC_PARTIAL_CREDIT`.
4. **Cross-encoder tùy chọn** (`RERANKER_MODEL`, mặc định tắt để vừa RAM Render 2 GB): chấm lại top đoạn bằng chứng; khi bật thì
   điểm một phần ở mục 3 dùng điểm cross-encoder.
5. **Hiệu chỉnh trọng số**: `tools/evaluate_scoring.py --calibrate` dò lưới trọng số (bước 0,05, tổng = 1) trên bộ có nhãn, in
   trọng số khuyến nghị; không tự áp dụng.
6. **Phản hồi từ HR**: `evaluation/hr_feedback.sql` xuất điểm AI mới nhất + quyết định HR (`application_status_history`),
   `tools/hr_feedback_report.py` báo tỷ lệ shortlist/reject theo tier và các ca lệch (điểm cao bị loại, điểm thấp được chọn).

## Kiểm thử

- Test mới: chia đoạn đọc được nội dung cuối CV dài; điểm một phần không bao giờ thành MATCHED; lexicon nạp từ file; reranker tắt
  thì không tải model; công cụ đánh giá/hiệu chỉnh/phản hồi chạy trên dữ liệu mẫu.
- `pytest` toàn bộ; chạy lại benchmark và CV thật (local) để so trước/sau.
- `detect-changes` trước khi commit.
