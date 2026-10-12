# Bàn giao Backend MF-03 phục vụ Candidate Dashboard

> Người nhận: Dev phụ trách MF-03 — AI Matching, scoring và Candidate dashboard.
>
> Ngày phân công: 2026-10-12.
>
> Dashboard là read model tổng hợp. Không chuyển ownership mutation của MF-01, MF-02 hoặc MF-04 sang MF-03.

## 1. Mục tiêu

Candidate mở dashboard phải thấy ngay:

- Việc cần xử lý.
- Tình trạng hồ sơ ứng tuyển.
- CV chính và độ hoàn thiện hồ sơ.
- Kết quả AI ở mức an toàn cho người dùng.
- Job phù hợp hoặc Job mới Candidate được phép xem.

## 2. API đề xuất

```http
GET /api/v1/candidates/me/dashboard
```

Response đề xuất:

```json
{
  "success": true,
  "data": {
    "profile": {
      "completionPercent": 75,
      "missingItems": ["SKILLS", "PRIMARY_CV"]
    },
    "cv": {
      "total": 2,
      "hasPrimaryCv": true,
      "primaryCvId": "uuid",
      "primaryCvTitle": "Backend CV"
    },
    "applications": {
      "total": 8,
      "processing": 3,
      "interview": 1,
      "offer": 1,
      "completed": 2,
      "closed": 1
    },
    "pendingActions": {
      "consentCount": 1,
      "upcomingInterviewCount": 1,
      "offerAwaitingResponseCount": 1
    },
    "recentApplications": [],
    "upcomingInterviews": [],
    "offersAwaitingResponse": [],
    "recommendedJobs": []
  }
}
```

## 3. Nguồn dữ liệu

| Khối dashboard | Nguồn sự thật |
|---|---|
| Profile completion | Candidate Profile do MF-04 cung cấp |
| CV chính và CV count | Candidate CV/MF-02 |
| Application counts/recent items | MF-02 tạo Application; MF-04 sở hữu lifecycle |
| Consent đang chờ | Submission Consent/MF-02 |
| Interview sắp tới | MF-04 |
| Offer cần phản hồi | MF-04 |
| AI status/score an toàn | MF-03 |
| Job phù hợp | MF-03 scoring kết hợp Job visibility từ MF-01 |

MF-03 được đọc projection cần thiết để compose dashboard nhưng không sao chép
quy tắc mutation của module nguồn.

## 4. Quy tắc business

### 4.1 Candidate scope

- Lấy `userId` từ access token, không nhận `candidateId` từ request để cấp quyền.
- Candidate phải active, chưa archive và chưa merge.

### 4.2 Application counts

- Đếm tại database/read model, không tải 50 Application rồi đếm trong FE.
- Mapping trạng thái sang nhóm user-facing phải nằm tập trung ở backend.
- Trạng thái mới chưa được map phải làm test thất bại thay vì âm thầm biến mất.

### 4.3 Pending actions

- Consent: còn hiệu lực và chưa phản hồi.
- Interview: `SCHEDULED` trong tương lai.
- Offer: `SENT`, chưa hết hạn và chưa phản hồi.
- Mỗi item có `relatedEntityId` và route hint để FE mở đúng trang.

### 4.4 Profile completion

- Tiêu chí completion được định nghĩa tập trung ở backend.
- `missingItems` dùng code ổn định; FE chỉ dịch nhãn.
- Không cộng điểm giả cho dữ liệu hệ thống luôn bắt buộc phải có.

### 4.5 Recommended Jobs

- Chỉ Job `ACTIVE`, Candidate được phép xem và còn nhận hồ sơ theo MF-01.
- Loại Job Candidate đã có Application hoặc Submission đang chờ theo MF-02.
- Không trả `PARTNER_ONLY`/`INTERNAL_ONLY` cho Candidate.
- Nếu chưa có AI đủ tin cậy, trả Job mới phù hợp role với nguồn
  `RECENT_ELIGIBLE`, không tạo điểm AI giả.
- Không trả raw model output, dispatcher error hoặc retry count.

## 5. Hiệu năng và tính nhất quán

- Không N+1 query theo từng Application/Job.
- Dùng aggregate projection và `AsNoTracking()` cho read-only.
- Mỗi danh sách con giới hạn tối đa khoảng 5 item.
- Recommendation có thể cache ngắn hạn; pending consent/interview/offer không
  được cache lâu đến mức làm Candidate bỏ lỡ hành động.
- Nếu nguồn phụ lỗi, response phải có `partial=true` và
  `unavailableSections`; không âm thầm biến lỗi thành số 0.

## 6. Bảo mật dữ liệu AI

- Candidate chỉ nhận dữ liệu của chính mình.
- Không trả AI diagnostics, fingerprint, raw response hoặc lý do nội bộ.
- Điểm/tier chỉ trả nếu Product xác nhận Candidate được xem.
- Không trả feedback phỏng vấn, Offer draft, participant nội bộ hoặc dữ liệu
  Affiliate nhạy cảm.
- Log không ghi CV content, signed URL hoặc raw AI payload.

## 7. Test bắt buộc

1. Candidate A không đọc dữ liệu Candidate B.
2. Candidate không có CV chính nhận đúng `missingItems`.
3. Counts chính xác khi có hơn 50 Application.
4. Consent hết hạn không nằm trong pending actions.
5. Interview quá khứ và Offer hết hạn không được đếm.
6. Job sai visibility/Service Type không xuất hiện trong recommendation.
7. Job đã ứng tuyển không được gợi ý lại.
8. AI service tắt không làm dashboard trả `500`; fallback/partial hoạt động.
9. Không có N+1 query.
10. Response không chứa raw AI metadata hoặc trường nội bộ.

## 8. Thứ tự triển khai

1. Chốt DTO và mapping trạng thái Application.
2. Làm aggregate Application/CV/consent/pending actions.
3. Tích hợp Interview/Offer projection từ MF-04.
4. Tính profile completion từ contract MF-04.
5. Thêm recommendation đã lọc policy MF-01/MF-02.
6. Viết integration tests cho ownership, visibility và fallback AI.
7. Cập nhật Swagger và tài liệu FE.

## 9. Không thuộc MF-03

- Không tạo/sửa/xóa Candidate Profile.
- Không upload/xóa/adopt CV.
- Không confirm/decline consent.
- Không tạo/rút Application.
- Không tạo/dời/huỷ Interview hoặc phản hồi Offer thay Candidate.
- Không thay đổi Job visibility hoặc Service Type policy.
