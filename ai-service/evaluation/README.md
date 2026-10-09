# Đánh giá chấm điểm AI với nhãn của HR

Mục tiêu: biết AI chấm **sai bao nhiêu** so với HR, và không để lần sửa sau làm tệ đi.

## 1. Bộ ca kiểm thử có nhãn

`manifest.json` gồm danh sách `cases`:

```json
{
  "cases": [
    {
      "id": "ca-1",
      "cv": {"file": "cv/ca-1.pdf"},
      "job": "jd/senior-fullstack.json",
      "label": {
        "score": 82,
        "requirements": {"backend-dotnet": "MATCHED", "performance": "PARTIAL", "lighthouse": "NOT_FOUND"}
      }
    }
  ]
}
```

- `cv`: `{"file": "..."}` (PDF/DOCX/ảnh, đi qua `/api/v1/match-file`) hoặc `{"candidate": {...}}` (đi qua `/api/v1/match`).
- `job`: đường dẫn file JD (dạng `{"title", "description", "requirements"}` hoặc cả payload có khóa `job`) hoặc JD viết thẳng.
- `label.score`: điểm HR cho (0–100). `label.requirements`: theo `id` của từng yêu cầu trong JD,
  giá trị `MATCHED` / `PARTIAL` / `NOT_FOUND`.
- Đường dẫn tương đối tính từ thư mục chứa manifest.

**CV thật để trong `evaluation/private/`** (đã gitignore). Không commit CV có thông tin cá nhân.
`example_manifest.json` là ví dụ tổng hợp để xem định dạng.

## 2. Chạy đánh giá

```
python tools/evaluate_scoring.py evaluation/private/manifest.json
```

Báo cáo: điểm AI so với HR từng ca, sai số tuyệt đối trung bình (MAE), tỷ lệ cùng tier (≥80, 70–79, 60–69, <60),
tỷ lệ khớp từng yêu cầu, và danh sách yêu cầu AI chấm khác HR. Chạy lại sau mỗi lần sửa AI và so với lần trước.

## 3. Hiệu chỉnh trọng số

```
python tools/evaluate_scoring.py evaluation/private/manifest.json --calibrate
```

Dò mọi bộ trọng số (bước 0,05, tổng bằng 1) và in 5 bộ có MAE thấp nhất. Chỉ là **khuyến nghị**: cần ít nhất vài chục ca
mới đáng tin, rồi mới đặt `MUST_HAVE_WEIGHT` / `SHOULD_HAVE_WEIGHT` / `SEMANTIC_WEIGHT`.

## 4. Phản hồi từ quyết định thật của HR

1. Chạy `hr_feedback.sql` trên database HR Connect, lưu kết quả thành CSV
   (`psql "$DATABASE_URL" --csv -f evaluation/hr_feedback.sql > hr_feedback.csv`). File không có tên hay liên hệ ứng viên.
2. `python tools/hr_feedback_report.py hr_feedback.csv`

Báo cáo tỷ lệ HR chọn/loại theo từng tier, lý do loại hay gặp, tỷ lệ chọn có giảm dần từ tier cao xuống thấp không
(`monotonic`), và các ca lệch nhất (điểm ≥80 bị loại, điểm <60 được chọn) để đưa vào bộ ca có nhãn ở mục 1.

## Yêu cầu knockout

Trong JD, đặt `"knockout": true` cho MUST_HAVE mà thiếu là loại (ví dụ C#/.NET cho vị trí .NET). Nếu yêu cầu đó chưa `MATCHED`,
điểm bị chặn ở `KNOCKOUT_SCORE_CAP` (mặc định 59), yêu cầu có cảnh báo `KNOCKOUT_NOT_MET` và hồ sơ cần người xem.
Backend/FE chưa gửi cờ này; cần thêm vào yêu cầu của job (MF-01).

## Yêu cầu cốt lõi (tự nhận)

MUST_HAVE loại SKILL/EXPERIENCE có công nghệ nằm trong tiêu đề hoặc mô tả JD được coi là cốt lõi. CV hoàn toàn không có bằng chứng
cho yêu cầu đó bị chặn ở `KNOCKOUT_SCORE_CAP` và có cảnh báo `CORE_REQUIREMENT_MISSING`. Tắt bằng `INFER_CORE_REQUIREMENTS=false`.

## Từ điển năng lực

Cách diễn đạt được chấp nhận cho yêu cầu mềm nằm ở `app/data/capability_lexicon.json` (hoặc file chỉ định bởi
`CAPABILITY_LEXICON_PATH`). Thêm cách diễn đạt mới vào đó khi đánh giá cho thấy AI bỏ sót, rồi chạy lại mục 2.
File còn có `skillSynonyms` (ví dụ Git ↔ GitHub/GitLab, SQL ↔ PostgreSQL) và `domainSynonyms` (ví dụ kinh nghiệm "web" được
chứng minh bằng vị trí làm Angular/React/REST API) dùng khi đếm số năm kinh nghiệm theo lĩnh vực.
