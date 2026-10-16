# Trang Candidate nhận lại hồ sơ cũ

## Mục tiêu

Khi Affiliate đã tạo Candidate chưa có tài khoản, CV và Submission được gắn với Candidate đó. FE hỗ trợ hai cách để người dùng đăng ký sau này nhận lại dữ liệu.

Route FE đề xuất: `/candidate/settings/email-identities`.

## Cách 1 — Đăng ký bằng đúng email cũ

1. `POST /api/v1/auth/register/candidate`.
2. `POST /api/v1/auth/verify-email-otp`.
3. Backend chỉ liên kết tài khoản với Candidate cũ sau khi OTP của đúng email hợp lệ.
4. Sau login đầu tiên, FE reload:
   - `GET /api/v1/auth/me`;
   - `GET /api/v1/candidates/applications`;
   - `GET /api/v1/candidates/me/affiliate-cvs`;
   - `GET /api/v1/candidates/me/email-identities`.

Nếu đăng ký trả `409 EMAIL_PENDING_VERIFICATION`, chuyển về OTP và cho phép người dùng chủ động resend. Không tự gửi mã mới khi trang vừa mở.

## Cách 2 — Tài khoản dùng email mới, claim email cũ

Trang **Email & hồ sơ liên kết** gồm email chính, alias đã xác minh, form email cũ, màn OTP và trạng thái review.

### Tải danh sách email

`GET /api/v1/candidates/me/email-identities`

Alias dùng để nhận diện và liên kết Candidate; không dùng để login hoặc forgot-password.

### Bắt đầu claim

`POST /api/v1/candidates/me/identity-claims`

```json
{ "email": "old-email@example.com" }
```

Response `202` trả `claimId`, `maskedDestination`, `expiresAt`, `resendAfter`, `concurrencyToken`.

### Verify OTP

`POST /api/v1/candidates/me/identity-claims/{claimId}/verify`

```json
{
  "otp": "123456",
  "concurrencyToken": "..."
}
```

### Resend OTP

`POST /api/v1/candidates/me/identity-claims/{claimId}/resend`

```json
{ "concurrencyToken": "..." }
```

Sau resend, thay ngay `concurrencyToken`, `expiresAt`, `resendAfter` và số lần resend bằng response mới. OTP cũ hết hiệu lực.

## Kết quả verify

| Status | UI |
|---|---|
| `COMPLETED` | Liên kết hoàn tất; reload auth/me, email identities, CV và applications |
| `PENDING_ADMIN_REVIEW` | Đã xác minh email nhưng cần Admin đối chiếu; khóa verify/resend |

## Mã lỗi cần map

| Code | UI |
|---|---|
| `EMAIL_IDENTITY_ALREADY_LINKED` | Reload danh sách email |
| `STALE_IDENTITY_CLAIM` | Reload trạng thái claim |
| `IDENTITY_CLAIM_CONCURRENT_UPDATE` | Báo tab/device khác vừa xử lý và reload |
| `IDENTITY_CLAIM_EXPIRED` | Đóng form OTP, cho tạo claim mới |
| `IDENTITY_CLAIM_RESEND_COOLDOWN` | Giữ form và tiếp tục timer |
| `IDENTITY_CLAIM_RESEND_LIMIT_REACHED` | Khóa resend; không gọi tiếp |
| `CANDIDATE_IDENTITY_MERGE_PENDING` | Báo hồ sơ cần Admin xử lý |

## Giới hạn release hiện tại

FE chỉ triển khai list/start/resend/verify. Chưa hiển thị nút revoke alias hoặc make-primary vì chưa có API phát hành.

## Checklist

- [ ] Email được mask trên UI.
- [ ] Timer lấy từ server.
- [ ] OTP/concurrency token không ghi log.
- [ ] Resend thay token ngay lập tức.
- [ ] `COMPLETED` reload toàn bộ dữ liệu MF02.
- [ ] `PENDING_ADMIN_REVIEW` không cho verify lại.
