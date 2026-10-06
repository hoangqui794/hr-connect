# Candidate skill management

Candidate quản lý kỹ năng trong hồ sơ cá nhân để dữ liệu kỹ năng luôn nhất quán
với danh mục `skill` đang hoạt động. Các thay đổi dùng bảng `candidate_skill`
đã có sẵn, không tạo migration mới.

## APIs

| API | Mục đích |
| --- | --- |
| `GET /api/v1/skills?search=&page=&pageSize=` | Danh mục kỹ năng active để Candidate chọn. |
| `PUT /api/v1/candidates/profile/me/skills` | Thay toàn bộ danh sách kỹ năng atomically. Mảng rỗng sẽ xóa hết. |
| `POST /api/v1/candidates/profile/me/skills` | Thêm một kỹ năng. |
| `PATCH /api/v1/candidates/profile/me/skills/{skillId}` | Sửa mức thành thạo hoặc số năm kinh nghiệm. |
| `DELETE /api/v1/candidates/profile/me/skills/{skillId}` | Xóa một kỹ năng. |

Tất cả API cần JWT Candidate và permission `candidate.profile.view_own` hoặc
`candidate.profile.update_own` tương ứng.

## Payload

```json
{
  "skillId": "00000000-0000-0000-0000-000000000000",
  "proficiencyLevel": "INTERMEDIATE",
  "yearsOfExperience": 2.5
}
```

`proficiencyLevel` là tùy chọn và phải là `BEGINNER`, `INTERMEDIATE`,
`ADVANCED` hoặc `EXPERT`. `yearsOfExperience` nằm trong khoảng 0 đến 80.
Một Candidate có tối đa 50 kỹ năng và không thể có cùng `skillId` hai lần.
