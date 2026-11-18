# Tài liệu Đặc tả Toàn diện — MF-01 (Quản lý Tin tuyển dụng, Duyệt tin, Hợp đồng dịch vụ, Gói đăng tin & Đặt cọc)

> **Tài liệu liên quan:**
> - [`review.md`](review.md): Báo cáo kiểm định Production Readiness MF-01 (**24/24** hạng mục BE & FE đã hoàn tất).
> - [`../main-flows.md`](../main-flows.md): Đặc tả luồng nghiệp vụ tổng thể mục MF-01.
> - [`../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md): Quy tắc phí đăng tin, đặt cọc và điều khoản thương mại theo 3 gói dịch vụ.
> - Hướng dẫn tích hợp Frontend: [`../../../HRConnect-FE/docs/integration/MF01/`](../../../HRConnect-FE/docs/integration/MF01/).

---

## 1. Mô hình Dịch vụ & Phân quyền Tiếp cận Job (`JobAccessPolicy`)

Mỗi tin tuyển dụng (`Job`) gắn cố định với **1 trong 3 loại dịch vụ (`ServiceType`)** ngay từ khi tạo. Quyền xem (`can_view`) và nộp hồ sơ (`can_submit`) được quyết định động qua bảng `service_type_allowed_role` (do Platform Admin cấu hình):

| Mã dịch vụ (`ServiceType.Code`) | Đối tượng xem & nộp mặc định | Cơ chế thương mại & Kích hoạt tin |
| :--- | :--- | :--- |
| **`CV_APPLICATION`** | **Candidate** (và khách vãng lai xem) | Chọn gói đăng tin (`PostingPackage`: `FREE` hoặc trả phí `STANDARD`). Gói `FREE` kích hoạt ngay khi HR duyệt; gói trả phí chuyển `PENDING_PAYMENT` chờ thanh toán `JobPostingFee`. |
| **`HEADHUNT_COD`** | **Affiliate** | Ký thỏa thuận dịch vụ (`ServiceAgreement`) chốt hệ số phí (`FeeMultiplier`), số ngày bảo hành (`WarrantyDays`) và hạn thanh toán (`PaymentDueDays`). Kích hoạt `ACTIVE` ngay sau khi thỏa thuận được ký/xác nhận. |
| **`CV_SOURCING`** | **Affiliate** | Ký thỏa thuận dịch vụ chốt `SourcingTarget`, `PricePerQualifiedCv`, `DepositPercent`, `ReviewDays`. Nếu `DepositPercent > 0`, chuyển `PENDING_PAYMENT` và chỉ mở `ACTIVE` sau khi thu cọc (`DEPOSIT`). |

---

## 2. Vòng đời Trạng thái Job (`JobStatuses` & `JobTransitions`)

```text
DRAFT ──(SubmitJob)──► PENDING_REVIEW ──(CreateProposal: Headhunt/Sourcing)──► PENDING_AGREEMENT
  ▲                          │                                                        │
  │                          ├──(RejectJob)──────────────────────────────┐            │ (Sign OTP / Upload Signed PDF)
  │                          ▼                                           ▼            ▼
  └────(UpdateJob)─────── REJECTED                                  PENDING_PAYMENT ──┴──► ACTIVE ⇄ PAUSED
                                                                                              │        │
                                                                                              ▼        ▼
                                                                                         CLOSED / EXPIRED
```

- **Kiểm soát quyền sở hữu doanh nghiệp (`JobHandlerGuards.GetOwnedJobAsync`):** Mọi thao tác của Client (`CreateJob`, `UpdateJob`, `SubmitJob`, `PauseJob`, `ResumeJob`, `CloseJob`, `GetMyJobs`) đều bắt buộc tài khoản thuộc công ty sở hữu Job và có `CompanyMembershipPolicy.IsActive(member) == true`.
- **Lịch sử trạng thái (`JobStatusHistory`):** Mọi bước chuyển trạng thái (kể cả khi gửi lại đề xuất thỏa thuận `v2+` ở `PENDING_AGREEMENT`) đều ghi nhận người thực hiện, trạng thái cũ/mới, mã lý do và thời điểm.
- **Chống ghi đè đồng thời:** Bảo vệ bằng `ConcurrencyToken` trên toàn bộ lệnh cập nhật và duyệt Job.

---

## 3. Thư viện Mẫu JD (`JobTemplates`) & Danh mục Ngành nghề (SF-09)

1. **Thư viện mẫu JD (`Features/JobTemplates`):**
   - Quản lý bởi Internal HR / Platform Admin (quyền `job_template.manage`), seed sẵn 13 mẫu chuẩn theo `Code`, mỗi mẫu bắt buộc có ít nhất 1 yêu cầu `MUST_HAVE`.
   - Khi Client tạo Job từ mẫu (`templateId`), hệ thống tạo bản sao độc lập các yêu cầu (`JobRequirement` gồm `MUST_HAVE` và `SHOULD_HAVE`) và tăng `usage_count` của mẫu.
2. **Danh mục Công ty, Ngành nghề & Bộ lọc Job:**
   - Hệ thống phân cấp ngành nghề (`Industry` 3 cấp) và quy mô công ty (`CompanySize`).
   - Hỗ trợ lọc Job công khai và nội bộ theo từ khóa, địa điểm, hình thức làm việc, mức lương, số năm kinh nghiệm (`experienceYears`) và danh mục chuyên môn.

---

## 4. Hợp đồng Dịch vụ Thương mại (`ServiceAgreements` — `HEADHUNT_COD` & `CV_SOURCING`)

1. **Tạo & Gửi lại đề xuất điều khoản (`CreateServiceAgreementProposalCommand`):**
   - Internal HR / Admin soạn đề xuất từ trạng thái `PENDING_REVIEW` hoặc gửi bản cập nhật (`v2+`) khi đang ở `PENDING_AGREEMENT`.
   - Hệ thống tự động resolve và lưu đầy đủ các thông số điều khoản (bao gồm giá trị mặc định từ `IAdminBusinessSettings` nếu để trống: `FeeMultiplier`, `WarrantyDays`, `PaymentDueDays`, `SourcingTarget`, `PricePerQualifiedCv`, `DepositPercent`, `ReviewDays`).
   - Render file PDF hợp đồng qua `AgreementPdfRenderer` (sử dụng mốc thời gian cố định `SignedAt ?? CreatedAt` theo giờ Việt Nam để giữ `DocumentSha256Hash` nhất quán).
2. **Hai phương thức ký kết của Client:**
   - **Ký điện tử bằng OTP (`RequestServiceAgreementOtpCommand` & `SignServiceAgreementCommand`):**
     - Chỉ dành cho người liên hệ chính (`IsPrimaryContact`), giới hạn tối đa 5 OTP/ngày, thời gian chờ gửi lại 60 giây, khóa mã sau 5 lần nhập sai.
     - Sau khi ký thành công: tự động chốt điều khoản lên `Job`. Với `HEADHUNT_COD` (hoặc `CV_SOURCING` có `DepositPercent == 0`), Job chuyển thẳng sang `ACTIVE`; với `CV_SOURCING` có cọc, hệ thống tạo phiếu `ServiceFee (Kind = DEPOSIT, Status = PENDING)` và chuyển Job sang `PENDING_PAYMENT`.
   - **Tải lên bản hợp đồng ký ướt (`UploadSignedServiceAgreementCommand`):**
     - Kiểm tra định dạng PDF, tính và lưu `DocumentSha256Hash`, chặn tải đè nếu hợp đồng đã `SIGNED`, `VOID` hoặc đang `CHANGE_REQUESTED`.
     - Khi HR bấm xác nhận & công khai tin (`ApproveJobCommand`), hệ thống kế thừa đầy đủ điều khoản đã thương lượng từ `job.CurrentServiceAgreement`, cập nhật thỏa thuận sang `SIGNED` trên tracked entity và chuyển Job sang `PENDING_PAYMENT` hoặc `ACTIVE`.
3. **Yêu cầu chỉnh sửa & Hủy dự thảo:**
   - Client có thể gửi yêu cầu điều chỉnh điều khoản (`RequestServiceAgreementChangeCommand` → `CHANGE_REQUESTED`).
   - HR có thể hủy bản dự thảo (`VoidServiceAgreementCommand` → `VOID`, đồng thời xóa `job.CurrentServiceAgreementId` và gửi thông báo cho Client) hoặc từ chối Job ngay từ `PENDING_AGREEMENT` (`RejectJobCommand` tự động void thỏa thuận chưa ký).

---

## 5. Gói Đăng tin (`CV_APPLICATION`), Đặt cọc (`CV_SOURCING`) & Hết hạn Tin

1. **Quản lý phí gói đăng tin (`JobPostingFee`):**
   - Gói `FREE`: Kiểm tra giới hạn số tin `ACTIVE` đồng thời (`mf01.cv_application.free_active_limit`) và thời gian chờ mở lại (`mf01.cv_application.free_cooldown_months`).
   - Đồng bộ phí khi thay đổi gói (`UpdateJobCommandHandler` & `SubmitJobCommand`): Nếu Client đổi từ gói `FREE` sang `STANDARD` (hoặc ngược lại, hoặc đổi `ServiceType`) trước khi duyệt/gửi duyệt lại, bản ghi `JobPostingFee` hiện có được đồng bộ lại đúng số tiền và trạng thái `PENDING`/`CANCELLED`, chống triệt để việc kích hoạt gói trả phí miễn phí.
2. **Thanh toán phí đăng tin & tiền cọc:**
   - Hỗ trợ thanh toán trực tuyến qua **VNPay** (`POST /api/v1/payments/vnpay`) hoặc Platform Admin đối chiếu sao kê xác nhận thủ công (`RecordJobPostingFeePaymentCommand`, `ConfirmJobDepositCommand`).
   - Khi thu phí/cọc hoàn tất, Job tự động chuyển từ `PENDING_PAYMENT` sang `ACTIVE`, ghi `JobStatusHistory` và bắn thông báo SignalR (`SERVICE_FEE` / `ONLINE_PAYMENT` / `JOB`).
3. **Tự động đóng tin hết hạn (`JobExpirationWorker`):**
   - Quét định kỳ các Job quá `ApplicationDeadline` hoặc hết thời hạn gói đăng tin (`PostingPackage.DurationDays`), chuyển sang `EXPIRED` và gửi thông báo phù hợp theo loại gói cho doanh nghiệp.
