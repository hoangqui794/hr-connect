# Trang Candidate xác nhận hồ sơ Affiliate

## Mục tiêu

Candidate xem Candidate/Job/Company/CV mà Affiliate đã nộp và chọn đồng ý hoặc từ chối. Có hai cách truy cập riêng cho Candidate đã có tài khoản và chưa có tài khoản.

Route FE đề xuất:

- `/candidate/submission-consents/:submissionId` — Candidate đã đăng nhập;
- `/submission-consent#token=...` — link email công khai.

## Trường hợp A — Candidate đã có tài khoản

FE không yêu cầu người dùng nhập token kỹ thuật.

1. Từ notification hoặc lịch sử, lấy `submissionId`.
2. Gọi `GET /api/v1/candidates/me/submission-consents/{submissionId}` bằng Bearer token.
3. Hiển thị thông tin và URL xem CV do response trả về.
4. Gửi quyết định bằng `POST /api/v1/candidates/me/submission-consents/{submissionId}/respond`.

Body:

```json
{
  "decision": "CONFIRM",
  "allowFutureReuse": true
}
```

`decision` chỉ nhận `CONFIRM` hoặc `DECLINE`.

## Trường hợp B — Candidate chưa có tài khoản

Email mở một route FE công khai, ví dụ:

```text
/submission-consent#token=<one-time-token>
```

FE thực hiện:

1. Đọc token từ URL fragment.
2. Xóa token khỏi thanh địa chỉ bằng `history.replaceState`.
3. `POST /api/v1/submission-consents/review` với `{ "token": "..." }`.
4. Hiển thị nội dung.
5. `POST /api/v1/submission-consents/respond` với `token`, `decision`, `allowFutureReuse`.

Không lưu token trong localStorage, analytics, console hoặc error tracking.

## Bố cục trang

- Tên Candidate.
- Job và Company.
- Affiliate đã gửi hồ sơ.
- Tên file CV và nút xem CV.
- Hạn xác nhận và đồng hồ đếm ngược.
- Checkbox **Cho phép Affiliate tái sử dụng CV này cho Job khác**.
- Nút **Đồng ý nộp hồ sơ** và **Từ chối**.

Trước khi gửi `DECLINE`, nên có modal xác nhận. Khi đang submit, khóa cả hai nút.

## Kết quả nghiệp vụ

| Decision/state | Kết quả |
|---|---|
| `CONFIRM` | Submission `ACCEPTED`; backend tạo Application, Attribution và hàng đợi MF03 |
| `DECLINE` | Submission `CONSENT_REJECTED`; không tạo Application |
| Hết hạn | Submission `CONSENT_EXPIRED`; không tạo Application |

FE không gọi tuần tự API tạo Application/Attribution/MF03.

## Lỗi cần xử lý

- `400`: token/decision không hợp lệ.
- `403`: tài khoản đăng nhập không sở hữu Candidate của Submission.
- `404`: yêu cầu không tồn tại.
- `409`: consent đã phản hồi, hết hạn, duplicate xuất hiện ở bước kiểm tra cuối hoặc actor không còn hợp lệ.
- `429`: request công khai bị giới hạn.

## Checklist

- [ ] Candidate có tài khoản không thấy ô nhập access token.
- [ ] Candidate chưa có tài khoản dùng được link email một lần.
- [ ] Token không xuất hiện trong log/analytics.
- [ ] CV URL hết hạn thì review lại để nhận URL mới.
- [ ] Confirm/decline lặp lại không tạo dữ liệu trùng.
