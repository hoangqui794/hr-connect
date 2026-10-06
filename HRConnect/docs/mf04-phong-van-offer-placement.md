# MF-04 – Phỏng vấn, Offer và Placement

> **Phiên bản:** Business baseline khớp với code hiện tại  
> **Phạm vi:** từ khi Application được sàng lọc theo Service Type đến khi Candidate thực tế đi làm hoặc kết thúc tuyển dụng.  
> **Không thuộc MF-04:** Probation, Warranty, Commission và Payout.

## 1. Mục tiêu

MF-04 quản lý giai đoạn tuyển dụng sau khi Candidate đã nộp hồ sơ. Module ghi
nhận lịch phỏng vấn, kết quả tuyển chọn, offer, phản hồi của Candidate và việc
Candidate có thực tế bắt đầu làm việc hay không.

MF-04 bảo đảm mỗi Application có một tiến trình rõ ràng:

- được người sàng lọc đúng Service Type chọn để phỏng vấn hoặc dừng ở screening;
- có kết quả Interview là `PASS`, `FAIL` hoặc `BACKUP`;
- có Offer được Candidate chấp nhận, từ chối, thu hồi hoặc hết hạn;
- chỉ được ghi nhận `PLACED` khi Candidate thực tế bắt đầu làm việc và Company xác nhận.

### Điều chỉnh quan trọng so với tài liệu cũ

MF-03 tạo **AI matching result** để hỗ trợ đánh giá CV và Job. MF-03 **không
tự quyết định** Candidate được shortlist, fail hay được nhận việc. Bước review
Application thuộc người sàng lọc được xác định theo Service Type.

Vì vậy có hai cách nhìn hợp lệ:

1. **Toàn bộ MF-04 theo implementation hiện tại** bắt đầu từ `SUBMITTED` hoặc
   `SCREENING`: Company review Job `CV_APPLICATION`; Internal HR tiền sàng lọc
   Job `HEADHUNT_COD` và `CV_SOURCING`. Internal HR chỉ có thể chuyển sang
   `SCREENING`, `SHORTLISTED` hoặc `REJECTED`; quyết định `BACKUP` thuộc
   Company.
2. **Luồng phỏng vấn–offer–placement để thuyết trình** bắt đầu tại
   `SHORTLISTED`. Đây là điểm vào của sơ đồ Interview trong tài liệu này.

## 2. Boundary với các module khác

| Module | Chịu trách nhiệm | Kết quả bàn giao cho MF-04 |
| --- | --- | --- |
| MF-02 | Candidate, CV, Application và Affiliate Submission/Attribution | Application hợp lệ; nếu là referral thì đã có Attribution khi Candidate đồng ý. |
| MF-03 | Phân tích CV/JD và tạo AI match result | Điểm, evidence và chẩn đoán để người sàng lọc tham khảo; không phải quyết định tuyển dụng. |
| MF-04 | Screening, Interview, Offer, xác nhận đi làm và Placement | Placement thành công hoặc một trạng thái kết thúc tuyển dụng. |
| MF-05 | Probation, Warranty, Commission, Payout | Nhận Placement đã được xác nhận làm dữ liệu đầu vào. |

MF-04 **không tự chuyển workflow sang MF-05**. Khi Placement được tạo, dữ liệu
đó chỉ trở thành đầu vào cho MF-05 khi business module này được chốt và triển
khai.

## 3. Actor và phạm vi trách nhiệm

| Actor | Được làm trong MF-04 | Không được làm trong MF-04 |
| --- | --- | --- |
| **Client Company User** | Sàng lọc Job `CV_APPLICATION` thuộc Company mình; với mọi Service Type sau `SHORTLISTED`: lên lịch, sửa, dời, hủy Interview; ghi kết quả; tạo/sửa/gửi/thu hồi Offer; quyết định Backup; xác nhận ngày dự kiến và ngày đi làm thực tế. | Sàng lọc `HEADHUNT_COD`/`CV_SOURCING`; thao tác Application của Company khác. |
| **Candidate** | Xem lịch Interview và Offer của chính mình; chấp nhận/từ chối Offer; rút Application của chính mình khi Application chưa kết thúc. | Xem dữ liệu Candidate khác; quyết định kết quả Interview; xác nhận Placement. |
| **Internal HR** | Tiền sàng lọc Job `HEADHUNT_COD`/`CV_SOURCING` từ `SUBMITTED` hoặc `SCREENING`; xem Application, AI result, Interview, Offer, Placement, Attribution và timeline cần thiết để hỗ trợ vận hành. | Sàng lọc `CV_APPLICATION`; quyết định Backup; lên lịch hoặc ghi kết quả Interview; tạo/gửi/thu hồi Offer; xác nhận không đi làm hoặc Placement; xem raw audit record nếu không có quyền `audit.view` của Platform Admin. |
| **Affiliate Recruiter** | Xem projection tiến độ referral của mình ở mức an toàn: `CV_REVIEW`, `SHORTLISTED`, `INTERVIEW`, `OFFER`, `BACKUP`, `PLACED` hoặc `CLOSED`. | Xem lịch phỏng vấn, link/địa điểm, feedback, lương, nội dung Offer, lý do nội bộ hoặc Placement detail. |
| **HR Connect System** | Lưu entity, trạng thái, history, audit log; kiểm tra quyền và ownership; xử lý Offer hết hạn bằng background worker. | Tự quyết định PASS/FAIL/BACKUP, tạo Offer hoặc xác nhận Candidate đã đi làm. |

`INTERNAL_HR` là vai trò vận hành của HR Connect, không phải người thuộc hội
đồng tuyển dụng của Client Company. Internal HR chỉ có mutation tiền sàng lọc
theo Service Type; quyền Interview, Offer, Backup decision và Placement vẫn bị
thu hồi.

## 4. Điều kiện vào luồng Interview

Để Company tạo Interview, Application phải:

- thuộc một Job do Company đó sở hữu;
- có trạng thái `SHORTLISTED` cho vòng Interview đầu tiên, hoặc `INTERVIEW`
  khi tạo vòng tiếp theo;
- không có một Interview khác đang `SCHEDULED`;
- có version/concurrency token hợp lệ nếu API yêu cầu.

Khi Company tạo Interview đầu tiên cho Application `SHORTLISTED`, hệ thống
chuyển Application sang `INTERVIEW` và Interview mới có trạng thái `SCHEDULED`.

## 5. Luồng chính

```text
MF-03 tạo AI match result
        ↓
Người sàng lọc theo Service Type quyết định SHORTLISTED
        ↓
Company tạo lịch Interview
        ↓
Application = INTERVIEW; Interview = SCHEDULED
        ↓
Candidate xem lịch và tham gia Interview
        ↓
Company ghi nhận PASS / FAIL / BACKUP
        ↓
PASS + vòng cuối hoặc MAKE_OFFER  → OFFER_PENDING → Offer → Candidate phản hồi
FAIL + vòng cuối hoặc REJECT      → INTERVIEW_FAILED → kết thúc
BACKUP                             → BACKUP → Company quyết định tiếp
```

### 5.1. Screening trước Interview

MF-04 có một API review dùng chung, nhưng server xác định actor được phép từ
`Job.ServiceType.Code`:

| Service Type | Người sàng lọc ban đầu | Permission |
| --- | --- | --- |
| `CV_APPLICATION` | Client Company sở hữu Job | `candidate.review_company` |
| `HEADHUNT_COD`, `CV_SOURCING` | Internal HR | `application.screen` |

Application có thể đi theo các nhánh sau:

```text
SUBMITTED  → SCREENING | SHORTLISTED | REJECTED | BACKUP
SCREENING  → SHORTLISTED | REJECTED | BACKUP
BACKUP     → SHORTLISTED | BACKUP_NOT_SELECTED
```

AI match result chỉ là dữ liệu hỗ trợ. Internal HR chỉ thực hiện hai nhánh đầu
(`SUBMITTED` hoặc `SCREENING`) với hai service Agency và chỉ được chuyển sang
`SCREENING`, `SHORTLISTED` hoặc `REJECTED`. Quyết định `BACKUP` và mọi xử lý
tiếp theo vẫn là của Company. Sơ đồ Interview thường không vẽ phần này để giữ
trọng tâm từ `SHORTLISTED` trở đi.

### 5.2. Interview

Company sở hữu toàn bộ mutation của Interview cho Job của mình:

- tạo lịch Interview;
- cập nhật nội dung lịch;
- dời hoặc hủy lịch;
- ghi Candidate no-show;
- ghi kết quả và feedback.

Hệ thống lưu thời gian, hình thức, địa điểm hoặc meeting link, người tham gia,
vòng Interview, lịch sử thay đổi và audit log. Candidate chỉ xem Interview của
chính mình.

Khi ghi kết quả, Interview chuyển sang `COMPLETED`. Kết quả có ba giá trị:

| Kết quả | Điều kiện tiếp theo | Application sau thao tác |
| --- | --- | --- |
| `PASS` | Là vòng cuối hoặc Company chọn `MAKE_OFFER` | `OFFER_PENDING` |
| `PASS` | Chưa là vòng cuối và chưa chọn `MAKE_OFFER` | Giữ `INTERVIEW` để tạo vòng tiếp theo |
| `FAIL` | Là vòng cuối hoặc Company chọn `REJECT` | `INTERVIEW_FAILED` |
| `FAIL` | Chưa là vòng cuối và chưa chọn `REJECT` | Giữ `INTERVIEW`; Company quyết định vòng tiếp theo |
| `BACKUP` | Không cần điều kiện bổ sung | `BACKUP` |

Do đó không được viết đơn giản rằng mọi `PASS` đều sang Offer hay mọi `FAIL`
đều kết thúc. Hai chuyển trạng thái này phụ thuộc vào `isFinalRound` hoặc
`nextAction` của Company.

### 5.3. Backup

`BACKUP` nghĩa là Candidate chưa bị loại nhưng chưa được chọn cho Offer. Chỉ
Company sở hữu Job được quyết định tiếp:

| Quyết định | Application sau thao tác | Ý nghĩa |
| --- | --- | --- |
| `SELECT` | `OFFER_PENDING` | Chọn Candidate dự bị để đi vào Offer flow. |
| `REJECT` | `BACKUP_NOT_SELECTED` | Candidate không được chọn; nhánh tuyển dụng kết thúc. |
| `KEEP_ON_HOLD` | `BACKUP` | Giữ Candidate trong danh sách dự bị. |

### 5.4. Offer

Chỉ Company sở hữu Job có thể tạo Offer draft khi Application đang
`OFFER_PENDING`. Việc tạo draft chưa có nghĩa là Candidate đã nhận được Offer.

```text
Application = OFFER_PENDING
        ↓ Company tạo Offer
Offer = DRAFT
        ↓ Company gửi Offer
Offer = SENT
        ↓ Candidate phản hồi / System xử lý hết hạn
ACCEPTED | DECLINED | EXPIRED
```

| Thao tác | Actor được phép | Kết quả Offer | Kết quả Application |
| --- | --- | --- | --- |
| Tạo hoặc cập nhật draft | Company | `DRAFT` | Giữ `OFFER_PENDING` |
| Gửi Offer | Company | `SENT` | Giữ `OFFER_PENDING` |
| Chấp nhận | Candidate sở hữu Offer | `ACCEPTED` | `OFFER_ACCEPTED` |
| Từ chối | Candidate sở hữu Offer; phải có lý do | `DECLINED` | `OFFER_DECLINED` |
| Thu hồi | Company, khi Offer còn hợp lệ để thu hồi | `WITHDRAWN` | `OFFER_PENDING` |
| Hết hạn | HR Connect System worker khi Offer `SENT` có `expiryDate` đã qua | `EXPIRED` | `OFFER_PENDING` |

Sau khi Offer bị thu hồi hoặc hết hạn, Company có thể xử lý tiếp từ
`OFFER_PENDING`, ví dụ tạo Offer draft mới nếu nghiệp vụ và validation còn hợp
lệ.

Candidate chỉ phản hồi Offer của chính mình. Candidate không được sửa nội dung,
lương, hạn phản hồi hay trạng thái Offer của Candidate khác.

> **Lưu ý về notification hiện có:** background worker hiện tạo in-app
> notification an toàn cho Candidate khi Offer hết hạn. Không mô tả việc gửi
> notification khi Company tạo lịch Interview hoặc nhấn gửi Offer là chức năng
> đã có, vì các handler hiện tại chưa thực hiện side effect đó.

### 5.5. Ngày dự kiến, không đi làm và Placement

Sau khi Candidate chấp nhận Offer, Company có thể cập nhật ngày bắt đầu dự kiến.
Để xác nhận kết quả thực tế, Application phải là `OFFER_ACCEPTED` và Offer liên
quan phải là `ACCEPTED`. Company là bên xác nhận một trong hai kết quả:

| Kết quả thực tế | Actor | Application | Dữ liệu được tạo |
| --- | --- | --- | --- |
| Candidate không bắt đầu làm việc | Company | `NOT_STARTED` | Lý do không đi làm được lưu. |
| Candidate đã bắt đầu làm việc | Company | `PLACED` | Tạo `Placement` với trạng thái `STARTED`. |

`PLACED` là bằng chứng Company đã xác nhận Candidate đi làm thực tế. Candidate
không tự xác nhận Placement; Internal HR cũng không có quyền thay Company làm
thao tác này. Việc Internal HR đối soát nguyên nhân hoặc Placement để tính phí
là quy trình vận hành/định hướng cho MF-05, không phải mutation của MF-04 hiện
tại.

## 6. Ngoại lệ và quy tắc huỷ

| Tình huống | Actor | Hành vi đúng |
| --- | --- | --- |
| Candidate rút Application | Candidate sở hữu Application | Được rút ở mọi Application chưa terminal, kể cả `OFFER_ACCEPTED`. Hệ thống huỷ các Interview `SCHEDULED`, thu hồi Offer `DRAFT`/`SENT` và chuyển Application sang `WITHDRAWN`. |
| Dời hoặc huỷ Interview | Company | Chỉ Company sở hữu Job được dời/huỷ Interview. Candidate không sửa lịch. |
| Candidate không tham gia Interview | Company | Interview được đánh dấu `NO_SHOW`; Application không tự đổi sang trạng thái kết thúc chỉ vì thao tác này. Company quyết định bước tiếp theo. |
| Offer quá hạn | System worker | Chỉ Offer `SENT` quá hạn chuyển `EXPIRED`; Application quay về `OFFER_PENDING`. |
| Company xử lý Candidate dự bị | Company | Phải dùng `SELECT`, `REJECT` hoặc `KEEP_ON_HOLD`; không được đổi trạng thái tuỳ ý. |

Application được xem là terminal và không thể Candidate withdraw khi ở một
trong các trạng thái: `REJECTED`, `INTERVIEW_FAILED`,
`BACKUP_NOT_SELECTED`, `OFFER_DECLINED`, `NOT_STARTED`, `WITHDRAWN`,
`PLACED` hoặc `CLOSED`.

## 7. State model chuẩn

### 7.1. Application

| Nhóm | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| Đầu vào và screening | `SUBMITTED`, `SCREENING` | Candidate đã nộp; Client hoặc Internal HR đánh giá theo Service Type trước Interview. |
| Sẵn sàng/đang phỏng vấn | `SHORTLISTED`, `INTERVIEW` | Được chọn để phỏng vấn hoặc đang có/vừa có các vòng Interview. |
| Dự bị | `BACKUP` | Chưa bị loại, chờ Company chọn hoặc đóng. |
| Chờ và phản hồi Offer | `OFFER_PENDING`, `OFFER_ACCEPTED`, `OFFER_DECLINED` | Chờ tạo/gửi Offer, Candidate đã chấp nhận hoặc đã từ chối. |
| Hoàn tất không thành công | `REJECTED`, `INTERVIEW_FAILED`, `BACKUP_NOT_SELECTED`, `NOT_STARTED`, `WITHDRAWN`, `CLOSED` | Nhánh tuyển dụng kết thúc, với nguyên nhân tương ứng. |
| Placement thành công | `PLACED` | Candidate đã bắt đầu làm việc, Placement đã được tạo. |

### 7.2. Interview, Offer và Placement

| Entity | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| Interview | `SCHEDULED`, `CANCELLED`, `COMPLETED`, `NO_SHOW` | Vòng Interview độc lập với trạng thái Application. |
| Offer | `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED` | Vòng đời Offer; không dùng trực tiếp thay cho Application state. |
| Placement | `STARTED` | Được tạo khi Company xác nhận Candidate thực tế đã bắt đầu làm việc. |

Không được đồng nhất `Interview.COMPLETED` với `Application.OFFER_PENDING`,
hay `Offer.ACCEPTED` với `Application.PLACED`: mỗi chuyển trạng thái còn phụ
thuộc vào kết quả, quyết định Company và xác nhận đi làm thực tế.

## 8. Projection an toàn cho Affiliate

Affiliate chỉ nhận một projection tối thiểu của referral do chính mình gửi.
Projection này không phải bản sao Application detail.

| Application nội bộ | Progress Affiliate có thể thấy |
| --- | --- |
| `SUBMITTED`, `SCREENING` | `CV_REVIEW` |
| `SHORTLISTED` | `SHORTLISTED` |
| `INTERVIEW` | `INTERVIEW` |
| `OFFER_PENDING`, `OFFER_ACCEPTED` | `OFFER` |
| `OFFER_DECLINED` | `CLOSED` |
| `BACKUP` | `BACKUP` |
| `PLACED` | `PLACED` |
| Các trạng thái kết thúc khác | `CLOSED` |

Affiliate không nhận thời gian/lịch/link phỏng vấn, feedback, score, lương,
nội dung Offer, lý do từ chối hoặc chi tiết Placement. Điều này tránh tình
trạng Affiliate biết thông tin nhạy cảm hoặc có thể can thiệp vào quyết định
tuyển dụng của Company.

## 9. Audit và phân quyền

Mọi mutation nghiệp vụ quan trọng cần được ghi audit với tối thiểu: actor,
actor role, Application/Interview/Offer/Placement liên quan, hành động, trạng
thái trước/sau, thời điểm và correlation/request id khi có. Audit phục vụ truy
vết và đối soát; nó không trao quyền thao tác cho Internal HR.

Internal HR có thể xem timeline phục vụ vận hành theo phạm vi quyền của mình.
Endpoint raw audit log yêu cầu quyền `audit.view` của Platform Admin; không
coi đó là một quyền mặc định của Internal HR.

API mutation luôn phải xác định actor từ access token và kiểm tra ownership
Company/Candidate ở server. Không nhận `companyId`, `candidateId` hoặc role do
client tự khai như một cơ chế cấp quyền.

## 10. API MF-04 hiện có

| Nhóm | API chính | Actor mutation |
| --- | --- | --- |
| Screening | `PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status` | Client cho `CV_APPLICATION`; Internal HR cho `HEADHUNT_COD`/`CV_SOURCING` |
| Interview | `POST /api/v1/recruitment/applications/{applicationId}/interviews`; `PUT /api/v1/interviews/{interviewId}`; `POST /reschedule`, `/cancel`, `/no-show`, `/result` | Company |
| Backup | `POST /api/v1/recruitment/applications/{applicationId}/backup-decision` | Company |
| Candidate withdraw | `POST /api/v1/recruitment/applications/{applicationId}/withdraw` | Candidate |
| Offer | `POST /api/v1/recruitment/applications/{applicationId}/offers`; `PUT /api/v1/offers/{offerId}`; `POST /send`, `/withdraw` | Company |
| Offer response | `POST /api/v1/offers/{offerId}/response` | Candidate |
| Start outcome | `PUT /api/v1/recruitment/applications/{applicationId}/planned-start-date`; `POST /start-work`, `/not-started` | Company |
| Application read | `GET /api/v1/recruitment/applications`, `GET /{applicationId}`, `GET /{applicationId}/timeline` | Theo scope role/ownership |
| Interview read | `GET /api/v1/interviews`, `GET /{interviewId}`, `GET /{interviewId}/history` | Theo scope role/ownership |
| Offer read | `GET /api/v1/offers`, `GET /api/v1/offers/{offerId}` | Theo scope role/ownership |
| Placement read | `GET /api/v1/placements`, `GET /api/v1/placements/{placementId}` | Theo scope role/ownership |
| Referral progress | `GET /api/v1/affiliates/referrals` | Affiliate, chỉ projection an toàn |

Các đường dẫn rút gọn như `/send`, `/withdraw`, `/response`, `/reschedule`,
`/cancel`, `/no-show` và `/result` nằm dưới resource ngay trước đó trong cùng
hàng. API read vẫn phải áp dụng filtering theo Company, Candidate, Affiliate
projection hoặc quyền Internal HR; không được dùng endpoint list để vượt qua
ownership.

## 11. Tiêu chí nghiệm thu business

1. Company chỉ sàng lọc `CV_APPLICATION` thuộc Company mình; Internal HR chỉ
   tiền sàng lọc `HEADHUNT_COD` và `CV_SOURCING` từ `SUBMITTED`/`SCREENING`.
2. Internal HR không có endpoint mutation cho Interview, Backup decision,
   Offer hoặc Placement.
3. Candidate chỉ phản hồi Offer và withdraw Application của chính mình.
4. `PASS`/`FAIL` nhiều vòng chỉ đi tới Offer/kết thúc khi Company chọn action
   phù hợp hoặc đây là vòng cuối.
5. `BACKUP` không phải một kết quả bị loại; Company phải ra quyết định tiếp.
6. `PLACED` chỉ xuất hiện sau xác nhận đi làm thực tế của Company.
7. Affiliate chỉ thấy progress đã được sanitize, không thấy dữ liệu tuyển dụng
   nhạy cảm.
8. Offer hết hạn được xử lý bởi System worker, có audit và notification in-app
   an toàn; MF-04 không tự kích hoạt workflow MF-05.

## 12. Các nội dung chưa thuộc MF-04 hiện tại

- probation, warranty, commission, payout và đối soát phí;
- quy trình Internal HR điều phối Interview, Offer hoặc Placement thay Company;
- thông báo tự động khi tạo/dời Interview hoặc khi Company gửi Offer;
- workflow tự động chuyển Placement sang MF-05;
- hiển thị chi tiết Interview/Offer/Placement cho Affiliate.
