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

## 10. Bổ sung 2026-10-12: lỗ hổng và phần còn thiếu

Rà soát đối chiếu với schema hiện tại (`ApplicationDbContext`, entity `Application`, `Offer`, `Interview`,
`SubmissionConsent`, `Candidate`). Mục này **bổ sung**, không thay các mục 1–9. Chỗ có **[CẦN XÁC NHẬN]**
là quyết định của Product; trong lúc chờ, làm theo phương án **đề xuất**.

### 10.1 Không lộ trạng thái và lý do nội bộ (bảo mật)

Application có 15 trạng thái (`ck_application_status`). Candidate **không** nhận trạng thái gốc, chỉ nhận
nhóm hiển thị (`displayGroup`) và nhãn đã chuẩn hoá. Bảng mapping đề xuất:

| Trạng thái gốc | `displayGroup` | Ghi chú |
|---|---|---|
| `SUBMITTED`, `SCREENING`, `SHORTLISTED`, `BACKUP` | `PROCESSING` | `BACKUP` là kho dự phòng nội bộ CV_SOURCING, Candidate chỉ thấy "Đang xử lý" |
| `INTERVIEW` | `INTERVIEW` | |
| `OFFER_PENDING` | `OFFER` | Chỉ khi có Offer `SENT` (xem 10.5) |
| `OFFER_ACCEPTED`, `PLACED` | `COMPLETED` | |
| `REJECTED`, `INTERVIEW_FAILED`, `BACKUP_NOT_SELECTED`, `OFFER_DECLINED`, `NOT_STARTED`, `WITHDRAWN`, `CLOSED` | `CLOSED` | Nhãn chung "Đã kết thúc"; `WITHDRAWN` / `OFFER_DECLINED` hiện "Bạn đã rút / từ chối" |

- **Không trả** `reasonCode`, `statusReason`, ghi chú HR, điểm sàng lọc, tên người sàng lọc.
- Mapping đặt **một chỗ** ở backend; test duyệt toàn bộ giá trị của `ck_application_status`, có giá trị chưa map thì test **fail**.
- **[CẦN XÁC NHẬN]** Có cho Candidate thấy một lý do chung khi bị loại (ví dụ "Hồ sơ chưa phù hợp yêu cầu") không. Đề xuất: chỉ nhãn chung, không lý do.

### 10.2 Consent: xác định "của tôi" an toàn (bảo mật)

`submission_consent` **không có `CandidateId`**, chỉ có `RecipientEmail`. Quy tắc:

- Lấy consent qua `Submission.CandidateId` ∈ tập Candidate của user (xem 10.3), **hoặc**
  `RecipientEmail` trùng (sau chuẩn hoá) với một email **đã xác minh** của user (`user_email_identity.status = 'VERIFIED'`).
- **Không** so khớp với email chưa xác minh hoặc email do Affiliate nhập trên hồ sơ.
- "Đang chờ" = `status = 'PENDING'` **và** `expires_at > now()`.
- Chỉ trả: tên Job, tên công ty (nếu được phép hiển thị), hạn phản hồi, `consentId`. **Không trả** `TokenHash`, IP, user agent, lỗi gửi email.

### 10.3 Tập Candidate của user: hồ sơ do Affiliate tạo và hồ sơ đã gộp

- Tập Candidate của user = Candidate có `UserId = user` **cộng** các Candidate có `MergedIntoCandidateId` trỏ vào nó.
- Đếm Application và lấy danh sách trên **toàn bộ tập này**, nếu không số liệu sẽ thiếu sau khi gộp hồ sơ.
- Candidate do Affiliate tạo nhưng **chưa** được claim/merge thì **không** thuộc user (không đoán theo email/số điện thoại).
- Candidate gốc có `Status` archive hoặc đã bị merge vào bản ghi khác: trả `409` kèm mã ổn định, FE hướng dẫn đăng nhập lại; **[CẦN XÁC NHẬN]** mã lỗi.

### 10.4 Đơn do Affiliate nộp (HEADHUNT_COD, CV_SOURCING)

- **Đề xuất:** Candidate chỉ thấy Application **sau khi đã `CONFIRMED` consent**. Trước đó chỉ hiện ở khối consent đang chờ. **[CẦN XÁC NHẬN]**
- Không trả tên, liên hệ, hoa hồng của Affiliate. Có thể trả `source = AFFILIATE_REFERRAL` để FE ghi "Được giới thiệu".

### 10.5 Interview và Offer

- **Interview sắp tới:** `status = 'SCHEDULED'` và `scheduled_at > now()`. Nếu MF-04 bổ sung trạng thái dời lịch thì phải thêm vào danh sách này.
  - Trả: thời gian, thời lượng, vòng, hình thức, địa điểm, link họp.
  - **Không trả:** `Feedback`, `Result`, `InterviewParticipants`, `RecordedBy`.
- **Offer chờ phản hồi:** `status = 'SENT'`, `responded_at IS NULL`, chưa hết hạn.
  - Offer `DRAFT` / `PENDING_APPROVAL` **tuyệt đối không** trả.
  - Trả: lương, tiền tệ, ngày bắt đầu, hạn phản hồi, `offerId`. **Không trả** `OfferApprovals`, người tạo.
- **Múi giờ:** `Offer.ExpiryDate` là `DateOnly`; tính hết hạn theo **giờ Việt Nam (Asia/Ho_Chi_Minh)**. Offer hạn ngày D vẫn còn hiệu lực tới 23:59:59 ngày D giờ VN. Interview so sánh bằng UTC.

### 10.6 Job gợi ý: loại dịch vụ

- Ngoài lọc visibility (mục 4.5), chỉ gợi ý Job mà Candidate **tự ứng tuyển được** theo quy tắc MF-01 (đề xuất: `CV_APPLICATION`).
- Job HEADHUNT_COD / CV_SOURCING đi qua Affiliate thì không gợi ý **[CẦN XÁC NHẬN với MF-01]**.
- MF-03 chỉ **đọc** policy của MF-01, không tự định nghĩa lại.

### 10.7 Khối dashboard đang có ở FE nhưng tài liệu chưa nhắc

| Khối | Hiện trạng FE | Bổ sung |
|---|---|---|
| Công tắc "Đang tìm việc" | Lưu `localStorage` | Đọc `Candidate.ProfileVisibility`; trả `profile.visibility`. Việc **đổi** thuộc MF-04 |
| Job đã lưu | Hook `useSavedJobs` | Trả `savedJobCount` nếu backend đã có dữ liệu; nếu chưa có thì ghi rõ "chưa hỗ trợ" |
| Thông báo chưa đọc | — | Trả `unreadNotificationCount` (đọc từ bảng notification) |

### 10.8 Đặc tả API còn thiếu

- **Quyền:** chỉ role `CANDIDATE`; role khác nhận `403`. **[CẦN XÁC NHẬN]** mã permission (đề xuất `candidate.dashboard.view`).
- **Candidate mới chưa có hồ sơ:** trả `200` với số 0, `missingItems` đầy đủ; **không** trả `404`.
- **Response đầy đủ** (bổ sung vào mẫu ở mục 2):

```json
{
  "partial": false,
  "unavailableSections": [],
  "profile": { "completionPercent": 75, "missingItems": ["SKILLS"], "visibility": "PUBLIC" },
  "pendingActions": [
    { "type": "CONSENT", "relatedEntityId": "uuid", "route": "CONSENT_DETAIL", "dueAt": "2026-10-20T16:59:59Z" },
    { "type": "INTERVIEW", "relatedEntityId": "uuid", "route": "INTERVIEW_DETAIL", "dueAt": "..." },
    { "type": "OFFER", "relatedEntityId": "uuid", "route": "OFFER_DETAIL", "dueAt": "..." }
  ],
  "recentApplications": [
    { "applicationId": "uuid", "jobId": "uuid", "jobTitle": "...", "companyName": "...",
      "displayGroup": "PROCESSING", "source": "DIRECT", "updatedAt": "..." }
  ],
  "recommendedJobs": [
    { "jobId": "uuid", "title": "...", "companyName": "...", "source": "AI_MATCH | RECENT_ELIGIBLE" }
  ]
}
```

- `route` là **mã** ổn định, FE tự map sang URL; backend không trả URL.
- Điểm/tier AI **không** có trong response cho tới khi Product xác nhận (mục 6).

### 10.9 Điểm AI cũ

- Điểm lấy từ `CandidateJobMatch` / `AiMatchResult` gắn với **CV chính hiện tại**. Nếu đổi CV chính, điểm của CV cũ **không** được dùng.
- Job đã sửa yêu cầu sau thời điểm chấm điểm: coi như chưa có điểm, dùng nguồn `RECENT_ELIGIBLE`.
- **[CẦN XÁC NHẬN]** Thời điểm chấm lại (khi đổi CV chính, khi Job mới `ACTIVE`). Việc chấm điểm là của MF-03, dashboard chỉ đọc.

### 10.10 Test bổ sung (nối vào mục 7)

11. Response không chứa `BACKUP`, `SCREENING`, `reasonCode`, `statusReason` hoặc ghi chú HR.
12. Mọi giá trị của `ck_application_status` đều có `displayGroup`.
13. Consent gửi tới email **chưa xác minh** trùng email user **không** xuất hiện.
14. Consent của Candidate khác cùng tên/số điện thoại không xuất hiện.
15. Application của Candidate đã merge vào user được đếm; Candidate do Affiliate tạo chưa claim thì không.
16. Đơn do Affiliate nộp chưa `CONFIRMED` consent không nằm trong `recentApplications` (nếu chốt 10.4).
17. Offer `DRAFT` / `PENDING_APPROVAL` không xuất hiện; Offer hạn hôm nay (giờ VN) vẫn xuất hiện lúc 23:30 giờ VN.
18. Interview không trả `Feedback`, `Result`, người phỏng vấn nội bộ.
19. Job HEADHUNT_COD / CV_SOURCING không có trong gợi ý (nếu chốt 10.6).
20. Role khác `CANDIDATE` nhận `403`; Candidate mới chưa có hồ sơ nhận `200`.
