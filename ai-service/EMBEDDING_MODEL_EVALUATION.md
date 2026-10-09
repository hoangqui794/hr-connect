# Đánh giá model embedding (WP4)

Đề tài yêu cầu so khớp CV–JD bằng "TF-IDF/embedding-based semantic similarity (e.g., Sentence-BERT)" và chấm một cặp CV/JD
dưới 5 giây. Tài liệu này ghi lại lý do chọn model.

## Cách đo

- Script: `tools/benchmark_embedding_models.py`; dữ liệu: `tools/embedding_benchmark_pairs.json`.
- 18 cặp CV/JD ẩn danh (8 phù hợp, 10 không phù hợp), trộn tiếng Việt và tiếng Anh, 6 nhóm nghề (.NET, React, kế toán,
  kinh doanh, phân tích dữ liệu, điều dưỡng).
- Điểm được tính qua `SemanticMatcher.calculate_similarity`, đúng cách ghép văn bản như khi chạy thật.
- Máy đo: laptop Windows, CPU, torch 2.14 CPU. Độ trễ không tính lần gọi khởi động.

```
python tools/benchmark_embedding_models.py BAAI/bge-m3 sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

## Kết quả (2026-10-09)

| Chỉ số | `BAAI/bge-m3` | `paraphrase-multilingual-MiniLM-L12-v2` |
|---|---|---|
| Kích thước model | ~2,3 GB | ~470 MB |
| RAM đỉnh của tiến trình | ~1,9 GB | ~1,4 GB |
| Độ trễ mỗi cặp (p50 / p95) | 248 / 290 ms | **26 / 28 ms** |
| Điểm TB cặp phù hợp | 0,781 | 0,706 |
| Điểm TB cặp không phù hợp | 0,460 | 0,168 |
| Khoảng cách tách hai nhóm | 0,321 | **0,538** |
| Điểm thấp nhất cặp phù hợp / cao nhất cặp không phù hợp | 0,669 / 0,529 | 0,634 / 0,306 |
| Độ chính xác ở ngưỡng tốt nhất | 100% | 100% |

## Quyết định

- Dùng **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`** làm mặc định: đúng họ Sentence-BERT như đề tài,
  nhanh hơn khoảng 10 lần, tách nhóm rõ hơn, và chạy được trên Render gói standard (2 GB).
- `SEMANTIC_MATCH_THRESHOLD = 0.50`: nằm giữa điểm cao nhất của cặp không phù hợp (0,31) và thấp nhất của cặp phù hợp (0,63).
  Ngưỡng này chỉ dùng để viết câu giải thích, không thay đổi `matchScore`.
- `bge-m3` vẫn dùng được bằng cách đặt `EMBEDDING_MODEL=BAAI/bge-m3` (và build image với `--build-arg EMBEDDING_MODEL=BAAI/bge-m3`).

## Giới hạn

Bộ dữ liệu nhỏ và các nhóm nghề khác hẳn nhau, nên cả hai model đều đạt 100%. Cần thêm các cặp "gần đúng" (ví dụ CV React
cho job .NET) và CV thật đã ẩn danh trước khi kết luận về chất lượng xếp hạng.
