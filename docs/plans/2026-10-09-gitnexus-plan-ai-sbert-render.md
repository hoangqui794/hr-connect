# Kế hoạch GitNexus: đổi model AI sang Sentence-BERT và deploy Render

## Bối cảnh

Đề tài Capstone yêu cầu "TF-IDF/embedding-based semantic similarity (e.g., Sentence-BERT)", chấm điểm 1 cặp CV/JD dưới 5 giây,
và WP4 yêu cầu "build and **evaluate**" model. Hiện `ai-service` dùng `BAAI/bge-m3` (~2,3 GB): nặng, không chạy được trên Render
gói nhỏ, và chưa có số liệu đánh giá.

## Phân tích GitNexus (impact, upstream)

| Symbol | Risk | Quyết định |
|---|---|---|
| `get_embedding_model` | CRITICAL (173 impacted) | **Không sửa thân hàm.** Model đọc từ cấu hình. |
| `Settings` | CRITICAL (riskSharedAxes MEDIUM) | Chỉ đổi giá trị mặc định `embedding_model`; không đổi tên/kiểu trường. |
| `SemanticMatcher` | LOW | Không sửa; script đo gọi qua lớp này. |

`semantic_match_threshold` chỉ được `ExplanationService` dùng để viết câu giải thích, không tham gia `matchScore`.

## Các bước

1. **Script đo** `ai-service/tools/benchmark_embedding_models.py` + bộ dữ liệu `tools/embedding_benchmark_pairs.json`
   (cặp CV/JD tiếng Việt và tiếng Anh, có nhãn phù hợp / không phù hợp). Đo: thời gian tải model, độ trễ p50/p95 mỗi cặp,
   điểm trung bình hai nhóm, khoảng cách tách, ngưỡng tốt nhất và độ chính xác ở ngưỡng đó. Chạy qua `SemanticMatcher`.
2. **Chạy so sánh** `BAAI/bge-m3` và `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`; ghi kết quả vào
   `ai-service/EMBEDDING_MODEL_EVALUATION.md`.
3. **Đổi mặc định** `embedding_model` sang MiniLM trong `config.py` và `.env.example`; đặt `SEMANTIC_MATCH_THRESHOLD`
   theo ngưỡng đo được.
4. **Dockerfile**: cài torch bản CPU, tải sẵn model khi build (khởi động nhanh, không cần mạng lúc chạy),
   nghe theo biến `PORT` của Render (mặc định 8001).
5. **`render.yaml`** (Blueprint) cho `ai-service` + hướng dẫn biến môi trường trong README.
6. **Kiểm thử**: `pytest` toàn bộ `ai-service`; `docker build` nếu máy có Docker.
7. `detect-changes` trước khi commit. Không push/merge khi chưa được yêu cầu.
