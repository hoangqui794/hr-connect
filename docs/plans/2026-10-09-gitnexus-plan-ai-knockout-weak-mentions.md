# Kế hoạch GitNexus: knockout, nhắc thoáng qua, câu bị PDF ngắt dòng

## Bằng chứng (CV Node.js với JD .NET)

AI 71,91 (tier 70–79), nhãn tạm 58 (<60). Hai loại lỗi:
1. Thiếu kỹ năng cốt lõi (C#/.NET) chỉ mất ~3 điểm; ".NET" trong câu "Converted a 2D game … to .NET in one night" vẫn được tính
   (bộ đọc CV còn đưa `.net` vào danh sách kỹ năng).
2. Bỏ sót bằng chứng: PDF ngắt câu "response time from 3+\nseconds to sub 100ms"; từ điển thiếu "component library",
   "UI building blocks", "project structure", "technical decisions", "tradeoffs".

## Impact (upstream)

| Symbol | Risk | Caller thật (text search) |
|---|---|---|
| `RequirementMatcher._match_requirement` | CRITICAL (135, phần lớn file React nối nhầm) | `RequirementMatcher.match` |
| `evidence_spans` | CRITICAL (135, như trên) | `evaluate_clauses`, `SemanticMatcher.retrieve_evidence`, `_chunk` |
| `JobRequirement` | UNKNOWN | Payload từ backend; schema bỏ qua trường lạ, thêm trường tùy chọn không phá payload cũ |
| `RequirementMatch` | MEDIUM (20) | Thêm trường tùy chọn `knockout` |
| `ScoreCalculator` | LOW | Thêm chặn trần |

## Thay đổi

1. **Knockout**: `JobRequirement.knockout` (mặc định false). MUST_HAVE có `knockout: true` mà chưa `MATCHED` → điểm tối đa
   `KNOCKOUT_SCORE_CAP` (59), yêu cầu gắn `KNOCKOUT_NOT_MET`, hồ sơ cần người xem, thêm lý do vào `matchingReasons`.
   Backend/FE chưa có trường này: cần thêm cờ knockout cho yêu cầu của job (MF-01) ở đợt sau.
2. **Nhắc thoáng qua**: kỹ năng (SKILL) chỉ xuất hiện đúng 1 lần trong CV, trong một câu kể chuyện (≥ 8 từ, không phải dòng
   liệt kê/“Tech stack”/“Skills”), không được tính là có; gắn `WEAK_SINGLE_MENTION` để người xem.
3. **Ngắt dòng PDF**: `evidence_spans` nối dòng khi dòng trước không kết thúc câu và dòng sau bắt đầu bằng chữ thường/số.
   Xuống dòng bên trong đoạn được thay bằng dấu cách (giữ nguyên độ dài, offset vẫn đúng).
4. **Từ điển**: thêm các cách diễn đạt ở mục bằng chứng 2.

## Kiểm thử

Test cho từng thay đổi; `pytest` toàn bộ; `tools/evaluate_scoring.py` trên 2 CV thật (private) — CV .NET không được tụt tier,
CV Node.js phải về <60. `detect-changes` trước khi commit.
