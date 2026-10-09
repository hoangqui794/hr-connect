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

## Ngữ nghĩa phụ thuộc MUST_HAVE, siết bằng chứng (2026-10-09)

CV thứ ba (Unity/C#, ứng tuyển cùng JD .NET fullstack) được 36,48 với nhãn tạm 20: riêng phần ngữ nghĩa cho 20 điểm vì CV IT nào
cũng "giống" JD IT (0,67 so với 0,87–0,88 của hai CV fullstack).

- **Ngữ nghĩa phụ thuộc MUST_HAVE** (`SEMANTIC_GATED_BY_MUST_HAVE=true`): phần ngữ nghĩa nhân với tỷ lệ đạt MUST_HAVE, nên
  độ giống chủ đề chỉ thưởng cho ứng viên đã đạt yêu cầu cứng, không bù cho yêu cầu thiếu.
- **Hiệu năng cần hành động**: "Backend/Client performance" chỉ tính câu có hành động tối ưu (optimized, reduced, cut, cached…);
  "powered by Vite for high-performance bundling" không còn được tính.
- **Refactor**: chỉ tính refactor mã cũ/codebase ("refactors of legacy code"), không tính "refactored the architecture into modules".
- **Sửa lỗi từ điển**: bản trước thêm OOP, SOLID, Design patterns, Testable code, Maintainable code trùng với năng lực có sẵn,
  làm yêu cầu "OOP, SOLID…" bị đếm trùng tiêu chí. Mục trùng tên giờ được gộp.

| 3 CV thật, nhãn tạm (chưa phải của HR) | Nhãn | Trước | Sau |
|---|---|---|---|
| .NET + Angular | 82 | 86,52 | 85,43 |
| Node.js + React (knockout .NET) | 58 | 59,00 | 59,00 |
| Unity / C# | 20 | 36,48 | 20,18 |
| MAE / cùng tier / khớp yêu cầu | | 7,33 / 100% / 91,1% | 1,54 / 100% / 93,3% |

Lệch còn lại: (1) "≥ 3 năm kinh nghiệm *web*" vẫn so với tổng số năm (4,1, gồm cả thực tập) vì API chấm điểm chưa nhận danh
sách vị trí làm việc; (2) OOP được tính nhờ "C# (Expert)" — chấp nhận được nhưng nhãn tạm ghi không có; (3) `backend-dotnet`
của CV Node.js như trước.

`--calibrate` trên 3 CV gợi ý giảm `SEMANTIC_WEIGHT` xuống 0,10 nhưng làm tỷ lệ cùng tier giảm từ 100% xuống 67% — quá khớp,
không áp dụng.

## Thử với JD thật (TopCV .NET, ITviec Java) (2026-10-09)

Thêm 2 JD thật, nhập như HR (không có cờ knockout): 9 lần chấm = 3 JD × 3 CV. CV .NET tốt nhất bị chấm 66,66 với JD .NET thật.

| Lỗi | Sửa |
|---|---|
| "HTML5", "CSS3", "Stored Procedures" không khớp "HTML", "CSS", "stored procedure" | Khớp cụm từ chấp nhận hậu tố phiên bản và số nhiều |
| JD tiếng Việt "Cao đẳng/Đại học ngành CNTT" không khớp "Bachelor/Engineer's Degree in Software Engineering" | So bậc học và nhóm ngành CNTT song ngữ, đọc từ mục học vấn đã tách |
| "2 năm .NET", "4+ năm Java", "3 năm web" so với tổng số năm (gồm cả thực tập) | Cộng năm của các vị trí liên quan (từ đồng nghĩa lĩnh vực trong từ điển), bỏ thực tập, gộp khoảng trùng |
| Kỹ năng trong tiêu đề JD (".NET", "Spring Boot") ngang hàng yêu cầu khác | Tự nhận yêu cầu cốt lõi từ tiêu đề/mô tả; hoàn toàn không có → chặn trần 59 |
| "Git" ≠ GitHub/GitLab, "SQL" ≠ PostgreSQL, "Multi-Tenancy" ≠ multi-tenant; thiếu Communication/English | `skillSynonyms`, `domainSynonyms`, năng lực Communication/English trong từ điển |

Danh sách vị trí làm việc và học vấn đã có ở cả `/match-file` lẫn luồng backend (AI service tự đọc CV), nên không cần sửa backend.

| 9 lần chấm, nhãn tạm (chưa phải của HR) | Trước | Sau |
|---|---|---|
| MAE | 9,90 | 7,38 |
| Cùng tier | 88,9% | 100% |
| Khớp từng yêu cầu | 80,3% | 93,2% |
| CV .NET với JD .NET thật (nhãn 85) | 66,66 | 82,70 |

Còn lệch: CV Node.js với JD .NET thật được 57,45 (nhãn 30) dù mọi yêu cầu đều khớp nhãn — khoảng cách nằm ở công thức (SHOULD_HAVE
20% cho "ưu tiên MySQL", trần 59 khi thiếu kỹ năng cốt lõi). Cần nhãn của HR trên nhiều CV hơn mới hiệu chỉnh được.
