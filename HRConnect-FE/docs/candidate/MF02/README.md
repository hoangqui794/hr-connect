# MF-02 — Candidate Application, Consent, CV và Identity UI

## Chức năng backend đã làm xong để gắn UI

- Candidate tự apply Job bằng CV trong kho hoặc file PDF mới.
- Danh sách/chi tiết Application cơ bản của Candidate.
- Search Application theo Job/Company và lọc nguồn `CANDIDATE/AFFILIATE`.
- Danh sách consent đang chờ; review, confirm/decline và quyền reuse.
- CRUD kho CV cá nhân, signed download URL, usage metadata và delete behavior.
- Danh sách/detail/usages CV Affiliate, bật/tắt reuse và adopt vào kho cá nhân.
- Danh sách email identity, identity claim, resend/verify OTP và thu hồi alias.

## Route FE và trạng thái triển khai

| Route | Chức năng | Trạng thái |
|---|---|---|
| `/candidate/applications` | Consent pending + lịch sử Application + search/source/status/date filter | Đang gắn API hoàn chỉnh |
| `/candidate/applications/:id` | Detail cơ bản MF-02 | Đã có; lifecycle nâng cao chờ MF-04 |
| `/candidate/submission-consents/:id` | Xem CV và quyết định consent | Đã gắn |
| `/candidate/cvs` | Quản lý CV cá nhân và usage/retention | Đang hoàn thiện UI |
| `/candidate/affiliate-cvs` | Quản lý CV Affiliate gửi | Đã gắn |
| `/candidate/settings/email-identities` | Claim email cũ và revoke alias | Đang hoàn thiện UI |

## Quy tắc hiển thị

- Consent pending nằm trước lịch sử Application vì cần Candidate hành động.
- Chỉ hiện nút quyết định khi backend trả `isActionable=true`.
- CV có reference khi gỡ sẽ archive khỏi kho; lịch sử vẫn giữ.
- Revoke alias không xóa CV/Application đã liên kết và không đổi email đăng nhập.
- Không đưa nút retry MF-03 cho Candidate.

## Test UI

- Consent happy path/decline/expired/ownership.
- Application search/source filter gửi đúng query.
- CV hard-delete so với archive-history.
- Identity resend/concurrency/admin review/revoke alias.
- Permission thiếu thì không hiện mutation control.
