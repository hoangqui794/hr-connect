# HR Connect AI Service v2 (thử nghiệm)

Bản thử nghiệm thay thế `ai-service` (v1). Dùng **LLM (Claude) để đọc CV và đánh giá từng yêu cầu**, giữ
**Sentence-BERT** cho điểm ngữ nghĩa (yêu cầu đề tài), và **điểm số do code tính**, không do LLM tự cho.

## Vì sao có v2

Đánh giá v1 ngày 2026-10-14 (19 CV thật, JD Senior Fullstack và JD Social Media Marketing) cho thấy:

- JD ngoài IT chấm sai: kinh nghiệm "2 năm marketing" được tính **ĐẠT** cho CV IT và CV Logistics, vì bộ chấm
  kinh nghiệm chỉ biết các ngành IT.
- CV dạng ảnh: OCR đọc sai nhiều chữ và mất 13–28 giây mỗi CV.
- Yêu cầu mềm và từ đồng nghĩa (locking ≈ concurrency, Kafka ≈ messaging) phải thêm tay vào từ điển.

## Luồng xử lý

```
CV (PDF / DOCX / ảnh) ──► Claude đọc CV (cả PDF scan và ảnh) và đánh giá từng yêu cầu,
                          kèm câu trích nguyên văn làm bằng chứng
                                   │
                                   ▼
                     Code kiểm tra câu trích có thật trong CV
                     (so với chữ đọc bằng PyMuPDF; sai thì hạ xuống PARTIAL + cần người xem)
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   Sentence-BERT: độ giống nghĩa CV–JD        Công thức điểm trong code
                                              (MUST_HAVE / SHOULD_HAVE / ngữ nghĩa,
                                               thiếu MUST_HAVE thì trần 59)
              └────────────────────┬────────────────────┘
                                   ▼
                  Điểm + bằng chứng → HR quyết định
```

Các chốt an toàn:

- LLM **không cho điểm**; chỉ trả trạng thái từng yêu cầu. `scoring.py` tính điểm.
- Câu trích không tìm thấy trong CV **không bao giờ làm tăng điểm** (`LLM_UNVERIFIED`).
- Ngưỡng số năm kinh nghiệm được **code kiểm tra lại** (`LLM_YEARS_BELOW_MIN`).
- CV ảnh/scan luôn được đánh dấu **cần người xem**: không có bản chữ độc lập để đối chiếu.
- LLM lỗi (hết hạn mức, từ chối, bị cắt) → trả 503 và hồ sơ chuyển HR xem thủ công, không bao giờ bị loại.

## API

Cùng hợp đồng với v1: `POST /api/v1/match-file` (multipart: `file` + `metadata` JSON có `requestId`,
`applicationId`, `attemptNo`, `job`). Response có `parseResult` và `matchingResult` (`matchScore`,
`semanticScore`, `mustHaveResult`, `shouldHaveResult`, `requiresManualReview`, `reviewReasons`, ...).

## Chạy

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env      # rồi điền ANTHROPIC_API_KEY
.\.venv\Scripts\uvicorn app.main:app --port 8002
```

Test (không gọi LLM thật, không tốn phí): `.\.venv\Scripts\python -m pytest -q`

So với HR (gọi LLM thật, tốn phí theo số CV):

```powershell
.\.venv\Scripts\python tools\evaluate.py ..\ai-service\evaluation\private\manifest-senior-fullstack.json --limit 3
```

## Chi phí và dữ liệu cá nhân

- Mỗi CV là một lần gọi Claude (CV + JD đầu vào, kết quả JSON đầu ra). JD và system prompt được cache, nên chấm
  nhiều CV cho cùng một job rẻ hơn. Đổi `LLM_MODEL` để cân bằng chất lượng và chi phí; đo bằng `tools/evaluate.py`.
- CV (có thông tin liên hệ) được gửi tới Anthropic. Điều khoản consent của ứng viên phải nêu rõ việc này
  (Nghị định 13/2023).
