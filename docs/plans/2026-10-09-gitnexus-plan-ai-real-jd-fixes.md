# Kế hoạch GitNexus: sửa lỗi lộ ra từ JD thật (TopCV .NET, ITviec Java)

## Mốc trước khi sửa (9 lần chấm = 3 JD × 3 CV, nhãn tạm chưa phải của HR)

MAE 9,9 · cùng tier 88,9% · khớp từng yêu cầu 80,3%. CV .NET tốt nhất bị chấm 66,7 (nhãn 85) với JD .NET thật.

## Lỗi và cách sửa

1. **Phiên bản / số nhiều**: "HTML5", "CSS3", "Stored Procedures" không khớp "HTML", "CSS", "stored procedure".
   → mẫu khớp cụm từ cho phép hậu tố phiên bản (`5`, `3`, `.1`) và số nhiều (`s`, `es`); dùng chung cho đếm "nhắc thoáng qua".
2. **Bằng cấp Việt ↔ Anh**: "Cao đẳng/Đại học ngành CNTT… hoặc ngành liên quan" không khớp "Bachelor/Engineer's Degree in Software
   Engineering". → bậc học (cao đẳng < đại học < thạc sĩ < tiến sĩ) và nhóm ngành CNTT song ngữ; đọc từ mục học vấn đã tách.
3. **Kinh nghiệm theo lĩnh vực**: "2 năm .NET", "4+ năm Java", "3 năm web" bị so với tổng số năm (gồm cả thực tập).
   → gửi danh sách vị trí làm việc (đã tách sẵn) vào `Candidate.workExperience`; cộng năm của vị trí liên quan tới lĩnh vực
   trong yêu cầu, bỏ thực tập/tình nguyện, gộp khoảng trùng. Không có danh sách vị trí → giữ cách cũ + cảnh báo
   `DOMAIN_YEARS_UNVERIFIED`. Cả `/match-file` và luồng backend (`scoring_orchestrator`) đều tự đọc CV nên **không cần sửa backend**.
4. **Kỹ năng cốt lõi tự nhận** (cách 2): MUST_HAVE loại SKILL/EXPERIENCE có thuật ngữ xuất hiện trong tiêu đề hoặc mô tả JD là
   cốt lõi; nếu **hoàn toàn không có** (NOT_FOUND) → chặn trần `KNOCKOUT_SCORE_CAP`, cảnh báo `CORE_REQUIREMENT_MISSING`.
   Cờ `knockout` do HR đặt vẫn chặt hơn (chưa MATCHED là chặn). Tắt bằng `INFER_CORE_REQUIREMENTS=false`.

Thêm: gộp hai đoạn tạo `Candidate` trùng nhau (`app/api/cv.py`, `scoring_orchestrator._to_matching_request`) vào một hàm dùng chung.

## Impact (index mới)

| Symbol | Risk | Caller thật (text search) |
|---|---|---|
| `_contains_phrase`, `_education_matches`, `_match_requirement`, `_match_term` | HIGH/CRITICAL (81, 24 trực tiếp — gồm phần nối nhầm) | chỉ trong `requirement_matcher.py` |
| `Candidate` (Python) | CRITICAL — bị gộp tên với `HRConnect-FE/src/types/candidate.ts` | `app/api/cv.py:143`, `scoring_orchestrator.py:175`; thêm trường tùy chọn, payload cũ vẫn hợp lệ |
| `ScoreCalculator.calculate` | (81) | `MatchingService.match` |

Mọi điểm số đều đổi → chạy toàn bộ test + 9 lần chấm thật trước khi commit; `detect-changes` trước commit.
