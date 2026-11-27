# Cẩm Nang Tổng Hợp Toàn Bộ Logic & Nghiệp Vụ — MF-02 (Dùng Ôn Tập Review 3)

Tài liệu này gom toàn bộ **luật nghiệp vụ, vòng đời trạng thái (State Machines), các trường hợp biên (Edge Cases) và câu hỏi phản biện thực tế của MF-02** từ hơn 15 file tài liệu rời rạc về **1 file duy nhất** để đọc nhanh trước khi bảo vệ.

---

## 1. Bản chất của MF-02 trong toàn hệ thống HR Connect

* **MF-01** đã tạo ra các **Job đang `ACTIVE`** thuộc 3 gói dịch vụ: `CV_APPLICATION`, `HEADHUNT_COD`, `CV_SOURCING`.
* **MF-02** giải quyết câu hỏi: **"Làm sao hồ sơ ứng viên đi vào được Job một cách hợp lệ, không bị trùng lặp, có sự đồng ý của ứng viên, và xác định chính xác Affiliate nào được hưởng hoa hồng (`Attribution`)?"**
* Khi một hồ sơ vượt qua toàn bộ chốt chặn của **MF-02**, kết quả đầu ra là:
  1. Một bản ghi **`Application` ở trạng thái `SUBMITTED`** (để chuyển sang **MF-03** cho AI chấm điểm và HR sàng lọc).
  2. Một bản ghi **`Attribution` ở trạng thái `ACTIVE`** (nếu do Affiliate giới thiệu — để sau này **MF-05** tính hoa hồng cho đúng người).

---

## 2. Quy Tắc Phân Quyền Nộp Hồ Sơ Theo 3 Loại Dịch Vụ (Luật Số 1)

| Loại dịch vụ Job | Ai được phép nộp? | Ai BỊ CHẶN nộp? | Có cần ứng viên xác nhận Consent 48h không? | Khi nào tạo `Application (SUBMITTED)`? |
| :--- | :--- | :--- | :--- | :--- |
| **`CV_APPLICATION`** *(Đăng tin tuyển dụng)* | **Candidate** (Ứng viên tự ứng tuyển) | Affiliate bị chặn (`403 Forbidden`) | **Không** (Vì chính chủ tự bấm nộp) | Tạo **ngay lập tức** khi Candidate bấm nộp (`Submission = ACCEPTED` $\rightarrow$ `Application = SUBMITTED`). |
| **`HEADHUNT_COD`** *(Săn đầu người trả phí khi đi làm)* | **Affiliate** (Cộng tác viên săn đầu người) | Candidate không tự nộp trực tiếp được | **Bắt buộc có** (`SubmissionConsent` hạn 48h) | Chỉ tạo **sau khi Candidate bấm `CONFIRM` (Đồng ý)** và không vướng ca nghi trùng cùng Job. |
| **`CV_SOURCING`** *(Mua gói số lượng CV đạt chuẩn)* | **Affiliate** (Cộng tác viên giới thiệu nguồn CV) | Candidate không tự nộp trực tiếp được | **Bắt buộc có** (`SubmissionConsent` hạn 48h) | Chỉ tạo **sau khi Candidate bấm `CONFIRM` (Đồng ý)** (sau đó HR lọc `SHORTLISTED` mới giao cho Client). |

---

## 3. Logic Nghiệp Vụ Quản Lý CV & Quyền Tái Sử Dụng CV (`CandidateCv`)

### 3.1. 3 Nguồn tạo CV trong hệ thống (`SourceType`)
1. **`CANDIDATE_UPLOAD`:** Ứng viên tự tải file PDF lên Kho CV cá nhân.
2. **`CV_BUILDER`:** Ứng viên tạo CV trên trình duyệt bằng công cụ kéo/thả có cấu trúc (`CandidateCvBuilderPage`) $\rightarrow$ Backend dùng **SkiaSharp (`CvPdfRenderer`)** xuất ra file PDF chuẩn.
3. **`AFFILIATE_UPLOAD`:** Affiliate tải file PDF của ứng viên lên khi giới thiệu ứng viên vào một Job.

> **Kiểm tra an toàn & chống trùng file PDF:** Mọi file PDF (dù upload hay xuất từ CV Builder) đều đi qua `PdfCvValidator` để kiểm tra chữ ký `%PDF-`, dung lượng $\le 10\text{MB}$, không khóa mật khẩu, lưu lên **Cloudflare R2**, và băm toàn bộ nội dung nhị phân ra mã **`ContentSha256`** (`FingerprintVersion = "binary-sha256-v1"`).

### 3.2. Khi nào Affiliate được dùng lại CV trong Kho CV của mình?
Khi Affiliate đã từng giới thiệu 1 ứng viên, CV đó nằm trong **Kho CV của Affiliate**. Để dùng lại CV đó nộp sang một Job khác mà không cần upload lại file PDF, hệ thống bắt buộc kiểm tra đủ **5 điều kiện**:
1. CV đó phải thuộc đúng `CandidateId` đang giới thiệu.
2. `SourceType == "AFFILIATE_UPLOAD"`.
3. `UploadedByUserId == AffiliateUserId` (chính Affiliate đó là người tải lên, không dùng chéo CV của Affiliate khác).
4. `Status == "ACTIVE"` và **`AffiliateReuseStatus == "ALLOWED"`** (Ứng viên chưa tắt quyền cho phép dùng lại).
5. CV đó **đã có ít nhất 1 lượt `Submission` trước đó được ứng viên xác nhận (`Status == "ACCEPTED"`)**. *(Tránh việc Affiliate vừa upload đại 1 CV chưa từng được ứng viên đồng ý đã mang đi rải khắp các Job khác).*

> **Lưu ý quan trọng:** Dù Affiliate được phép dùng lại file CV trong kho để nộp sang **Job B**, ứng viên **vẫn phải nhận email xin xác nhận Consent 48h cho Job B**! Quyền `AffiliateReuseStatus = ALLOWED` chỉ cho phép dùng lại **file PDF**, chứ không bao giờ bỏ qua bước xin phép ứng viên ở từng Job mới.

---

## 4. Logic Bảo Vệ Danh Tính & Chống Gian Lận Số Điện Thoại (`Strict Identity Match`)

Đây là nghiệp vụ rất hay được hội đồng hỏi: **"Lỡ Affiliate cố tình sửa số điện thoại của ứng viên thành số của mình để tự bấm đồng ý hoặc qua mặt hệ thống thì sao?"**

Hệ thống xử lý bằng cơ chế **Strict Identity Match & Contact Snapshot**:
1. **Chuẩn hóa dữ liệu (`Normalization`):**
   * Email được chuyển về chữ thường, cắt khoảng trắng (`NormalizedEmail`).
   * Số điện thoại Việt Nam được chuẩn hóa về cùng 1 định dạng chuẩn (`+84...` / `0...` $\rightarrow$ `NormalizedPhone`).
2. **Chặn xung đột chéo (`CANDIDATE_IDENTITY_CONFLICT`):**
   * Nếu Affiliate nhập `Email A` (đang thuộc về Hồ sơ Ứng viên 1) nhưng lại nhập `SĐT B` (đang thuộc về Hồ sơ Ứng viên 2) $\rightarrow$ Hệ thống **chặn ngay lỗi `409 Conflict`**, không cho nộp.
3. **Bảo vệ hồ sơ chính chủ đã xác thực (`Contact Hijacking Protection`):**
   * Nếu Ứng viên đã có tài khoản xác thực (`UserId != null`) với `Email A` và `SĐT gốc A`, mà Affiliate nộp `Email A` kèm một `SĐT lạ B != A` $\rightarrow$ Hệ thống **chặn ngay `409 Conflict`**, tuyệt đối không ghi đè SĐT lạ vào hồ sơ gốc của ứng viên.
4. **Cơ chế Snapshot liên hệ khi ứng viên chưa có tài khoản (`SubmissionContactSnapshot`):**
   * Nếu ứng viên chưa từng tạo tài khoản (`UserId == null`), họ tên và SĐT do Affiliate cung cấp được lưu đóng băng (snapshot) vào ngay bản ghi lượt nộp đó (`Submission.SubmittedFullName`, `Submission.SubmittedPhone`).
   * Sau này khi ứng viên dùng chính `Email A` đó để tự đăng ký tài khoản chính chủ (`RegisterCandidate` + xác thực OTP), hệ thống tự động nối tài khoản đó vào hồ sơ `Candidate` có sẵn (`CandidateRegistrationIdentity`), cho phép ứng viên cập nhật SĐT chính chủ vào hồ sơ gốc, đồng thời giữ nguyên lịch sử các lượt giới thiệu trước đó.

---

## 5. Vòng Đời Xin Xác Nhận Đồng Ý 48 Giờ (`SubmissionConsent`)

Khi Affiliate nộp ứng viên vào Job `HEADHUNT_COD` hoặc `CV_SOURCING`:
1. **`Submission`** được tạo ở trạng thái **`PENDING_CONSENT`**.
2. **`SubmissionConsent`** được tạo ở trạng thái **`PENDING`** với:
   * Thời hạn: **`ExpiresAt = CreatedAt + 48 giờ`**.
   * Bảo mật Token: Hệ thống sinh chuỗi ngẫu nhiên 32 bytes (`rawToken`), gửi link `/consent#token=<rawToken>` qua email cho ứng viên, và **chỉ lưu mã băm `SHA-256` (`TokenHash`) trong Database** (kể cả lộ DB cũng không lấy được link xác nhận).
   * Trên trình duyệt (`PublicSubmissionConsentPage.tsx`), token nằm sau dấu `#` (URL Fragment nên không bị gửi lên server log hay Referer header) và bị xóa khỏi thanh địa chỉ ngay khi trang vừa tải xong.

### 4 Trường hợp kết thúc của `SubmissionConsent`:

| Hành động / Sự kiện | Trạng thái `SubmissionConsent` | Trạng thái `Submission` | Hệ quả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **1. Ứng viên bấm `CONFIRM` (Đồng ý)** *(không có ca nghi trùng cùng Job)* | **`CONFIRMED`** | **`ACCEPTED`** | Tạo **`Application (SUBMITTED)`** + Tạo **`Attribution (ACTIVE)`** cho Affiliate + Đẩy sang **MF-03 chấm điểm AI**. |
| **1b. Ứng viên bấm `CONFIRM` (Đồng ý)** *(nhưng đang có `CandidateDuplicateCase` cùng Job)* | **`CONFIRMED`** | **`PENDING_IDENTITY_REVIEW`** | Chưa tạo Application ngay; tạm giữ để chờ Platform Admin phân xử gộp/bác bỏ ca nghi trùng. |
| **2. Ứng viên bấm `DECLINE` (Từ chối)** | **`DECLINED`** | **`CONSENT_REJECTED`** | Dừng luồng, không tạo Application, báo cho Affiliate biết ứng viên từ chối. |
| **3. Ứng viên bấm `REPORT_UNAUTHORIZED` (Báo cáo không quen biết / chưa cho phép)** | **`DECLINED`** | **`CONSENT_REJECTED`** | Dừng luồng + **Thu hồi vĩnh viễn quyền dùng lại CV đó của Affiliate (`CandidateCv.AffiliateReuseStatus = REVOKED`)** + Lưu IP/User-Agent & cảnh báo Affiliate. |
| **4. Quá 48 giờ ứng viên không phản hồi** *(Worker `SubmissionConsentExpiryWorker` quét)* | **`EXPIRED`** | **`CONSENT_EXPIRED`** | Tự động hủy hiệu lực link; một Affiliate khác (hoặc chính ứng viên) có thể nộp lại. |

> **Quy tắc gửi lại email (`ResendSubmissionConsent`):** Khi Consent đang `PENDING`, Affiliate được phép bấm gửi lại email nhắc ứng viên nhưng bị giới hạn **thời gian chờ (cooldown)** giữa 2 lần gửi và **số lần gửi tối đa** để chống spam ứng viên.

---

## 6. Quy Tắc Ghi Nhận Nguồn Giới Thiệu & Hoa Hồng (`Attribution` — Ai Thắng?)

Hội đồng rất hay hỏi: **"Nếu Affiliate A và Affiliate B cùng giới thiệu 1 ứng viên vào cùng 1 Job thì hệ thống xử lý thế nào? Ai được tính hoa hồng?"**

* **Trường hợp 1 — Cùng Email / Cùng SĐT trên cùng 1 Job (Trùng trực tiếp):**
  * Ngay khi **Affiliate A** nộp thành công và đang chờ ứng viên xác nhận (`PENDING_CONSENT`) hoặc đã được xác nhận (`ACCEPTED`), nếu **Affiliate B** nộp cùng ứng viên đó vào cùng Job $\rightarrow$ Hệ thống **chặn ngay từ lúc Affiliate B bấm nộp**, lưu vết lượt nộp của B thành `BLOCKED_DUPLICATE` (`DuplicateOfSubmissionId` trỏ về lượt nộp của A) và trả lỗi `409 Conflict`.
  * Chỉ khi lượt nộp của Affiliate A bị ứng viên **Từ chối (`CONSENT_REJECTED`)** hoặc **Quá hạn 48h không xác nhận (`CONSENT_EXPIRED`)**, ứng viên đó mới được mở khóa để Affiliate khác nộp vào Job đó.
* **Trường hợp 2 — Cố tình dùng 2 Email/SĐT khác nhau cho cùng 1 người trên cùng 1 Job (Nghi trùng qua mã băm file CV `ContentSha256` hoặc Họ tên):**
  * Hệ thống phát hiện tín hiệu trùng và mở ca **`CandidateDuplicateCase (RiskLevel = "HIGH")`**.
  * Khi ứng viên bấm `CONFIRM`, các lượt nộp bị giữ ở trạng thái **`PENDING_IDENTITY_REVIEW`**.
  * Khi Platform Admin xác nhận 2 hồ sơ là 1 người (`MERGE`), dịch vụ `FinalizeIdentityReviewedSubmissionService` áp dụng quy tắc **`EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION`**:
    * **Affiliate nào được ứng viên bấm `CONFIRM` (Đồng ý) hợp lệ sớm nhất** sẽ thắng (`Submission = ACCEPTED`, nhận `Attribution = ACTIVE`).
    * Lượt nộp của Affiliate còn lại (kể cả đang ở `PENDING_IDENTITY_REVIEW` hay `PENDING_CONSENT`) đều tự động chuyển sang `BLOCKED_DUPLICATE`.

---

## 7. Quyền Sở Hữu Ứng Viên Của Doanh Nghiệp (`Client Ownership`)

* Đối với dịch vụ **`HEADHUNT_COD`**: Nếu ứng viên đã từng thuộc quyền sở hữu hợp lệ của công ty Client đó (ví dụ đã được tuyển dụng/nộp trong thời hạn bảo hộ của Client), khi Affiliate nộp ứng viên đó vào Job `HEADHUNT_COD` của chính công ty đó $\rightarrow$ Hệ thống chặn ngay với mã lỗi **`409 CANDIDATE_OWNED_BY_CLIENT`** (doanh nghiệp không phải trả phí săn đầu người cho nhân sự vốn đã thuộc sở hữu của họ).

---

## 8. Phân Biệt 2 Cơ Chế Gộp Hồ Sơ: `CandidateIdentityClaim` vs `CandidateDuplicateCase`

Trong MF-02 có 2 bảng dễ nhầm tên, Trí nhớ phân biệt rõ nếu thầy cô hỏi:

| Tiêu chí | `CandidateIdentityClaim` (UC-48) | `CandidateDuplicateCase` |
| :--- | :--- | :--- |
| **Ai khởi tạo?** | **Do chính Ứng viên chủ động yêu cầu** trong cổng Candidate (`/candidate/identity`). | **Do Hệ thống tự động phát hiện** khi quét thấy tín hiệu trùng (SHA-256 CV, Tên, Email, SĐT). |
| **Mục đích** | Ứng viên đã đăng ký tài khoản bằng `Email 1`, nay muốn **nhận lại (claim)** một hồ sơ `Candidate` cũ từng được Affiliate tạo bằng `Email 2` của mình để gom lịch sử ứng tuyển về 1 tài khoản. | Ngăn chặn 2 hồ sơ trùng của cùng 1 người cùng ứng tuyển vào 1 Job gây trùng lặp pipeline và tranh chấp hoa hồng Affiliate. |
| **Quy trình xác thực** | 1. Ứng viên nhập email hồ sơ cũ $\rightarrow$ Hệ thống gửi **OTP** về email đó.<br>2. Ứng viên nhập đúng OTP $\rightarrow$ Chuyển sang chờ **Platform Admin** kiểm tra CV và bấm duyệt gộp (`Approve`). | 1. Hệ thống tạo ca nghi trùng (`RiskLevel = LOW/MEDIUM/HIGH`).<br>2. Với ca `HIGH` hoặc gắn với `JobId`, bắt buộc **Platform Admin** xem trước (`PreviewMerge`) và phân xử `MERGE` hoặc `DISMISS`. |
| **Kết quả sau khi gộp (`MERGE`)** | Hồ sơ phụ bị đóng (`Status = "MERGED"`, `MergedIntoCandidateId = CanonicalCandidateId`), toàn bộ CV + lịch sử ứng tuyển gom về hồ sơ chính nhưng **giữ nguyên `Attribution` của Affiliate cũ**. | Hồ sơ phụ gộp về hồ sơ chính + **Giải phóng các đơn `PENDING_IDENTITY_REVIEW`** trên Job theo người được `CONFIRM` sớm nhất. |

---

## 9. Top 5 Câu Hỏi Vấn Đáp Nhanh MF-02 Khi Bảo Vệ Review 3

1. **Hỏi:** *"Tại sao Candidate nộp đơn thì không cần Consent, còn Affiliate nộp thì phải có Consent 48h?"*
   * **Đáp:** Dạ vì khi Candidate tự nộp (`CV_APPLICATION`) là chính chủ đã đăng nhập và tự bấm nút ứng tuyển. Còn khi Affiliate nộp (`HEADHUNT_COD` / `CV_SOURCING`), Affiliate là bên thứ ba giới thiệu hồ sơ; để tuân thủ bảo vệ dữ liệu cá nhân và tránh việc headhunter tự ý rải CV khi ứng viên không hề biết, hệ thống bắt buộc gửi link xác nhận có hiệu lực 48 giờ cho ứng viên. Chỉ khi ứng viên bấm `CONFIRM` thì đơn ứng tuyển (`Application`) và quyền hưởng hoa hồng (`Attribution`) mới được tạo ạ.
2. **Hỏi:** *"Nếu ứng viên phát hiện một Affiliate lạ tự ý lấy CV của mình đi nộp thì ứng viên làm gì được trên hệ thống?"*
   * **Đáp:** Dạ ngay trên trang xác nhận Consent, ngoài nút `Confirm` và `Decline`, ứng viên có nút **`Report Unauthorized` (Báo cáo giới thiệu trái phép)**. Khi bấm nút này, hệ thống không chỉ hủy lượt nộp đó (`CONSENT_REJECTED`) mà còn lập tức đổi trạng thái CV đó sang `AffiliateReuseStatus = REVOKED` (cấm vĩnh viễn Affiliate đó dùng lại CV này cho bất kỳ Job nào khác), đồng thời lưu lại IP, User-Agent vào AuditLog và gửi cảnh báo cho Affiliate ạ.
3. **Hỏi:** *"Làm sao hệ thống biết 2 file CV PDF có giống hệt nhau không dù được đặt 2 tên file khác nhau?"*
   * **Đáp:** Dạ khi bất kỳ file CV PDF nào được tải lên hoặc được render từ CV Builder, `PdfCvValidator` ở tầng `Infrastructure` đều băm toàn bộ luồng byte nhị phân của file bằng thuật toán **`SHA-256`** và lưu vào cột `CandidateCv.ContentSha256`. Nhờ đó dù đổi tên file là gì, nếu nội dung file giống nhau thì mã `ContentSha256` vẫn trùng khớp 100% và hệ thống phát hiện được ngay ạ.
4. **Hỏi:** *"Tại sao link Consent gửi qua email lại dùng `#token=...` (dấu thăng) mà không dùng `?token=...` (query string)?"*
   * **Đáp:** Dạ đây là thiết kế bảo mật của nhóm ạ. Nếu để ở query string `?token=...`, token sẽ bị ghi vào Access Log của máy chủ web, lịch sử proxy và có nguy cơ rò rỉ qua HTTP `Referer` header. Khi đặt sau dấu `#` (URL Fragment), trình duyệt không bao giờ gửi phần sau dấu `#` lên đường truyền HTTP ban đầu; ngay khi trang React tải xong, code trong `PublicSubmissionConsentPage.tsx` đọc token vào bộ nhớ rồi xóa ngay khỏi thanh địa chỉ bằng `history.replaceState` và mới gửi qua body/header của API có gắn `Cache-Control: no-store` ạ.
5. **Hỏi:** *"Khi gộp 2 hồ sơ ứng viên trùng nhau (`Merge`), hệ thống có xóa bản ghi hồ sơ cũ khỏi Database không?"*
   * **Đáp:** Dạ tuyệt đối không xóa cứng (`DELETE`) để đảm bảo toàn vẹn lịch sử kiểm toán (`Audit Trail`) ạ. Hệ thống giữ lại hồ sơ chuẩn (`CanonicalCandidate`), đánh dấu hồ sơ bị gộp là `Status = "MERGED"` và trỏ khóa ngoại `MergedIntoCandidateId` về hồ sơ chuẩn, đồng thời khóa không cho chỉnh sửa hồ sơ đã bị gộp và bảo toàn nguyên vẹn lịch sử `Submission` cũng như `Attribution` của Affiliate ạ.
