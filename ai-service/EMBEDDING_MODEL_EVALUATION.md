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
- Ngưỡng ban đầu `SEMANTIC_MATCH_THRESHOLD = 0.50` đã được thay ở phần "Cải thiện độ chính xác" bên dưới.
- `bge-m3` vẫn dùng được bằng cách đặt `EMBEDDING_MODEL=BAAI/bge-m3` (và build image với `--build-arg EMBEDDING_MODEL=BAAI/bge-m3`).

## Giới hạn

Bộ dữ liệu nhỏ và các nhóm nghề khác hẳn nhau, nên cả hai model đều đạt 100%. Cần thêm các cặp "gần đúng" (ví dụ CV React
cho job .NET) và CV thật đã ẩn danh trước khi kết luận về chất lượng xếp hạng.

## Cải thiện độ chính xác (2026-10-09)

### Lỗi cắt chữ của MiniLM

MiniLM chỉ đọc **128 token** (bge-m3 đọc 8192). Bản đầu ghép cả CV thành một chuỗi, nên với CV dài model chỉ thấy tên,
liên hệ và tóm tắt. Bộ 18 cặp ở trên không lộ lỗi vì CV mẫu rất ngắn.

Sửa: `SemanticMatcher.calculate_similarity` chia CV và JD thành đoạn ≤ 350 ký tự; mỗi đoạn JD (tiêu đề + mô tả, từng yêu cầu)
lấy độ tương đồng cao nhất với một đoạn CV; điểm là trung bình, rồi đổi thang từ `[SEMANTIC_FLOOR, SEMANTIC_CEILING]`
= `[0.10, 0.55]` sang `[0, 1]`.

| Bộ 18 cặp, MiniLM | Ghép cả chuỗi | Chia đoạn + đổi thang |
|---|---|---|
| Điểm TB cặp phù hợp / không phù hợp | 0,706 / 0,168 | 0,706 / 0,035 |
| Thấp nhất phù hợp / cao nhất không phù hợp | 0,634 / 0,306 | 0,528 / 0,148 |
| Độ trễ p50 | 26 ms | 44 ms |
| Độ chính xác | 100% | 100% |

`SEMANTIC_MATCH_THRESHOLD = 0.35` (giữa 0,148 và 0,528).

### Yêu cầu mềm và điểm một phần

- Từ điển năng lực `app/data/capability_lexicon.json` thêm cách diễn đạt (ví dụ "led development team" → Teamwork,
  "database partitioning" → Database design) và năng lực mới (OOP, SOLID, design patterns, testable/maintainable code).
- Yêu cầu `OTHER` chưa đạt mà có câu CV đủ giống được tối đa `EVIDENCE_PARTIAL_CREDIT = 0.5`, không bao giờ thành `MATCHED`,
  luôn cần người xem (`matchMethod = SEMANTIC_PARTIAL`). Bỏ qua câu mang nghĩa mong muốn/phủ định/việc của người khác.

Độ giống giữa yêu cầu và câu tốt nhất trong một CV thật (13 yêu cầu dò thử):

| | CV không có (7) | CV có (6) |
|---|---|---|
| Bi-encoder MiniLM | 0,29–0,58 | 0,66–0,77 |
| Cross-encoder `mmarco-mMiniLMv2-L12-H384-v1` | 0,008–0,061 | 0,82–0,999 |

Bi-encoder để hở khoảng rất hẹp (0,58 / 0,66) nên `EVIDENCE_CREDIT_THRESHOLD = 0.65`. Cross-encoder tách rõ hơn hẳn
(`RERANKER_CREDIT_THRESHOLD = 0.5`) nhưng cần thêm ~0,5 GB RAM và ~1–2 s mỗi lô, nên **mặc định tắt** (`RERANKER_MODEL`
rỗng); bật khi máy chủ đủ RAM.

### Kết quả trên một CV thật (Senior Fullstack, nhãn tạm thời chưa phải của HR: 82 điểm)

| | Trước | Sau |
|---|---|---|
| `matchScore` | 73,27 (tier 70–79) | 87,12 (tier ≥80) |
| Yêu cầu khớp nhãn | 14/15 (thiếu "database design") | 15/15 |

Một CV chưa đủ để kết luận. Dùng `tools/evaluate_scoring.py` với bộ ca có nhãn của HR (xem `evaluation/README.md`).

## Knockout, nhắc thoáng qua, câu bị ngắt dòng (2026-10-09)

CV thứ hai (Node.js/React, ứng tuyển JD .NET) lộ hai lỗi: thiếu C#/.NET chỉ mất ~3 điểm (".NET" trong câu "converted a 2D game
… to .NET in one night" vẫn được tính), và bỏ sót bằng chứng do PDF ngắt câu giữa dòng / từ điển thiếu cách diễn đạt.

- **Knockout**: MUST_HAVE có `knockout: true` chưa đạt → điểm tối đa 59, cần người xem.
- **Nhắc thoáng qua**: kỹ năng chỉ xuất hiện 1 lần, trong câu văn xuôi (≥ 8 từ, không phải dòng liệt kê/tech stack), không được
  tính; bỏ qua với CV < 600 ký tự hoặc kỹ năng khai kèm số năm. Cảnh báo `WEAK_SINGLE_MENTION`.
- **Ngắt dòng**: `evidence_spans` nối dòng khi dòng trước chưa hết câu và dòng sau bắt đầu bằng chữ thường/số.
- **Từ điển**: "component library", "UI building blocks", "frontend project structure", "technical decisions", "trade-offs",
  "optimistic updates", "application responsiveness".

| 2 CV thật, nhãn tạm (chưa phải của HR) | Nhãn | Trước | Sau |
|---|---|---|---|
| CV .NET + Angular | 82 | 87,12 | 86,52 |
| CV Node.js + React (JD .NET, `backend-dotnet` knockout) | 58 | 71,91 | 59,00 |
| MAE / cùng tier / khớp yêu cầu | | 9,52 / 50% / 90% | 2,76 / 100% / 96,7% |

Lệch còn lại: `backend-dotnet` của CV Node.js — nhãn tạm ghi PARTIAL, AI ghi NOT_FOUND (một lần nhắc thoáng qua không được tính).
