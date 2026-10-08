# Trang lịch sử Submission của Affiliate

## Mục tiêu

Affiliate theo dõi các hồ sơ đã nộp, trạng thái consent, Application/Attribution sau khi xác nhận và gửi lại consent khi được phép.

Route FE đề xuất:

- `/affiliate/submissions` — danh sách;
- `/affiliate/submissions/:submissionId` — chi tiết.

## Actor và quyền

- `submission.view_own` để xem danh sách/chi tiết.
- `submission.consent.resend_own` để gửi lại consent.
- `referral.progress.view_own` để xem tiến độ referral tổng quát.
- `attribution.view_own` để xem Attribution.

## API danh sách

`GET /api/v1/affiliates/submissions`

Query hỗ trợ:

```text
status, jobId, candidateId, fromDate, toDate, page, pageSize
```

Badge trạng thái:

| Status | Nhãn |
|---|---|
| `PENDING_CONSENT` | Chờ Candidate xác nhận |
| `ACCEPTED` | Candidate đã đồng ý |
| `CONSENT_REJECTED` | Candidate từ chối |
| `CONSENT_EXPIRED` | Hết hạn xác nhận |
| `BLOCKED_DUPLICATE` | Bị chặn do trùng |
| `JOB_UNAVAILABLE` | Job không còn nhận hồ sơ |

## Trang chi tiết

`GET /api/v1/affiliates/submissions/{submissionId}`

Hiển thị:

- Candidate, Job và CV;
- trạng thái Submission/consent;
- thời điểm gửi, hạn phản hồi, thời điểm phản hồi;
- Application và Attribution nếu đã được tạo;
- trạng thái gửi email;
- nút resend khi đủ điều kiện.

## Resend consent

`POST /api/v1/affiliates/submissions/{submissionId}/consent/resend`

Chỉ hiện nút khi Submission còn `PENDING_CONSENT`. Backend kiểm tra cooldown, giới hạn số lần, vô hiệu hóa token cũ và chống hai request đồng thời.

Sau thành công:

- reload detail;
- cập nhật `expiresAt`, `resendAfter`, số lần resend và trạng thái gửi email;
- bắt đầu timer từ thời gian server, không tự cộng ở client.

Xử lý lỗi:

- `409 CONCURRENT_UPDATE`: tab/device khác vừa resend; reload detail.
- cooldown/`429`: khóa nút đến thời điểm được phép.
- consent không còn pending: ẩn nút sau khi reload.

## Tiến độ referral và Attribution

| API | Mục đích |
|---|---|
| `GET /api/v1/affiliates/referrals?jobId=&page=&pageSize=` | Tiến độ tuyển dụng tổng quát |
| `GET /api/v1/affiliates/attributions` | Lịch sử nguồn giới thiệu được ghi nhận |

Referral progress không hiển thị lịch phỏng vấn, meeting link, feedback, offer, lương hoặc tài liệu nội bộ.

## Checklist

- [ ] Filter đổi thì reset về page 1.
- [ ] Không hiện resend cho trạng thái đã kết thúc.
- [ ] Hai lần bấm resend đồng thời không tạo hai UI success.
- [ ] `ACCEPTED` mới hiển thị Application/Attribution.
- [ ] Chi tiết tuyển dụng riêng tư không xuất hiện ở trang Affiliate.
