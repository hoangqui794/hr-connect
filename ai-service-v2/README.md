# HR Connect AI Service v2

Microservice độc lập viết bằng **Python FastAPI** chịu trách nhiệm chấm điểm mức độ phù hợp giữa CV – JD và tính điểm tương đồng ngữ nghĩa cho tính năng Gợi ý việc làm (MF-03).

---

## 1. Kiến Trúc & Nguyên Tắc Thiết Kế Cốt Lõi

1. **Multi-Provider LLM + Sentence-BERT Hybrid:**
   - Hỗ trợ **Google Gemini** (`LLM_PROVIDER=gemini`, mặc định dùng `gemini-4-hydrogen` / `gemini-3.5-flash-lite` kèm danh sách model dự phòng `GEMINI_FALLBACK_MODELS`), và tự động chuyển đổi dự phòng sang **OpenAI** hoặc **Anthropic** qua `LLM_FALLBACK_PROVIDERS`.
   - Sử dụng **Sentence-BERT** (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`) để tính điểm tương đồng ngữ nghĩa đa ngôn ngữ Việt – Anh.
2. **Deterministic Scoring (LLM không bao giờ tự cho con số tổng điểm):**
   - LLM chỉ đánh giá trạng thái từng yêu cầu (`MATCHED`, `PARTIAL`, `NOT_FOUND`, `UNKNOWN`), trích xuất số năm kinh nghiệm liên quan, mức phù hợp tổng thể (`1–5`) và **câu trích dẫn nguyên văn (`evidence_quotes`)** từ CV.
   - Bộ hậu kiểm `app/verification.py` dùng `PyMuPDF` đọc văn bản gốc của CV để kiểm chứng từng câu trích dẫn (`quote_min_token_ratio = 0.85`) và kiểm tra ngưỡng năm kinh nghiệm (`years_tolerance = 0.25`). Trích dẫn không khớp bị hạ xuống `PARTIAL`/`NOT_FOUND` (`LLM_UNVERIFIED`) và bật cờ `requiresManualReview = true`.
   - Bộ tính điểm `app/scoring.py` tính điểm tất định (0–100) theo 4 trọng số và áp dụng **trần điểm Knockout (`knockout_score_cap`, mặc định `59.0`)** nếu thiếu bất kỳ tiêu chí `MUST_HAVE` nào.
3. **Trọng số Động từ Backend (`scoringOverrides`) & Hàng đợi Bền vững Blue/Green:**
   - Khi Backend gửi yêu cầu qua `POST /api/v1/scoring-jobs`, `Mf03ScoringDispatcher` đọc 5 tham số cấu hình từ trang **Cài đặt hệ thống (`/admin/settings`)** (`mf03.ai_scoring.must_have_weight`, `should_have_weight`, `semantic_weight`, `llm_fit_weight`, `knockout_cap_score`) và truyền trong trường `scoringOverrides`. Nếu không truyền, dịch vụ dùng giá trị mặc định trong `app/config.py`.
   - Hàng đợi công việc đang nhận được lưu bền vững xuống tệp JSON (`SCORING_QUEUE_FILE`, trên Production là `/var/lib/hrconnect-ai/pending-scoring-jobs.json`) và tuân thủ khóa `SCORING_ACTIVE_COLOR_FILE` khi chuyển đổi Blue/Green để không làm rơi job lúc tái triển khai.

---

## 2. Hợp Đồng API Nội Bộ

Tất cả endpoint (trừ `/health`) đều bắt buộc header xác thực nội bộ `X-Service-Token`:

| Method | Route | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra tiến trình FastAPI sẵn sàng (phục vụ Docker & Blue/Green healthcheck). |
| `POST` | `/api/v1/scoring-jobs` | Nhận yêu cầu chấm điểm bất đồng bộ từ Backend (`202 Accepted`), tải JD (`GET /api/v1/internal/jobs/{jobId}/jd`) & CV Presigned URL, chấm điểm và gửi callback kết quả về `POST /api/v1/internal/ai-results` (có retry exponential backoff khi lỗi mạng/`429`/`5xx`). |
| `POST` | `/api/v1/semantic-match` | Chấm điểm tương đồng ngữ nghĩa hàng loạt bằng Sentence-BERT (không gọi LLM) phục vụ `JobMatchWorker` gợi ý việc làm tự động cho Candidate. |
| `POST` | `/api/v1/match-file` | Chấm điểm trực tiếp từ tệp tải lên phục vụ công cụ đánh giá nội bộ (`tools/evaluate.py`). |

---

## 3. Khởi Chạy & Kiểm Thử

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\pip install -r requirements.txt
# Linux/macOS: ./.venv/bin/pip install -r requirements.txt
cp .env.example .env

# Chạy dịch vụ ở cổng 8001 (khớp với MF03_BASE_URL của Backend)
uvicorn app.main:app --host 127.0.0.1 --port 8001

# Chạy bộ kiểm thử tự động (không gọi LLM thật, không tốn chi phí)
pytest -q
```
