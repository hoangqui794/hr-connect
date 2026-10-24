# Plan MF-04 · UC-41 Reconcile Placement (Internal HR đối soát placement)

> **Implementation status (23/10/2026):** implemented locally on `codex/mf04-placement-reconciliation`; not pushed. During implementation, reconciliation was made to block `PENDING → DUE`, `PENDING/DUE → OVERDUE`, and manual payment recording until verification is complete. Confirmation after the due date moves the fee directly to `OVERDUE`. Admin resolution keeps the original mismatch note and stores a separate resolution note. Targeted backend tests pass 87/87; relevant frontend tests pass 18/18; frontend production build and lint of changed files pass.

## Phần Khúc Ngọc Sơn bổ sung khi triển khai ngày 23/10/2026

Nội dung bên dưới là phần bổ sung dựa trên quá trình kiểm tra code thực tế. Kế hoạch gốc được giữ lại để theo dõi lịch sử; các điểm này không thay thế hoặc xóa quyết định cũ:

1. Chặn cả ba đường làm phí tiếp tục khi đối soát chưa `CONFIRMED`: tự động chuyển `DUE`, tự động chuyển `OVERDUE` và Admin ghi nhận thanh toán thủ công.
2. Khi HR/Admin xác nhận sau hạn thanh toán, phí chuyển thẳng sang `OVERDUE` thay vì gọi luồng `DUE` vốn không nhận ngày đã quá hạn.
3. Thêm `ResolutionNote` riêng cho kết quả xử lý của Platform Admin; giữ nguyên `Note` ban đầu của Internal HR để không mất lịch sử sai lệch.
4. Thêm màn đối soát riêng cho Internal HR và Platform Admin, đồng thời thêm thẻ hồ sơ cần xử lý tại trang Tài chính Admin.
5. Khóa nút “Ghi nhận đã thu” trên FE khi placement còn chờ đối soát; backend vẫn kiểm tra lại để không thể bỏ qua quy tắc bằng cách gọi API trực tiếp.
6. Bổ sung test cho `CV_SOURCING` không tạo đối soát và placement thay thế vẫn tạo đối soát nhưng không phát sinh phí tuyển mới.
7. Phần còn phải xác minh trước khi xem là hoàn tất: chạy migration/backfill trên PostgreSQL thật, kiểm tra tích hợp quyền 403 cho Client/Affiliate và chạy trọn kịch bản staging Client → Internal HR → Platform Admin. Đây là việc kiểm chứng còn lại, không phải chức năng mới.

Các thay đổi trên hiện chỉ nằm ở nhánh local `codex/mf04-placement-reconciliation`, chưa commit và chưa push lên remote.

- **Người làm:** Khúc Ngọc Sơn (chủ MF-04 / WF-04). Hỗ trợ: Nguyễn Văn Sang (MF-05, phần phí).
- **Ngày lập:** 23/10/2026, Quí lập từ code `main` mới nhất (`7b2b7262`).
- **Phạm vi:** chỉ dịch vụ `HEADHUNT_COD`. `CV_APPLICATION` và `CV_SOURCING` không đổi.
- **Lý do:** SRS UC-41 và `HRConnect/docs/main-flows.md` mục 4.1 đang ghi "[Planned] / chưa có code, cần chốt làm hay bỏ". Rủi ro là Client tự xác nhận đi làm hoặc đánh dấu "không nhận việc" rồi tuyển ngoài để né phí. Nhóm đã chốt **làm**, để kịp Review 2 / Defense 1.1.

## 1. Mục tiêu

Với job `HEADHUNT_COD`, sau khi Client xác nhận ứng viên **đã đi làm** hoặc **không nhận việc**, Internal HR phải đối soát kết quả đó với ứng viên hoặc Affiliate. Đối soát xong mới tính phí dịch vụ:

1. Placement mới tạo ở trạng thái đối soát `PENDING`. Phí dịch vụ đã tạo nhưng **chưa được chuyển sang `DUE`** và chưa báo phí cho Client.
2. HR có 3 kết quả đối soát:
   - **Xác nhận đúng** (`CONFIRMED`): phí chạy bình thường (`PENDING → DUE → PAID/OVERDUE`).
   - **Đúng nhưng sai ngày đi làm:** HR sửa ngày bằng chức năng `CorrectPlacementStartDate` đã có, rồi xác nhận.
   - **Không khớp** (`FLAGGED`): phí tiếp tục bị giữ, Platform Admin nhận thông báo để xử lý ngoài hệ thống. Hoa hồng của Affiliate giữ nguyên trạng thái hiện tại.
3. Với hồ sơ bị Client đánh dấu `NOT_STARTED`, HR cũng có một bản ghi đối soát `PENDING`:
   - `CONFIRMED` (đúng là không đi làm) thì đóng.
   - `FLAGGED` (ứng viên hoặc Affiliate nói là đã đi làm) thì báo Admin và Affiliate. Hồ sơ **không tự đổi trạng thái**; Admin xử lý theo điều khoản hợp đồng (Service Agreement).

## 2. Hiện trạng code trước khi triển khai (đã kiểm tra)

| Chỗ | Hiện tại |
|---|---|
| `Features/Recruitment/Commands/ConfirmStartWork/ConfirmStartWorkCommandHandler.cs` | Kiểm tra ngày, tạo `Placement` (`STARTED`), gọi `PlacementFinanceService.InitializeAsync` → tạo `Warranty`, `ServiceFee` (`PENDING`), `Commission` (`IN_WARRANTY`); hồ sơ → `PLACED`; ghi audit. |
| `Features/Recruitment/Commands/MarkNotStarted/MarkNotStartedCommandHandler.cs` | Hồ sơ `OFFER_ACCEPTED` → `NOT_STARTED` kèm lý do; ghi audit; không tạo phí. |
| `Features/Finance/Common/PlacementFinanceService.cs` | Chỉ áp dụng cho `HEADHUNT_COD`; `ServiceFee.Status = PENDING`, `DueDate = ActualStartDate + PaymentDueDays`. |
| `Features/Finance/Common/WarrantyProgressService.cs` → `MarkServiceFeeDueAsync` | Worker chuyển phí `PENDING → DUE` khi đến hạn nhắc và thông báo cho Client. **Đây là chỗ cần chặn khi chưa đối soát.** |
| `Features/Placements/Commands/CorrectPlacementStartDate` | HR/Admin sửa ngày đi làm trong 7 ngày (`IsInternalHrOrAdmin`). Dùng lại được. |
| FE `src/features/hr-console/HrProfileAndPlaceholders.tsx` | Đang là màn trống "placement reconciliation chưa có backend". |

**GitNexus impact (CLI, upstream):**
- `InitializeAsync`, `MarkServiceFeeDueAsync`: risk `LOW`/`UNKNOWN`, vì trùng tên với symbol khác.
- `ConfirmStartWorkCommandHandler`, `MarkNotStartedCommandHandler`: `UNKNOWN`, vì được gọi qua MediatR nên index không thấy caller.

`UNKNOWN` không có nghĩa là an toàn. Sơn phải chạy lại `impact` với `--file-path` cụ thể trước khi sửa, và grep thêm nơi gọi `IPlacementFinanceService` và `IWarrantyProgressService`.

## 3. Thiết kế

### 3.1 Dữ liệu (1 bảng mới, không sửa bảng cũ)

Bảng `placement_reconciliation` (entity `PlacementReconciliation`):

| Cột | Ghi chú |
|---|---|
| `ReconciliationId` (PK, uuid) | |
| `ApplicationId` (FK, unique) | Mỗi hồ sơ có 1 bản ghi đối soát |
| `PlacementId` (FK, nullable) | Có khi kết quả là đã đi làm |
| `ClaimedOutcome` | `STARTED` hoặc `NOT_STARTED`: kết quả Client khai |
| `Status` | `PENDING` → `CONFIRMED` hoặc `FLAGGED` |
| `ContactChannel` | `CANDIDATE`, `AFFILIATE`, `BOTH` |
| `Note` (bắt buộc khi `FLAGGED`, tối đa 1000 ký tự) | |
| `ResolutionNote` (bắt buộc khi Platform Admin giải quyết `FLAGGED`, tối đa 1000 ký tự) | Lưu riêng để không ghi đè ghi chú xác minh ban đầu của Internal HR |
| `ReviewedBy`, `ReviewedAt` | |
| `ConcurrencyToken` | Đồng bộ với `Mf04ConcurrencyGuard` |
| `CreatedAt`, `UpdatedAt` | |

Hằng số đặt trong `HRConnect.Domain/Constants/RecruitmentStates.cs`: `PlacementReconciliationStates { Pending, Confirmed, Flagged }`, `ReconciliationOutcomes { Started, NotStarted }`, `ReconciliationErrorCodes { NotPending = "RECONCILIATION_NOT_PENDING", NoteRequired = "RECONCILIATION_NOTE_REQUIRED" }`.

Migration EF mới: `AddPlacementReconciliation`. **Backfill:** placement và hồ sơ `NOT_STARTED` của `HEADHUNT_COD` đã tồn tại thì tạo bản ghi `CONFIRMED` với `Note = "legacy"`, để không chặn phí cũ.

### 3.2 State machine

```
[*] --> PENDING : Client confirms start work / marks not started (HEADHUNT_COD)
PENDING --> CONFIRMED : Internal HR verifies with candidate / affiliate
PENDING --> FLAGGED : mismatch found (note required) → notify Platform Admin
FLAGGED --> CONFIRMED : Platform Admin resolves after follow-up
```

Thêm file `docs/diagrams/state-machines/source/sm-placement-reconciliation.mmd` và `.drawio`, theo cùng cách đặt tên với các file đã có.

### 3.3 Backend

1. **Tạo bản ghi đối soát.** Trong `ConfirmStartWorkCommandHandler` và `MarkNotStartedCommandHandler`: nếu service type là `HEADHUNT_COD` thì thêm `PlacementReconciliation` (`PENDING`) trong **cùng unit of work**. Nếu là placement thay thế (replacement slot), vẫn tạo bản ghi đối soát nhưng không có phí mới.
2. **Giữ phí.** Trong cả `WarrantyProgressService.MarkServiceFeeDueAsync` và `MarkServiceFeeOverdueAsync`: nếu phí thuộc placement có bản ghi đối soát khác `CONFIRMED` thì **trả về false, không đổi trạng thái, không gửi thông báo**. Worker sẽ thử lại ở lần chạy sau. Không đổi số tiền và hạn trả.
3. **Command mới** trong `Features/Placements/Commands/ReconcilePlacement/`:
   - `ReconcilePlacementCommand(ApplicationId, Decision = CONFIRM|FLAG, ContactChannel, Note, ConcurrencyToken, ActorUserId)`.
   - Kiểm tra: bản ghi phải đang `PENDING`, nếu không thì trả `409 RECONCILIATION_NOT_PENDING`. Khi `FLAG` mà thiếu `Note` thì trả `400 RECONCILIATION_NOTE_REQUIRED`. Kiểm tra token bằng `Mf04ConcurrencyGuard`.
   - Kết quả:
     - `CONFIRMED`: ghi audit `PLACEMENT_RECONCILED`. Nếu phí đã quá hạn thì gọi `MarkServiceFeeOverdueAsync`; nếu đang trong cửa sổ nhắc hạn thì gọi `MarkServiceFeeDueAsync`.
     - `FLAGGED`: ghi audit `PLACEMENT_RECONCILIATION_FLAGGED`, thông báo cho mọi Platform Admin. Nếu bản ghi gắn với `NOT_STARTED` thì báo thêm cho Affiliate có attribution.
   - Thông báo chỉ đẩy SignalR **sau khi commit**, theo interceptor đã sửa trước đó.
4. **Command cho Admin:** `ResolveFlaggedReconciliationCommand` (`FLAGGED → CONFIRMED`, ghi chú bắt buộc). Command này cho phép mở lại luồng phí sau khi Admin xử lý xong.
5. **Query:** `GetPlacementReconciliationsQuery(Status?, Page)` dùng cho màn Internal HR và Platform Admin. Mỗi dòng gồm job, công ty, ứng viên (email đã che), Affiliate (nếu có), kết quả Client khai, ngày đi làm, số tiền phí, trạng thái đối soát, ghi chú xác minh và ghi chú giải quyết.
6. **Endpoint** (nhóm `Endpoints/V1/Recruitment` hoặc `InternalHr`):
   - `GET  /api/v1/internal-hr/placement-reconciliations?status=PENDING`
   - `POST /api/v1/internal-hr/placement-reconciliations/{applicationId}`: body `{ decision, contactChannel, note, concurrencyToken }`
   - `POST /api/v1/admin/placement-reconciliations/{applicationId}/resolve`
7. **Quyền:**
   - Permission mới `placement.reconcile`, cấp cho Internal HR qua migration seed (như cách `20261005090000_RestrictInternalHrRecruitmentMutations` làm).
   - Endpoint của Admin kiểm tra `user.IsInRole("PLATFORM_ADMIN")`, giống cách `FinanceEndpoints.cs` và `BusinessSettingEndpoints.cs` đang làm (code hiện không có permission `finance.manage`).
   - Client và Affiliate gọi các endpoint này thì nhận 403.
8. **Không đổi:** cách tính phí, warranty, hoa hồng (hoa hồng vẫn `IN_WARRANTY`, vẫn chỉ `PAYABLE` sau khi phí `PAID`). Vì phí chưa `PAID` thì hoa hồng không chi được, nên việc giữ phí cũng tự giữ hoa hồng.

### 3.4 Frontend (Internal HR console)

- Thay màn placeholder trong `HrProfileAndPlaceholders.tsx` bằng trang **"Đối soát placement"**, đặt trong nhóm menu "Theo dõi", cạnh "Bảo hành".
- Bảng có lọc theo trạng thái (Chờ đối soát / Đã xác nhận / Cần xử lý). Cột: Job, Công ty, Ứng viên, Affiliate, Client khai, Ngày đi làm, Phí, Trạng thái.
- Drawer chi tiết có:
  - Nút **Xác nhận đúng**.
  - Nút **Sửa ngày đi làm**, gọi API `start-date-correction` đã có.
  - Nút **Báo không khớp**, bắt buộc nhập ghi chú và chọn kênh liên hệ.
  - Gửi kèm `concurrencyToken`. Khi gặp 409 thì báo "Dữ liệu đã thay đổi, tải lại".
- Trang tài chính của Client: phí của placement chưa đối soát hiện nhãn **"Đang đối soát"** thay cho hạn trả.
- Admin › Tài chính: thêm thẻ **"Đối soát cần xử lý"** (`FLAGGED`), có nút giải quyết.
- Chữ trên giao diện dùng ngôn ngữ dễ hiểu, không ghi mã kỹ thuật (theo quy ước plain-language đã làm).

## 4. Thứ tự làm (ước lượng 2–3 ngày)

1. Chạy GitNexus impact (`--file-path`) cho 2 handler, `PlacementFinanceService` và `WarrantyProgressService`; ghi kết quả vào PR.
2. Thêm entity, hằng số và migration (kèm backfill legacy), rồi test migration trên PostgreSQL local.
3. Tạo bản ghi `PENDING` ở `ConfirmStartWork` và `MarkNotStarted`, kèm unit test.
4. Giữ phí trong `MarkServiceFeeDueAsync`, `MarkServiceFeeOverdueAsync` và command ghi nhận thanh toán thủ công, kèm unit test.
5. Thêm command, query, endpoint và permission, kèm unit test và test quyền.
6. Làm FE: trang HR, nhãn ở trang Client, thẻ Admin, kèm Vitest.
7. Cập nhật tài liệu:
   - SRS UC-41: bỏ `[Planned]`.
   - `main-flows.md` mục 4.1 và bảng "chưa có code".
   - State machine mới.
   - Sơ đồ use case: bỏ viền nét đứt của UC-41.
   - BM01: bỏ Known Gap.
8. Chạy `detect_changes --scope compare --base-ref main` trước khi commit. Mở PR vào `dev`.

## 5. Test bắt buộc (dùng làm test case Review 2 / Report 5)

| ID | Ca | Kỳ vọng |
|---|---|---|
| TC-UC41-01 | Client xác nhận đi làm (Headhunt) | Có bản ghi đối soát `PENDING`; phí `PENDING` |
| TC-UC41-02 | Worker chạy khi đến ngày nhắc nhưng chưa đối soát | Phí vẫn `PENDING`, Client không nhận thông báo phí |
| TC-UC41-03 | HR xác nhận đúng | `CONFIRMED`; phí sang `DUE` khi tới hạn; có audit |
| TC-UC41-04 | HR báo không khớp nhưng thiếu ghi chú | `400 RECONCILIATION_NOTE_REQUIRED` |
| TC-UC41-05 | HR báo không khớp có ghi chú | `FLAGGED`; Admin nhận thông báo; phí vẫn bị giữ |
| TC-UC41-06 | Đối soát lại bản ghi đã `CONFIRMED` | `409 RECONCILIATION_NOT_PENDING` |
| TC-UC41-07 | Hai HR cùng đối soát một hồ sơ | Người sau nhận `409` (concurrency) |
| TC-UC41-08 | Client hoặc Affiliate gọi API đối soát | `403` |
| TC-UC41-09 | Client đánh dấu không nhận việc (Headhunt) → HR `FLAGGED` | Hồ sơ vẫn `NOT_STARTED`; Admin và Affiliate được báo |
| TC-UC41-10 | Job `CV_APPLICATION` / `CV_SOURCING` xác nhận đi làm | Không tạo bản ghi đối soát; luồng cũ không đổi |
| TC-UC41-11 | Placement thay thế (replacement slot) | Có bản ghi đối soát; không có phí mới |
| TC-UC41-12 | Admin giải quyết `FLAGGED` | `CONFIRMED`; phí chạy tiếp |
| TC-UC41-13 | Migration backfill | Placement cũ có bản ghi `CONFIRMED`; phí cũ vẫn chạy |
| TC-UC41-14 *(bổ sung khi triển khai)* | Worker thử chuyển phí quá hạn khi đối soát chưa xong | Phí không sang `OVERDUE` |
| TC-UC41-15 *(bổ sung khi triển khai)* | Admin thử ghi nhận đã thu khi đối soát chưa xong | Backend từ chối; FE khóa nút thao tác |
| TC-UC41-16 *(bổ sung khi triển khai)* | Platform Admin giải quyết hồ sơ `FLAGGED` | Giữ nguyên `Note` của HR và lưu kết quả vào `ResolutionNote` |

Có thêm 4 chuyển trạng thái mới (`[*]→PENDING`, `PENDING→CONFIRMED`, `PENDING→FLAGGED`, `FLAGGED→CONFIRMED`). Phải cộng 4 chuyển trạng thái này vào A3 của Design Brief (BM01).

## 6. Rủi ro

- **Phí cũ bị chặn:** nếu quên backfill, mọi phí Headhunt đang `PENDING` sẽ không bao giờ sang `DUE`. Test TC-UC41-13 dùng để chặn rủi ro này.
- **Demo bị kẹt:** kịch bản WF-04/WF-05 sẽ cần thêm bước HR đối soát. Cần cập nhật DS-07/DS-09 trong BM01, và seed tài khoản HR cho bước này.
- **Thông báo trùng:** khi HR xác nhận trong cửa sổ nhắc hạn, chỉ gọi `MarkServiceFeeDueAsync` một lần; nếu đã quá hạn thì gọi `MarkServiceFeeOverdueAsync` thay vì ép đi qua `DUE`.

## 7. Definition of Done

- 13 test gốc và 3 test bổ sung ở mục 5 chạy được tự động trong CI (backend: xUnit; FE: Vitest).
- Demo trên staging: Client xác nhận đi làm → HR đối soát → Admin ghi nhận phí → hoa hồng đi tiếp.
- SRS, sơ đồ use case, state machine và BM01 đã cập nhật; UC-41 không còn `[Planned]`.
- PR vào `dev` có kết quả `detect_changes`. Chỉ merge lên `main` khi Quí đồng ý.
