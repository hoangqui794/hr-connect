# GitNexus Engineering Plan

> Task: Tích hợp VNPAY Sandbox theo hướng có thể chuyển sang Production cho toàn bộ khoản Client thanh toán trong MF-05, tự động cập nhật nghiệp vụ bằng IPN, đồng thời giữ nguyên luồng chi hoa hồng Affiliate.
> Evidence verified at commit `e75850df2c936d8a82bbd9b323c82a155198995e`; GitNexus index refreshed this session (`--index-only --pdg`, fresh at the same commit).
> Evidence provenance schema 2; global dirty digest `0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd`; cited-path manifest 31 sorted entries; exact generated plan path excluded.

## 1. Objective

- [verified] Thay luồng “Client tự xác nhận đã chuyển khoản / Admin nhập mã giao dịch” bằng luồng thanh toán VNPAY: Client chọn khoản phải trả → BE tạo đơn từ số tiền trong DB → chuyển tới VNPAY → VNPAY gọi IPN → BE xác minh chữ ký, mã đơn, số tiền và trạng thái → cập nhật phí, kích hoạt nghiệp vụ và gửi thông báo.
- [inferred] Sandbox và Production phải dùng cùng mã nguồn; chỉ thay cấu hình môi trường, `TmnCode`, `HashSecret` và endpoint VNPAY. Không hard-code thông tin Sandbox trong FE hoặc domain.
- [verified] Phạm vi Client thanh toán gồm: phí đăng tin CV_APPLICATION (`JobPostingFee`) và các `ServiceFee` có số tiền phải thu (`PLACEMENT`, `DEPOSIT`, `SETTLEMENT`). `CREDIT` là khoản hoàn/khấu trừ cho Client nên không được tạo giao dịch thu tiền.
- [verified] Luồng Admin chi hoa hồng cho Affiliate và trạng thái `Commission`/`Payout` không đi qua VNPAY trong thay đổi này; nó tiếp tục là luồng chi ra riêng của MF-05.
- [inferred] Mục tiêu production: IPN là nguồn xác nhận duy nhất; Return URL chỉ phục vụ trải nghiệm người dùng; callback lặp lại phải idempotent; sai chữ ký/sai số tiền không được làm thay đổi công nợ.

## 2. Current Behaviour

- [verified] `ClientBillingPage` tổng hợp `ServiceFee` và `JobPostingFee`, nhưng chỉ đọc dữ liệu; phần mô tả nói rõ Platform Admin ghi nhận thanh toán (`HRConnect-FE/src/features/client-console/ClientBillingPage.tsx:1-8`).
- [verified] Việc lấy phí đăng tin đang phát sinh N+1: tải danh sách job rồi gọi `getPostingFee` cho từng job có gói trả phí (`ClientBillingPage.tsx:60-75`).
- [verified] `PaymentDemoModal.handleConfirmPayment` cho phép Client gọi thẳng `jobsApi.payPostingFee`; với tiền cọc, lỗi API còn bị bỏ qua và trình duyệt tự ghi `localStorage` rồi tiếp tục báo thành công (`PaymentDemoModal.tsx:75-149`).
- [verified] Endpoint `POST /jobs/{jobId}/posting-fee/pay` cho cả Client, Internal HR và Admin tự cung cấp `PaymentReference`; handler lập tức chuyển phí thành `PAID`, kích hoạt job và gửi thông báo (`JobEndpoints.cs:116-140`, `RecordJobPostingFeePaymentCommand.cs:93-184`).
- [verified] Tiền cọc CV_SOURCING hiện đi hai bước: Client gọi `deposit/notify` để đánh dấu đã nộp và báo HR (`NotifyJobDepositCommand.cs:50-138`), sau đó HR gọi xác nhận để chuyển `ServiceFee` thành `PAID` và mở job (`ConfirmJobDepositCommand.cs:45-115`).
- [verified] Các phí dịch vụ khác được Admin ghi nhận thủ công qua `/admin/service-fees/{id}/record-payment`; handler thay đổi trạng thái, mở suất thay thế nếu cần, mở job sau khi nhận cọc và gửi thông báo trong cùng unit of work (`SettlementCommands.cs:90-148`).
- [verified] `AdminFinancePage` và `PostingFeePaymentsPanel` hiện cung cấp form “ghi nhận đã thu” bằng ngày/mã tham chiếu; việc chuyển tiền vẫn diễn ra ngoài hệ thống (`AdminFinancePage.tsx:84-104,305-389`, `PostingFeePaymentsPanel.tsx:34-114`).

## 3. Relevant Architecture

- [verified] Backend theo CQRS/MediatR: Minimal API map request vào command/query; repository tải aggregate; `IUnitOfWork.SaveChangesAsync` commit state, audit và notification (`FinanceEndpoints.cs:38-114`, `JobEndpoints.cs:99-169`).
- [verified] `FinanceEndpoints.MapFinanceEndpoints` đặt toàn bộ `/api/v1` group dưới `RequireAuthorization`; vì IPN từ VNPAY không mang JWT, callback phải nằm ở một endpoint group riêng và `AllowAnonymous`, không chèn trực tiếp vào group hiện tại (`FinanceEndpoints.cs:38-45`).
- [verified] `ApplicationDbContext` đang map trực tiếp entity và constraint/index trong `OnModelCreating`; `ServiceFee` và `JobPostingFee` đã có `Amount`, `CurrencyCode`, `Status`, `PaidAt`, `PaymentReference`, `RecordedBy` (`ApplicationDbContext.cs:2056-2116,2640-2715`).
- [verified] Repository MF-05 đã có cách khóa PostgreSQL bằng `SELECT ... FOR UPDATE` và fallback cho EF InMemory; đây là pattern cần tái sử dụng khi xử lý IPN đồng thời (`FinanceRepository.cs:89-107`).
- [verified] DI đang bind settings bằng `Configure`/`PostConfigure`, đăng ký typed/named `HttpClient`, repositories và background workers tại `Infrastructure.DependencyInjection` (`DependencyInjection.cs:130-190`).
- [inferred] Nên thêm payment aggregate riêng thay vì nhét trạng thái gateway vào `ServiceFee`/`JobPostingFee`: một khoản phí có thể có nhiều lần thử thanh toán, callback lặp, timeout, giao dịch thất bại và đối soát QueryDR.
- [verified] Theo tài liệu chính thức VNPAY, `vnp_Amount` gửi theo VND × 100, `vnp_TxnRef` phải duy nhất, HMACSHA512 kiểm tra toàn vẹn; IPN mới là server-to-server dùng để cập nhật DB, còn Return URL là redirect trình duyệt. Tham chiếu: [PAY/IPN/Return](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [QueryDR/Refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).

## 4. GitNexus Findings

- [graph] `mcp__gitnexus__impact(target=PaymentDemoModal,direction=upstream,depth=3)` báo `CRITICAL`, epistemic `exact`; direct consumers là `ClientServiceAgreementsPage`, `ClientJobsListPage`, `JobDetailPanel`. Trích kết quả: “direct callers: ClientServiceAgreementsPage, ClientJobsListPage, JobDetailPanel”. Vì vậy phải giữ props tương thích hoặc chuyển cả ba caller trong cùng bước có regression test.
- [graph] `mcp__gitnexus__impact(target=SettlementCommandHandlers.Handle,file_path=...SettlementCommands.cs,direction=upstream,depth=3,includeTests=true)` báo `MEDIUM`, epistemic `lower-bound`; các test trực tiếp gồm thanh toán khi `DUE`, mở suất thay thế, mở job sau cọc và chặn duyệt hoa hồng trước khi Client trả phí. Trích kết quả: “receiver typing dropped 4 callsites”; source search đã xác nhận endpoint gọi command qua MediatR.
- [graph] `mcp__gitnexus__impact(target=RecordJobPostingFeePaymentCommandHandler.Handle,direction=upstream,depth=3,includeTests=true)` báo `MEDIUM`, epistemic `exact`; direct dependents gồm `JobEndpoints`, `SourcingFinanceTests` và `JobManagementCommandHandlerTests`. Trích kết quả: “RecordPayment_WhenPendingPayment_ShouldActivateJob” là regression test trực tiếp.
- [graph] `mcp__gitnexus__impact(target=useBillingRows,direction=upstream,depth=3,includeTests=true)` báo `LOW`; direct consumer là `ClientBillingPage`, depth tiếp theo là `ClientBillingPage.test.tsx`. Đây là điểm thay API tổng hợp công nợ mà không lan sang các role khác.
- [graph] `mcp__gitnexus__context(name=MapFinanceEndpoints,file_path=...FinanceEndpoints.cs)` không tìm thấy caller trong graph; `rg` đã xác minh registration thực tế ở `Program.cs:407`. Kết luận “không có caller” của graph không được dùng để xóa/di chuyển registration.
- [graph] `mcp__gitnexus__api_impact` không nhận diện ba Minimal API route thanh toán hiện tại. Vì vậy compatibility route được xác minh bằng source, service API FE và text search, không dựa vào kết quả rỗng của route graph.
- [graph] `mcp__gitnexus__explain` không có taint finding tại `PaymentDemoModal.tsx` và `FinanceEndpoints.cs`, nhưng tool cảnh báo closure/property/implicit flow chưa được mô hình hóa; kết quả rỗng không phải bằng chứng an toàn thanh toán.

## 5. Statement-Level PDG Findings

- [graph] `pdg_query(mode=controls,target=...RecordJobPostingFeePaymentCommand.cs)` cho thấy nhánh `fee.Status != PAID` điều khiển toàn bộ mutation từ dòng 98 tới `SaveChanges` dòng 184; nhánh `job.Status == PENDING_PAYMENT` mới điều khiển việc chuyển job sang `ACTIVE` dòng 114-123. Hệ quả: completion dùng bởi IPN phải giữ nguyên gate này và không commit payment-order trước khi downstream business mutations thành công.
- [graph] `pdg_query(mode=flows,variable=fee,target=...RecordJobPostingFeePaymentCommand.cs)` cho thấy `fee` từ repository/khởi tạo chảy tới kiểm tra trạng thái, mutation `PAID`, notification và response. Hệ quả: số tiền/order source phải bind vào chính row đã khóa, không nhận amount từ FE và không lookup lại bằng dữ liệu callback không kiểm chứng.
- [graph] `pdg_query(mode=controls,target=...SettlementCommands.cs)` xác nhận các guard payment reference, thời gian, trạng thái phí và reconciliation đứng trước mutation; các side effect mở replacement slot, notify company, mở job sau cọc đứng trước `SaveChanges`. Hệ quả: refactor thành completion service dùng chung phải bảo toàn thứ tự guard → mutation → audit/notification/activation → một commit.
- [graph] `pdg_query(mode=controls,target=...PaymentDemoModal.tsx)` cho thấy nhánh deposit gọi `notifyDeposit`, nhưng catch dòng 81-84 điều khiển fallback tiếp tục đến localStorage và success UI; nhánh posting fee gọi API trực tiếp ở dòng 95. Hệ quả: xóa hoàn toàn fallback, local success alerts và nút tự xác nhận; modal mới chỉ tạo payment order và redirect.
- [inferred] IPN và thao tác retry có thể đến đồng thời. Cần transaction + row lock trên `PaymentOrder` và payable row; unique constraint/idempotency fingerprint là lớp bảo vệ thứ hai. Cập nhật `PAID` và side effects phải atomic, còn HTTP response cho callback trả nhanh sau commit.

## 6. Proposed Changes

### 6.1 Payment domain và database

- [inferred] Thêm payment-order aggregate lưu: `PaymentOrderId`, `CompanyId`, nguồn thu (`SERVICE_FEE` hoặc `JOB_POSTING_FEE`), đúng một FK nguồn, provider, `TxnRef`, amount/currency snapshot, trạng thái, expiry, provider transaction/bank/response metadata, creator, paid time, timestamps và concurrency token.
- [inferred] Thêm gateway-event/audit aggregate lưu callback đã xử lý: order, event type (`IPN`, `RETURN`, `QUERYDR`), canonical payload hash/fingerprint, response/status code, processing result và received time. Không lưu `HashSecret`, secure hash đầy đủ, PAN hoặc credential ngân hàng.
- [inferred] Constraint/index bắt buộc: unique `TxnRef`; đúng một nguồn phí; amount > 0, currency = VND; unique callback fingerprint; partial unique chỉ cho một order đang hoạt động (`PENDING`/`PROCESSING`) trên mỗi payable source; index theo company/status/created time và provider transaction number.
- [inferred] Migration không backfill order giả cho dữ liệu cũ: phí đã `PAID` giữ nguyên; phí chưa trả chỉ tạo order khi Client bấm thanh toán. Regenerate model snapshot và hai SQL migration scripts theo quy ước repository.

### 6.2 Provider abstraction và cấu hình

- [inferred] Thêm cổng provider trong Application và implementation VNPAY trong Infrastructure. Provider chỉ chịu trách nhiệm build URL, canonical sort/encode, HMACSHA512, verify callback và QueryDR; business handlers không phụ thuộc trực tiếp VNPAY.
- [inferred] Cấu hình gồm `Enabled`, `Environment`, `PaymentUrl`, `ApiUrl`, `TmnCode`, `HashSecret`, `ReturnUrl`, expiry, timeout và frontend-result allowlist. Production frontend origin đã chốt là `https://www.hrconnectvn.online`; Return URL phía BE phải redirect về `https://www.hrconnectvn.online/client/billing/payment-result`. Secret chỉ đọc ở backend từ env; startup fail-fast khi `Enabled=true` mà cấu hình thiếu/URL không HTTPS ngoài Development.
- [inferred] Sandbox/Production chuyển bằng env. FE không nhận `HashSecret` và không tự tạo chữ ký. Log phải redact `vnp_SecureHash` và secret.

### 6.3 API và orchestration

- [inferred] Thêm authenticated endpoint tạo order. Request chỉ nhận `sourceType` + `sourceId` và tùy chọn locale/bank code hợp lệ; BE xác định company, quyền sở hữu, amount, currency và trạng thái từ DB. Response gồm order ID, expiry và payment URL.
- [inferred] Thêm authenticated endpoint lấy trạng thái order, chỉ Client cùng company hoặc Platform Admin xem được. Client result page poll endpoint này sau Return URL.
- [inferred] Thêm anonymous IPN endpoint ở group riêng. Thứ tự bắt buộc: parse bounded input → verify HMAC constant-time → lookup/lock TxnRef → kiểm tra TmnCode, amount × 100, currency, source status → persist event → complete business → commit → trả đúng `RspCode/Message` VNPAY. Callback lặp không chạy side effect lần hai.
- [inferred] Thêm anonymous Return endpoint: verify checksum, lookup order, rồi 303 redirect tới frontend allowlisted với `orderId`; không đánh dấu `PAID` từ Return URL. Nếu IPN chưa tới, UI hiển thị “Đang xác nhận” và poll.
- [inferred] Thêm Admin query giao dịch và action QueryDR/reconcile cho order `PROCESSING`, mismatch hoặc callback thất lạc. Manual “ghi nhận ngoại tuyến” chỉ giữ như đường dự phòng có permission, lý do và audit; không còn là CTA mặc định.
- [inferred] API tổng hợp công nợ Client nên trả cả service fee và posting fee theo một contract server-side để bỏ N+1 ở `useBillingRows`; mỗi row có `payableSourceType`, `payableSourceId`, `canPay`, `activePaymentOrder` và lý do không thể trả.

### 6.4 Dùng chung completion nghiệp vụ

- [verified] Refactor phần mutation trong `SettlementCommandHandlers.Handle(RecordServiceFeePaymentCommand)` thành completion routine dùng chung, nhưng giữ guard reconciliation, mở replacement slot, notify company và mở job sau deposit (`SettlementCommands.cs:90-148`).
- [verified] Refactor phần mutation trong `RecordJobPostingFeePaymentCommandHandler.Handle` thành completion routine dùng chung, giữ activation/expiry/status history/notification (`RecordJobPostingFeePaymentCommand.cs:41-199`).
- [inferred] IPN gọi completion routine với actor hệ thống (`ActorUserId=null`, `ActorType=SYSTEM`, `Source=VNPAY_IPN`, correlation = payment order ID). Manual fallback gọi cùng routine với Admin actor; không duy trì hai implementation khác nhau.
- [verified] Sau khi VNPAY xác nhận `DEPOSIT`, completion hiện có phải mở CV_SOURCING job ngay; bỏ bước Client báo đã chuyển và HR xác nhận tiền đối với online payment. `NotifyJobDepositCommand`/`ConfirmJobDepositCommand` chỉ còn dùng cho offline/manual legacy hoặc được đánh dấu deprecated sau migration.

### 6.5 Client FE

- [verified] Chuyển `PaymentDemoModal` thành payment launch modal tương thích props hiện có để ba caller không vỡ ngay. Modal hiển thị khoản phí do BE trả, điều khoản, expiry; CTA “Thanh toán qua VNPAY” tạo order rồi redirect. Xóa tài khoản MB hard-code, VietQR hard-code, `localStorage` fallback, local role alerts và nút “Xác nhận đã thanh toán”.
- [inferred] `ClientBillingPage` thêm cột thao tác và payment state: “Thanh toán”, “Đang xác nhận”, “Đã thanh toán”, “Thất bại/Thử lại”. `CREDIT`, phí đang đối soát hoặc nguồn không thuộc company không có CTA.
- [inferred] Thêm payment result route có bốn trạng thái rõ: processing (poll), paid (success + refresh công nợ/job), failed/cancelled (retry), expired (tạo order mới). Không tin query `vnp_ResponseCode` để hiển thị thành công nếu BE order chưa `PAID`.
- [verified] Cập nhật `ClientServiceAgreementsPage`, `ClientJobsListPage`, `JobDetailPanel` để dùng adapter mới; regression-test shared `JobDetailPanel` nhằm đảm bảo CTA thanh toán không xuất hiện ở Candidate/Affiliate/Public contexts.

### 6.6 Admin FE và payout Affiliate

- [verified] `AdminFinancePage` thêm tab “Giao dịch Client” với TxnRef, loại phí, company, amount, trạng thái gateway, thời điểm, lỗi/mismatch và action đối soát. Form ghi nhận service fee thủ công chuyển vào menu “Ngoại tuyến / xử lý ngoại lệ”.
- [verified] `PostingFeePaymentsPanel` không còn là màn hình Admin xác nhận mọi khoản; đổi thành exception queue hoặc hợp nhất vào transaction tab.
- [verified] Các tab hoa hồng, payout, bảo hành và rule “chỉ duyệt hoa hồng sau khi Client đã trả phí” giữ nguyên. VNPAY thu tiền từ Client; Admin vẫn chuyển hoa hồng cho Affiliate theo `Payout` hiện tại.

### 6.7 Security, reliability và observability

- [inferred] Dùng HMACSHA512 trên canonical query theo đúng tài liệu VNPAY; compare constant-time; chỉ chấp nhận `vnp_ResponseCode=00` và `vnp_TransactionStatus=00`; kiểm tra exact amount, TxnRef, TmnCode, expiry và order state.
- [inferred] Rate limit create/status/admin actions; IPN không dùng JWT nhưng giới hạn input length, strict parameter allowlist và signature. Không dựa duy nhất vào source IP vì hạ tầng/proxy có thể đổi.
- [inferred] Structured logs/metrics theo `paymentOrderId` và `TxnRef`: create count, success/failure, bad signature, amount mismatch, duplicate IPN, processing latency, QueryDR result. Alert khi mismatch/bad signature tăng hoặc order processing quá ngưỡng.
- [inferred] QueryDR worker hoặc Admin retry xử lý order quá lâu; refund API chưa nằm trong deliverable này nhưng schema phải không khóa đường thêm `REFUNDED/PARTIALLY_REFUNDED` sau này.

## 7. Implementation Sequence

1. **Chốt contract và lifecycle:** viết state table cho payment order, VNPAY response mapping, source eligibility, IPN `RspCode`; thêm config model và fail-fast validation, chưa đổi UI.
2. **Thêm schema:** entity, constants, DbSet/mapping, repository interfaces/implementation, migration, model snapshot và generated SQL; thêm constraint/idempotency indexes trước khi có callback.
3. **Thêm provider abstraction:** URL generation, canonicalization, HMAC verify, QueryDR client; unit-test bằng fixed vectors, amount × 100, Unicode/order info, encoding và sai signature.
4. **Thêm create/status queries:** company ownership, source state, CREDIT rejection, min/positive amount, one active order, retry after terminal failure; trả payment URL do BE ký.
5. **Tách completion routines:** trích business mutations từ hai handler hiện có; cho manual commands gọi lại routine; chạy toàn bộ regression backend trước khi thêm IPN.
6. **Thêm IPN/Return endpoints:** endpoint group anonymous riêng; transaction + row lock + event dedupe; Return chỉ redirect; mapping đúng response codes.
7. **Thêm reconciliation:** QueryDR cho order stale/exception; Admin list/filter/detail; audit đầy đủ; tuyệt đối không tự chuyển `PAID` khi QueryDR chưa xác nhận success.
8. **Thêm unified billing query:** trả một page cho ba dịch vụ, có payable metadata; chuyển `ClientBillingPage` khỏi N+1.
9. **Chuyển Client UI:** payment API/types, launch modal, result page/polling, cột thao tác, empty/error/retry states; migrate ba direct callers.
10. **Chuyển Admin UI:** transaction/exception tab; ẩn manual flow sau action “Ghi nhận ngoại tuyến”; giữ commission/payout không đổi.
11. **Compatibility cleanup:** chặn Client gọi trực tiếp `posting-fee/pay` và `deposit/notify`; chỉ cho Admin permission/offline path hoặc deprecate route có thời hạn. Xóa local demo payment state sau khi không còn caller.
12. **Production readiness:** cấu hình Sandbox trong dev/staging; HTTPS public IPN; secrets; runbook chuyển Production; monitoring; smoke test end-to-end Sandbox; chạy full CI và migration validation.

Mỗi bước phải để tree build/test được; không xóa route cũ trước khi FE mới đã chuyển và test pass.

## 8. Test Strategy

### Backend unit/integration

- [inferred] Tạo order: source thuộc company + unpaid → payment URL đúng; source company khác/CREDIT/PAID/cancelled/amount 0 → 403/409/400; hai request đồng thời → một active order.
- [inferred] Signature vectors: parameter sort/encoding, `vnp_Amount = amount * 100`, HMACSHA512 valid/invalid, missing/duplicate/oversized parameter, wrong TmnCode.
- [inferred] IPN success cho từng nguồn:
  - posting fee → fee `PAID`, job `ACTIVE`, expiry/history/notifications đúng;
  - DEPOSIT → service fee `PAID`, sourcing job mở;
  - PLACEMENT/SETTLEMENT → fee `PAID`, các gate commission/replacement giữ đúng.
- [inferred] IPN failure: wrong signature, wrong amount, unknown TxnRef, expired order, failed response/status, company mismatch → không mutation payable, event/audit phù hợp, đúng VNPAY `RspCode`.
- [inferred] Idempotency: gửi cùng IPN 2–10 lần và hai thread song song → một commit business, một notification set, không mở job/replacement hai lần; duplicate response đúng contract.
- [inferred] Atomicity: completion throw sau khi event nhận → order/payable không ở trạng thái nửa vời; retry có thể xử lý lại an toàn.
- [verified] Cập nhật `Mf05FinanceTests.cs`, `SourcingFinanceTests.cs`, `JobManagementCommandHandlerTests.cs`; giữ các scenario hiện tại về reconciliation, deposit mở job, posting payment activation, commission chờ Client trả phí và payout retry.

### Frontend

- [inferred] `ClientBillingPage.test.tsx`: hiển thị CTA đúng nguồn; không CTA cho CREDIT/PAID/reconciliation; click tạo order và redirect; processing poll rồi success refresh; API error không báo thanh toán thành công.
- [inferred] Thêm test cho payment result route: success chỉ khi BE order `PAID`; Return code 00 nhưng BE còn pending vẫn hiển thị “Đang xác nhận”; timeout/retry/expired/cancelled.
- [inferred] Test adapter modal và ba caller: props cũ vẫn mở đúng khoản, không còn MB/VietQR/localStorage/`payPostingFee`/`notifyDeposit`; Candidate/Affiliate/Public không thấy Client payment CTA.
- [inferred] `Mf05Pages.test.tsx`: transaction tab, bad-signature/mismatch labels, QueryDR action; manual offline action bị ẩn hoặc permission-gated; commission/payout tests vẫn pass.

### Verification commands

```text
dotnet restore HRConnect/HRConnect.sln
dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore
dotnet test HRConnect/HRConnect.sln --configuration Release --no-build
dotnet ef migrations has-pending-model-changes --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation
cd HRConnect-FE && npm ci --no-audit --no-fund
cd HRConnect-FE && npm run lint
cd HRConnect-FE && npm test -- --run
cd HRConnect-FE && npm run build
```

- [verified] Các lệnh build/test/lint trên khớp script và CI hiện tại (`.github/workflows/ci.yml:66-126`, `HRConnect-FE/package.json`).
- [inferred] Thêm smoke test Sandbox thủ công/Playwright: tạo order thực → thanh toán bằng test bank → nhận IPN HTTPS → Client thấy paid → job/fee đổi đúng → Admin thấy transaction; lưu TxnRef/log correlation làm evidence.

## 9. Risk and Impact Analysis

- **CRITICAL – shared payment component:** [graph] `PaymentDemoModal` có ba direct consumers và các job-detail role ở depth 2. Mitigation: adapter props, migrate từng caller, role regression tests; không xóa component giữa chừng.
- **HIGH – tiền và kích hoạt nghiệp vụ:** [verified] Hai handler payment hiện vừa đổi phí vừa mở job/slot và gửi notification trước một `SaveChanges`. Refactor sai có thể thu tiền nhưng không mở job hoặc chạy side effect hai lần. Mitigation: shared completion service + transaction + idempotency + regression tests.
- **HIGH – callback giả mạo/replay:** [inferred] IPN anonymous là bề mặt công khai. Mitigation: strict HMAC/amount/TmnCode/TxnRef/state checks, event fingerprint unique, constant-time compare, rate/input limits, redacted logs.
- **HIGH – concurrency:** [inferred] IPN retry, Return polling, QueryDR và Admin reconcile có thể cùng chạm một order. Mitigation: PostgreSQL row lock, unique constraints, optimistic token, state transition table và atomic commit.
- **MEDIUM – compatibility route:** [verified] FE hiện gọi hai payment routes trong `jobsApi`; Admin panel và shared modal cũng dùng chúng. Mitigation: giữ route offline có permission trong một release, chuyển caller, tìm zero usages rồi mới deprecate.
- **MEDIUM – migration:** [verified] `ServiceFee` có check `(status='PAID') = (paid_at IS NOT NULL)` và source constraints; migration/order completion phải không vi phạm dữ liệu cũ. Rollout DB trước app; rollback app không được xóa payment tables.
- **MEDIUM – provider availability:** [inferred] Client có thể thanh toán nhưng IPN trễ. Mitigation: processing UI, polling, QueryDR, stale-order monitor; không dùng Return để giả success.
- **LOW – performance:** [verified] billing hiện N+1; unified server query giảm request. Transaction list phải paginate/index, không render/load toàn bộ events.
- **Observability:** [inferred] dashboard/alerts phải phân biệt gateway failure, invalid callback, business-completion failure và notification failure; tất cả log gắn order ID/TxnRef nhưng không log secret/hash.

## 10. Files Expected to Change

| File | Symbols | Reason |
| ---- | ------- | ------ |
| `HRConnect/HRConnect.Domain/Entities/PaymentOrder.cs` (new) | new payment aggregate | Lưu lần thử thanh toán độc lập với payable source. |
| `HRConnect/HRConnect.Domain/Entities/PaymentGatewayEvent.cs` (new) | new callback event aggregate | Idempotency, audit và troubleshooting callback. |
| `HRConnect/HRConnect.Domain/Constants/PaymentStates.cs` (new) | new lifecycle constants | Một state machine dùng chung BE/DTO/tests. |
| `HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs` | `DbSet`, entity mappings | Constraints, indexes, relationships. |
| `HRConnect/HRConnect.Infrastructure/Migrations/<timestamp>_AddVnPayPayments.cs` + snapshot | EF migration | Tạo schema production. |
| `HRConnect/HRConnect.Application/Common/Interfaces/...` (new/update) | payment gateway/repository/completion contracts | Tách provider và persistence khỏi use cases. |
| `HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs` | payment/order lock methods | Atomic reads/writes và transaction-safe lookup. |
| `HRConnect/HRConnect.Infrastructure/Services/Payments/...` (new) | VNPAY adapter/settings/reconciliation | Sign/verify/build URL/QueryDR. |
| `HRConnect/HRConnect.Infrastructure/DependencyInjection.cs` | payment registrations/options | Bind, validate, HttpClient, optional worker. |
| `HRConnect/HRConnect.Application/Features/Finance/Payments/...` (new) | create/status/IPN/admin use cases | Orchestrate payment lifecycle. |
| `HRConnect/HRConnect.Application/Features/Finance/Commands/Settlement/SettlementCommands.cs` | service-fee payment handler | Delegate to shared completion, preserve side effects. |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/RecordJobPostingFeePayment/RecordJobPostingFeePaymentCommand.cs` | posting-fee handler | Delegate to shared completion; restrict manual use. |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/Deposit/NotifyJobDepositCommand.cs` | legacy deposit notify | Deprecate/restrict to offline fallback. |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/Deposit/ConfirmJobDepositCommand.cs` | legacy deposit confirm | Delegate to shared completion or keep offline only. |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Payments/PaymentEndpoints.cs` (new) | public/auth payment routes | Create/status/IPN/Return/Admin queries. |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Finance/FinanceEndpoints.cs` | manual service-fee route | Move to explicit offline exception semantics. |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs` | old payment/deposit routes | Remove Client self-confirmation; compatibility transition. |
| `HRConnect/HRConnect.Presentation/Program.cs` | endpoint registration | Map payment endpoints. |
| `HRConnect/HRConnect.Presentation/appsettings.json`, `HRConnect/.env.example` | VNPAY settings | Sandbox/Production configuration contract. |
| `docs/database/hrconnect-schema.sql`, `docs/database/hrconnect-migrations-idempotent.sql` | generated schema | Đồng bộ migration artifacts. |
| `HRConnect-FE/src/services/api/paymentApi.ts` (new), finance/job APIs/types | FE contracts | Create/status/admin transaction calls; bỏ self-record calls. |
| `HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.tsx` | modal adapter | Launch VNPAY; xóa demo/local success. |
| `HRConnect-FE/src/features/client-console/ClientBillingPage.tsx` | `useBillingRows`, table actions | Unified billing, pay/retry/status UX. |
| `HRConnect-FE/src/features/client-console/PaymentResultPage.tsx` (new), router | result/polling page | Return UX dựa vào BE state. |
| `ClientServiceAgreementsPage.tsx`, `ClientJobsListPage.tsx`, `JobDetailPanel.tsx` | three direct consumers | Migrate shared component safely. |
| `AdminFinancePage.tsx`, `PostingFeePaymentsPanel.tsx` | transaction/exception UI | Tự động hóa thu tiền, giữ manual fallback. |
| Backend/FE test files đã nêu ở §8 | existing + new tests | Security, lifecycle, concurrency và regression. |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Tích hợp VNPAY Sandbox có thể chuyển Production để Client thanh toán các khoản MF-05; IPN xác thực là nguồn duy nhất cập nhật PAID; giữ payout Affiliate ngoài phạm vi."
  acceptance_criteria:
    - "Client thanh toán được JobPostingFee và ServiceFee PLACEMENT/DEPOSIT/SETTLEMENT từ giao diện; CREDIT không có CTA thu tiền."
    - "Không endpoint Client nào có thể tự gửi payment reference để đổi payable thành PAID."
    - "IPN hợp lệ, đúng amount/TxnRef/TmnCode và success codes cập nhật order + payable + side effects trong một transaction."
    - "IPN giả mạo, mismatch, duplicate hoặc đồng thời không tạo paid/notification/activation trùng."
    - "Return URL không trực tiếp cập nhật PAID; result page đọc trạng thái BE và xử lý IPN trễ."
    - "Admin thấy giao dịch tự động và exception; manual recording chỉ là fallback được audit."
    - "Commission/Payout Affiliate và các gate hiện tại không bị thay đổi hành vi."
    - "Cùng code chạy Sandbox/Production bằng cấu hình; secrets không xuất hiện trong FE/repository/log."
  evidence_provenance:
    schema_version: 2
    head_commit: "e75850df2c936d8a82bbd9b323c82a155198995e"
    generated_plan_path: "docs/plans/2026-10-30-gitnexus-plan-vnpay-mf05-integration.md"
    global_dirty_digest:
      algorithm: "sha256"
      canonicalization: "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records"
      value: "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
    cited_path_manifest:
      - path: ".github/workflows/ci.yml"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:52a6a491e8c90f794f2f9a34aa96d853c8641266ae3cf954f6243aa0da8a166d"
        index_digest: "sha256:52a6a491e8c90f794f2f9a34aa96d853c8641266ae3cf954f6243aa0da8a166d"
        worktree_digest: "sha256:b1b2047ae67159138076b6182a892c5f6829f5319598d8e73d62968173f4b349"
        untracked_digest: absent
      - path: "HRConnect-FE/package.json"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:5f3126429047235bd1d2e7664aade19669de0b257460c7f73bcbbe5de949f1c4"
        index_digest: "sha256:5f3126429047235bd1d2e7664aade19669de0b257460c7f73bcbbe5de949f1c4"
        worktree_digest: "sha256:d9d3e33c93d5da47ad6ae45d454be6ceb123f801719f57bba90910fefe96affb"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/client-console/ClientBillingPage.test.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:95f8bb6ccebf13b9eaf15c8a77df312f94bf6acde8dc07773b80ef5fee6b68f8"
        index_digest: "sha256:95f8bb6ccebf13b9eaf15c8a77df312f94bf6acde8dc07773b80ef5fee6b68f8"
        worktree_digest: "sha256:21df80a404e3ffa006d8d643c72714c1fe13f519caa21da638523aa9f13fc7ad"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/client-console/ClientBillingPage.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:cef98beef190dbf1a67f7cf4f298dba9f7b1af707d78308c999cb056115bdbb7"
        index_digest: "sha256:cef98beef190dbf1a67f7cf4f298dba9f7b1af707d78308c999cb056115bdbb7"
        worktree_digest: "sha256:29b4d052e8b72bc33daef7197afc6f697c295cec84264ad95c6db6a7240007c1"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/client-console/ClientServiceAgreementsPage.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:e33ac2c2254d73f9a7510ecb5d0448ec32b4420ff4e236843c4c619016e4187d"
        index_digest: "sha256:e33ac2c2254d73f9a7510ecb5d0448ec32b4420ff4e236843c4c619016e4187d"
        worktree_digest: "sha256:1159416eaa65a449810250c9be8d4e84c2861747ede4ea60fd1b9f4aa7e48c0a"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/finance-mf05/AdminFinancePage.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:673262af57a19901ed8a2ea123c448953aad25ef82e0f6714ec9e76cc95c1707"
        index_digest: "sha256:673262af57a19901ed8a2ea123c448953aad25ef82e0f6714ec9e76cc95c1707"
        worktree_digest: "sha256:e7bb9e55c54006d00afc49286fe49249c65cea1e0fdd6cf2854a9eba896e4aab"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/finance-mf05/Mf05Pages.test.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:bb665be65aff4f0fca516c19abfb2a98b61d8084839077a22e270c8bde357e6a"
        index_digest: "sha256:bb665be65aff4f0fca516c19abfb2a98b61d8084839077a22e270c8bde357e6a"
        worktree_digest: "sha256:953808be8fd3a0fd232c9a2c629dcdac0b94f804b34ce4e9df6c17ea11a3bd91"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/finance-mf05/PostingFeePaymentsPanel.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:50bfc103a307ba0b741e98b2fa438bba187e8469623edca5e86540ce564f9260"
        index_digest: "sha256:50bfc103a307ba0b741e98b2fa438bba187e8469623edca5e86540ce564f9260"
        worktree_digest: "sha256:61fb0eb83252f096b2fde1078c54add294ae028ec88f3cf824544a600bafc770"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/jobs-mf01/ClientJobsListPage.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:0d860188a0adbd2b636e6f06fc361e898795c77ec084e80a2abed07a4a2c60e5"
        index_digest: "sha256:0d860188a0adbd2b636e6f06fc361e898795c77ec084e80a2abed07a4a2c60e5"
        worktree_digest: "sha256:ba83bbc9731b3efb3b1c9e3abe2618c37992df0af5d6aeff02ac1841f2f30059"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/jobs-mf01/JobDetailPanel.test.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:6fb2271769eb1d6a55f76e390188eca1fd14669af66cdc38e9af32417e0595ff"
        index_digest: "sha256:6fb2271769eb1d6a55f76e390188eca1fd14669af66cdc38e9af32417e0595ff"
        worktree_digest: "sha256:8afdfa7eb4163887c85cbe872c5e27343a472026cc222ad5fee754975eeec87b"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/jobs-mf01/JobDetailPanel.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:5b0cf48cb19ecb8eb68a962a544040b9e8b97a333dc803ef0c731241feba59bf"
        index_digest: "sha256:5b0cf48cb19ecb8eb68a962a544040b9e8b97a333dc803ef0c731241feba59bf"
        worktree_digest: "sha256:e2dd9c6625c6504926c9a8f7428610af796e556b6ab6dee63084b78d986af5ce"
        untracked_digest: absent
      - path: "HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.tsx"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:9bfe3cade0e0c1815ecfccd74ca97600a6aca18894e6a971546fbc061b2e8694"
        index_digest: "sha256:9bfe3cade0e0c1815ecfccd74ca97600a6aca18894e6a971546fbc061b2e8694"
        worktree_digest: "sha256:0deadf467c55faacfb8dd6edb91917d7770510b2b08588d5feddde1132df1c70"
        untracked_digest: absent
      - path: "HRConnect-FE/src/services/api/financeApi.ts"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:216da8f085d4be3a77f9b15f9c53aa2554c9432291068197be0791b8fcb3f17c"
        index_digest: "sha256:216da8f085d4be3a77f9b15f9c53aa2554c9432291068197be0791b8fcb3f17c"
        worktree_digest: "sha256:3ee3504c12bed1470ef5b24a69cac52577326214bfc8784cb9529883ecbd8de1"
        untracked_digest: absent
      - path: "HRConnect-FE/src/services/api/jobsApi.ts"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:51f57004c848219610705cc7e94e73b20d0078832beb13520df4e8576033093b"
        index_digest: "sha256:51f57004c848219610705cc7e94e73b20d0078832beb13520df4e8576033093b"
        worktree_digest: "sha256:310af976553af3abd076d3617be9916db005d549ec0233b6ffed335b8cff6bd2"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IFinanceRepository.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:af9ad914330d1555159d7b2d2481d5f325381eeac57d472da4dbc307ba679610"
        index_digest: "sha256:af9ad914330d1555159d7b2d2481d5f325381eeac57d472da4dbc307ba679610"
        worktree_digest: "sha256:a7d74ce7ffeb626d1ecf9d73487bf10421dfda751c6e83a792dff7ec4f6b89c5"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Application/Features/Finance/Commands/Settlement/SettlementCommands.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:c2cf7174ad2a4baf1e247e91187ea9e8dc23cb64e964fd943cc2e02a91714f44"
        index_digest: "sha256:c2cf7174ad2a4baf1e247e91187ea9e8dc23cb64e964fd943cc2e02a91714f44"
        worktree_digest: "sha256:5fcea20cdf7dbabfffd22a6320d675ffc8f91f141c18a7a09c8a4b3335b1ce19"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Application/Features/Jobs/Commands/Deposit/ConfirmJobDepositCommand.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:bff15fc4cda59eb11fd64f86632065a8665d0cf69283542054df91dccb283832"
        index_digest: "sha256:bff15fc4cda59eb11fd64f86632065a8665d0cf69283542054df91dccb283832"
        worktree_digest: "sha256:c0e8baba4e8f993a51c8735d19f6ed47b130554b7d9d67b233c58a80202877b9"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Application/Features/Jobs/Commands/Deposit/NotifyJobDepositCommand.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:69294c1f451f1dabbdccdd42a48ffb778f3e8c32bcde14eee7f52890aa755da4"
        index_digest: "sha256:69294c1f451f1dabbdccdd42a48ffb778f3e8c32bcde14eee7f52890aa755da4"
        worktree_digest: "sha256:d8b21469dd3bab312ff06ed3822f522af4bf9d821392ea6d263972ad4e5e5a97"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Application/Features/Jobs/Commands/RecordJobPostingFeePayment/RecordJobPostingFeePaymentCommand.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:44e6d1ac65e55ed8e9b849c59810a8584b788b1f51222f1f8fcd987a68ea7493"
        index_digest: "sha256:44e6d1ac65e55ed8e9b849c59810a8584b788b1f51222f1f8fcd987a68ea7493"
        worktree_digest: "sha256:8bfa1df4207ca118ad921b2dd3e5b273b4b38b24bb12a7d2a538a8aaae836532"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Domain/Constants/FinanceStates.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:ab6c58446206e4d3f4254b175d480493dcdd8f7445d2d12e7a4391e9c0ed950b"
        index_digest: "sha256:ab6c58446206e4d3f4254b175d480493dcdd8f7445d2d12e7a4391e9c0ed950b"
        worktree_digest: "sha256:d35a4e06a013dc95e1722d55c03566cf85340f0d887bcd570fed92f6e992a772"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Domain/Entities/JobPostingFee.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:24913ba1434c04d66c6bf2cac966da637e1e0e5605a7fed5698dd5e19f59bace"
        index_digest: "sha256:24913ba1434c04d66c6bf2cac966da637e1e0e5605a7fed5698dd5e19f59bace"
        worktree_digest: "sha256:5ad48f5b754dc804644455b6bdc42bc2c0f082c2221e8424f5bcd534a2bd5a2a"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Domain/Entities/ServiceFee.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:ccf231af637d53ef1f1a6343f4055ac633fd34d06adbe146c29ff8072cdb1f2c"
        index_digest: "sha256:ccf231af637d53ef1f1a6343f4055ac633fd34d06adbe146c29ff8072cdb1f2c"
        worktree_digest: "sha256:eecfecbfea28dc4129cbd89493618b4943f557644c7db282111c6582e39ffe30"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:8436352498681af42269bd5c353f625956e1b3748ddda43ed74c02f4b02b108a"
        index_digest: "sha256:8436352498681af42269bd5c353f625956e1b3748ddda43ed74c02f4b02b108a"
        worktree_digest: "sha256:550a328d1ea0c6d05b48988981adf0b98ee6248c67fee8a03a8bd6d63dae2443"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:0b807decf6d2da4c38f0ede18f6bf60418d15dc4ee3308d8e9bc0c9e1982b1bd"
        index_digest: "sha256:0b807decf6d2da4c38f0ede18f6bf60418d15dc4ee3308d8e9bc0c9e1982b1bd"
        worktree_digest: "sha256:d4a9c1328988d181d0b41e1a7ad48714878ba83312b67e6a4fcb9ec281cb00dd"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:490998431da54c146c38ff31781996cedda8b8245ae0517f6418ee99205929ee"
        index_digest: "sha256:490998431da54c146c38ff31781996cedda8b8245ae0517f6418ee99205929ee"
        worktree_digest: "sha256:8b02a614b0de879a408c07611739a83b8621a209e193b9b59b28cd6a461924c2"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Presentation/Endpoints/V1/Finance/FinanceEndpoints.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:8007815d1203cf79d69af6e39ccc36584b42e6001e3d2ff9ffebf9fa73d62bff"
        index_digest: "sha256:8007815d1203cf79d69af6e39ccc36584b42e6001e3d2ff9ffebf9fa73d62bff"
        worktree_digest: "sha256:3497d5a5819fbe3ad2fc38e39506df5ed4b3c6ee9ce63581e49cbad762a5f798"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:76f4b3034be335be1e494873d6dd6d4c475e7130cc402d5c80091cf47dbe1903"
        index_digest: "sha256:76f4b3034be335be1e494873d6dd6d4c475e7130cc402d5c80091cf47dbe1903"
        worktree_digest: "sha256:1a3db4669166d7e8f1ebcb01fbf5e466e2d8b7c10a769548485dddf0a80e4373"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.Presentation/Program.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:e5862040ac0d878f569f0447042397f1ee3d8f1f2503cf09f669623212083800"
        index_digest: "sha256:e5862040ac0d878f569f0447042397f1ee3d8f1f2503cf09f669623212083800"
        worktree_digest: "sha256:c24982a453665a1e6e293e58564980d5c415e0de7c3312a9e76bdfe65528b264"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.UnitTests/Features/Finance/Mf05FinanceTests.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:fc05c1a0ac2eb045cd9311d5b322e170cf4dbbf5651cb2e48b19a5ba454d82fa"
        index_digest: "sha256:fc05c1a0ac2eb045cd9311d5b322e170cf4dbbf5651cb2e48b19a5ba454d82fa"
        worktree_digest: "sha256:8fb831bab34a60f62a21e0daa8b84952b283dade733d2c80c5a561e3f7db3fc5"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.UnitTests/Features/Finance/SourcingFinanceTests.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:c5300f5993fc09f7e1b700e478e40b210a282430984931df69df64fb4d8ba40a"
        index_digest: "sha256:c5300f5993fc09f7e1b700e478e40b210a282430984931df69df64fb4d8ba40a"
        worktree_digest: "sha256:6cd89ed75114bc1add2f7728ecf59c2960766a994573479501e12d080e452298"
        untracked_digest: absent
      - path: "HRConnect/HRConnect.UnitTests/Features/Jobs/JobManagementCommandHandlerTests.cs"
        object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }
        state: clean
        rename_from: null
        rename_to: null
        head_digest: "sha256:11b5910c8720ffbc7c8d6d84632024f6e56f56275bfcad9aee6233381c337953"
        index_digest: "sha256:11b5910c8720ffbc7c8d6d84632024f6e56f56275bfcad9aee6233381c337953"
        worktree_digest: "sha256:cacd2545fc05382c8425943ef6bbb2ca0e248455e2719f66b2b6f8f50b221862"
        untracked_digest: absent
  primary_symbols:
    - symbol: "SettlementCommandHandlers.Handle(RecordServiceFeePaymentCommand)"
      file: "HRConnect/HRConnect.Application/Features/Finance/Commands/Settlement/SettlementCommands.cs"
      lines: "90-148"
      role: "Current service-fee completion and downstream business side effects."
    - symbol: "RecordJobPostingFeePaymentCommandHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Jobs/Commands/RecordJobPostingFeePayment/RecordJobPostingFeePaymentCommand.cs"
      lines: "41-199"
      role: "Current posting-fee completion and job activation."
    - symbol: "PaymentDemoModal.handleConfirmPayment"
      file: "HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.tsx"
      lines: "75-149"
      role: "Current insecure/demo client-side payment confirmation path."
    - symbol: "useBillingRows"
      file: "HRConnect-FE/src/features/client-console/ClientBillingPage.tsx"
      lines: "60-132"
      role: "Current read-only billing composition with posting-fee N+1."
    - symbol: "FinanceEndpoints.MapFinanceEndpoints"
      file: "HRConnect/HRConnect.Presentation/Endpoints/V1/Finance/FinanceEndpoints.cs"
      lines: "38-169"
      role: "Current authenticated MF-05 API boundary."
  related_symbols:
    - symbol: "ConfirmJobDepositCommandHandler.Handle"
      relationship: "business-side-effect overlap"
      relevance: "Online DEPOSIT success must open the job without manual double-confirmation."
    - symbol: "NotifyJobDepositCommandHandler.Handle"
      relationship: "legacy flow"
      relevance: "Must not remain a Client-controlled success path."
    - symbol: "ClientServiceAgreementsPage / ClientJobsListPage / JobDetailPanel"
      relationship: "direct consumers of PaymentDemoModal"
      relevance: "All three require compatibility migration and tests."
    - symbol: "Mf05FinanceTests / SourcingFinanceTests / JobManagementCommandHandlerTests"
      relationship: "test-of current completion behavior"
      relevance: "Regression suite for refactor."
  execution_path:
    - "Client requests payment for a payable source owned by its company."
    - "BE locks/validates source, snapshots DB amount/currency, creates one active PaymentOrder and signs VNPAY URL."
    - "Browser redirects to VNPAY; no local paid mutation occurs."
    - "VNPAY calls anonymous HTTPS IPN; BE verifies HMAC/TmnCode/TxnRef/amount/codes and locks order/source."
    - "Shared completion routine changes payable and downstream job/replacement/notification state in one transaction."
    - "Return endpoint redirects browser to clean FE result route; FE polls BE order state until terminal."
    - "Admin monitors transactions/exceptions; Affiliate payout remains the existing separate flow."
  pdg_constraints:
    - description: "Posting fee mutation and all job activation side effects are controlled by the unpaid guard and commit at the end."
      affected_statements: ["RecordJobPostingFeePaymentCommand.cs:93", "RecordJobPostingFeePaymentCommand.cs:98-184"]
      implementation_consequence: "Shared completion must preserve guard/order/atomic commit and be idempotent."
    - description: "Service fee payment guards precede replacement/job/notification side effects and one SaveChanges."
      affected_statements: ["SettlementCommands.cs:92-112", "SettlementCommands.cs:114-148"]
      implementation_consequence: "IPN cannot bypass reconciliation or run downstream effects outside the transaction."
    - description: "Deposit catch currently falls through to local success behavior."
      affected_statements: ["PaymentDemoModal.tsx:78-95", "PaymentDemoModal.tsx:99-142"]
      implementation_consequence: "Remove fallback/local success entirely; only redirect then observe BE state."
  architectural_patterns:
    - pattern: "CQRS/MediatR Minimal API"
      example_location: "HRConnect/HRConnect.Presentation/Endpoints/V1/Finance/FinanceEndpoints.cs"
      usage_guidance: "Endpoints remain thin; application handlers own validation/orchestration."
    - pattern: "Repository + UnitOfWork with PostgreSQL row lock fallback"
      example_location: "HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs:89-107"
      usage_guidance: "Use transaction/row locks for PaymentOrder and payable source; EF InMemory fallback only for tests."
    - pattern: "Options + typed HttpClient + hosted worker"
      example_location: "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs:153-190"
      usage_guidance: "Register VNPAY settings/client/reconciliation worker consistently."
    - pattern: "React Query API services"
      example_location: "HRConnect-FE/src/features/client-console/ClientBillingPage.tsx"
      usage_guidance: "Mutations invalidate billing/job/notification/order keys; success comes from server state."
  files_to_modify:
    - file: "HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs"
      symbols: ["DbSets", "OnModelCreating"]
      intended_change: "Map payment orders/events and constraints."
    - file: "HRConnect/HRConnect.Application/Features/Finance/Commands/Settlement/SettlementCommands.cs"
      symbols: ["SettlementCommandHandlers.Handle(RecordServiceFeePaymentCommand)"]
      intended_change: "Delegate to shared idempotent completion while preserving side effects."
    - file: "HRConnect/HRConnect.Application/Features/Jobs/Commands/RecordJobPostingFeePayment/RecordJobPostingFeePaymentCommand.cs"
      symbols: ["RecordJobPostingFeePaymentCommandHandler.Handle"]
      intended_change: "Delegate to shared completion and remove Client self-confirm semantics."
    - file: "HRConnect/HRConnect.Presentation/Endpoints/V1/Payments/PaymentEndpoints.cs"
      symbols: ["new payment endpoints"]
      intended_change: "Authenticated create/status/admin and anonymous IPN/Return routes."
    - file: "HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.tsx"
      symbols: ["PaymentDemoModal", "handleConfirmPayment"]
      intended_change: "Launch provider payment; remove demo confirmation."
    - file: "HRConnect-FE/src/features/client-console/ClientBillingPage.tsx"
      symbols: ["useBillingRows", "ClientBillingPage"]
      intended_change: "Unified billing plus pay/status/retry UX."
    - file: "HRConnect-FE/src/features/finance-mf05/AdminFinancePage.tsx"
      symbols: ["AdminFinancePage"]
      intended_change: "Transactions and exception reconciliation; manual fallback only."
  tests:
    - file: "HRConnect/HRConnect.UnitTests/Features/Finance/VnPayPaymentTests.cs"
      scenarios:
        - "valid create/IPN for each payable source → atomic PAID and correct side effects"
        - "invalid signature/TmnCode/amount/status/unknown TxnRef → no payable mutation"
        - "duplicate and concurrent IPN → exactly-once effects"
        - "Return before IPN → processing, never paid"
        - "QueryDR confirms stale order → same completion path"
    - file: "HRConnect/HRConnect.UnitTests/Features/Finance/Mf05FinanceTests.cs"
      scenarios: ["existing reconciliation/replacement/commission gates remain green"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Finance/SourcingFinanceTests.cs"
      scenarios: ["VNPAY deposit success opens sourcing job once"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Jobs/JobManagementCommandHandlerTests.cs"
      scenarios: ["posting payment activation remains green through shared completion"]
    - file: "HRConnect-FE/src/features/client-console/ClientBillingPage.test.tsx"
      scenarios: ["payability CTA", "redirect", "polling states", "CREDIT/paid/mismatch restrictions"]
    - file: "HRConnect-FE/src/features/finance-mf05/Mf05Pages.test.tsx"
      scenarios: ["transaction queue", "exception actions", "manual fallback permission", "payout unchanged"]
    - file: "HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.test.tsx"
      scenarios: ["no local success/fallback", "all three caller modes", "API failure remains failure"]
  verification_commands:
    - "dotnet restore HRConnect/HRConnect.sln"
    - "dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore"
    - "dotnet test HRConnect/HRConnect.sln --configuration Release --no-build"
    - "dotnet ef migrations has-pending-model-changes --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation"
    - "cd HRConnect-FE && npm ci --no-audit --no-fund"
    - "cd HRConnect-FE && npm run lint"
    - "cd HRConnect-FE && npm test -- --run"
    - "cd HRConnect-FE && npm run build"
  risks:
    - "PaymentDemoModal has CRITICAL shared-component blast radius."
    - "Duplicate/concurrent IPN can double-run job, replacement or notification side effects without locks/idempotency."
    - "Return URL must never be treated as payment authority."
    - "Manual and automatic completion must not diverge into two business implementations."
    - "Migration must preserve old PAID rows and existing ServiceFee constraints."
  assumptions:
    - "Verify the VNPAY Sandbox merchant provides TmnCode/HashSecret and allows the chosen public HTTPS IPN/Return URLs before E2E testing."
    - "Verify VNPAY's current minimum amount and exact IPN RspCode mapping against the merchant package/docs during implementation."
    - "Frontend production origin đã chốt là https://www.hrconnectvn.online; verify backend production origin trước khi cấu hình IPN và forwarded client IP handling."
    - "Verify whether offline bank transfer fallback remains a business requirement; if yes, keep it Admin-only with reason/evidence/audit."
  open_questions:
    - "Should QueryDR run automatically on a schedule, or only via Admin action for the first release? Recommended: worker for stale PROCESSING plus Admin retry."
    - "Does the team want refund support in the same iteration? Recommended: defer API/UI, but reserve lifecycle/schema compatibility now."
  avoid:
    - "Do not repeat full repository discovery."
    - "Do not replace established patterns without evidence."
    - "Do not let FE submit authoritative amount, paid status, paidAt or payment reference."
    - "Do not mark paid from Return URL or localStorage."
    - "Do not log or expose VNPAY HashSecret/secure hash."
    - "Do not remove PaymentDemoModal before migrating and testing all three direct consumers."
    - "Do not change Affiliate payout behavior as part of Client VNPAY collection."
```

## 12. Assumptions and Open Questions

### Assumptions to verify before implementation

- [verified] Frontend production origin là `https://www.hrconnectvn.online`; canonical URL và VNPAY frontend result allowlist phải dùng origin này, không dùng domain Vercel hoặc bản thiếu `www`.
- [assumed] Nhóm đã nhận `TmnCode` và `HashSecret` Sandbox, đồng thời có backend HTTPS public để VNPAY gọi IPN. Kiểm tra bằng merchant portal và một callback smoke test trước khi viết E2E assertions.
- [assumed] Gói merchant hiện dùng chuẩn PAY 2.1.0/HMACSHA512 và response mapping giống tài liệu Sandbox. Xác minh lại trên bộ thông tin VNPAY gửi riêng cho merchant; bộ đó ưu tiên hơn sample công khai.
- [assumed] Thanh toán online chỉ thu VND. Nếu xuất hiện currency khác, create-order trả lỗi rõ ràng thay vì tự quy đổi.
- [assumed] Client company user đang có quyền xem công nợ là đối tượng được phép thanh toán. Nếu cần permission riêng (`payment.create_own`), thêm migration/seed RBAC trước khi mở CTA.
- [assumed] Offline transfer vẫn cần cho trường hợp ngoại lệ. Nếu nghiệp vụ bỏ hoàn toàn, xóa manual UI/route sau một release và data audit, không giữ đường bypass.

### Open questions / deferred follow-ups

- [assumed] QueryDR tự động: khuyến nghị worker quét order `PROCESSING` quá 2–5 phút với backoff và cap; nếu iteration ngắn, Admin action là tối thiểu nhưng phải có runbook.
- [assumed] Refund/partial refund: không thuộc yêu cầu hiện tại. Không triển khai nút hoàn tiền trong iteration này; chỉ tránh enum/schema khiến iteration sau phải phá dữ liệu.
- [assumed] Webhook allowlist IP: chưa dùng làm security gate chính cho tới khi VNPAY cung cấp dải IP chính thức cho merchant và reverse-proxy chain đã được cấu hình đúng.
- [assumed] Tên `PaymentDemoModal` nên đổi sau migration thành tên production; giữ adapter/export cũ một release để giảm blast radius.

## 13. Definition of Done

- [ ] Schema payment order/event có migration, constraints, indexes, model snapshot và idempotent SQL; migration chạy trên DB có dữ liệu cũ mà không sửa sai trạng thái hiện hữu.
- [ ] Client không thể tự đánh dấu `ServiceFee` hoặc `JobPostingFee` là `PAID`; amount/currency luôn lấy từ DB và kiểm tra ownership.
- [ ] Create-payment trả URL VNPAY đã ký; Sandbox hoạt động, Production chỉ cần đổi env/secrets/endpoints.
- [ ] IPN valid cho posting fee, deposit, placement và settlement chạy đúng side effects; Return URL không mutate payment.
- [ ] Invalid/mismatch/duplicate/concurrent callbacks không tạo paid hoặc side effect trùng; có audit/event và VNPAY response đúng contract.
- [ ] Client Billing có CTA/status/result/retry dễ hiểu; không còn hard-coded MB/VietQR, localStorage payment fallback hoặc success alert giả.
- [ ] Cả ba direct consumers của modal được migrate/test; Candidate/Affiliate/Public không lộ CTA Client.
- [ ] Admin có transaction/exception view, QueryDR/reconcile và manual offline fallback được permission/audit; commission/payout Affiliate không regress.
- [ ] Logs/metrics/alerts có order ID/TxnRef, bad signature, mismatch, duplicate, latency; không lộ secret/hash.
- [ ] Backend tests, FE tests, lint, release build, migration check và Sandbox E2E đều pass; lưu evidence TxnRef và callback log.
- [ ] Có runbook chuyển Sandbox → Production: merchant onboarding, env mapping, HTTPS IPN/Return, secret rotation, smoke test và rollback.
