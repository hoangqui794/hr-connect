# C-07 — Gọi API theo từng tin tuyển dụng ở khu vực Client (phân tích, chưa sửa)

Ngày 10/11/2026. Chỉ đọc code FE và backend; chưa sửa gì.

## 1. Các vòng lặp gọi API theo từng tin

| # | Trang | File:dòng | Gọi gì, bao nhiêu lần | Dùng để làm gì |
|---|---|---|---|---|
| L1 | `/client/jobs` | `HRConnect-FE/src/features/jobs-mf01/ClientJobsListPage.tsx:194-202` | `GET /recruitment/applications?jobId=…&page=1&pageSize=1` — **1 lần cho mỗi tin** ACTIVE/PAUSED/CLOSED (lúc quét là ~30 tin) | Hiện số hồ sơ của từng tin trong danh sách |
| L2 | `/client/dashboard` | `HRConnect-FE/src/features/client-console/ClientOverviewPage.tsx:74-79` | Cùng API trên, **tối đa 6 lần** (6 tin ACTIVE đầu) | Số hồ sơ của "Chiến dịch đang mở" |
| L3 | `/client/dashboard` | `ClientOverviewPage.tsx:59-64` | Cùng API nhưng lọc theo trạng thái, **7 lần** (mỗi bước phễu một lần) | Phễu tuyển dụng |
| L4 | `/client/candidates` | `HRConnect-FE/src/features/client-console/ClientCandidatesPage.tsx:210-215` | Cùng API, **7 lần** (mỗi nhóm trạng thái một lần), gọi lại mỗi khi đổi bộ lọc | Số trên các ô "Tất cả / Cần xem / …" |
| L5 | `/client/warranty` | `HRConnect-FE/src/features/finance-mf05/ReplacementQuotaCard.tsx:117-133` | `GET /jobs/{id}/replacement-slots` — **1 lần cho mỗi tin Tuyển dụng theo kết quả và mỗi tin có placement** (lúc quét 15 tin), chạy 4 request một đợt | Bảng "Suất tuyển thay thế" |
| L6 | `/client/billing` | `HRConnect-FE/src/features/client-console/ClientBillingPage.tsx:98-112` | `GET /jobs/{id}/posting-fee` — **1 lần cho mỗi tin Nhận hồ sơ có gói trả phí** (lúc quét 9 tin), 4 request một đợt | Dòng "Gói đăng tin" (số tiền, ngày trả) trong bảng công nợ |

L1, L5 và L6 tăng theo số tin của công ty; L2, L3, L4 có số lần cố định (6–7) nên ít nghiêm trọng hơn.

## 2. Backend đã có gì

| Nhu cầu | Có sẵn? | Ghi chú |
|---|---|---|
| Số hồ sơ theo **từng tin**, một lần gọi | **Không** | `GET /api/v1/recruitment/applications` chỉ trả danh sách phân trang (có `total`); không có endpoint đếm gộp theo `jobId` hay theo trạng thái. `JobDto` (`/jobs/mine`) không có trường số hồ sơ. |
| Suất thay thế của **cả công ty** | **Không** | Chỉ có `GET /jobs/{jobId}/replacement-slots` (`FinanceEndpoints.cs:58`). |
| Biết tin nào **có** suất thay thế mà không gọi từng tin | **Gián tiếp có** | Suất chỉ được mở khi HR xác nhận nghỉ việc → bảo hành chuyển `VOIDED`. `GET /warranties` (trang đã gọi sẵn) có `placementId` + `status`; `GET /placements` (cũng đã gọi sẵn trong L5) có `placementId → job.jobId`. |
| Phí đăng tin của **cả công ty** | **Không** | Chỉ có `GET /jobs/{jobId}/posting-fee` (`JobEndpoints.cs:110`). `JobDto` có `PostingFeeStatus` và `PostingPackageCode/Name` nhưng **không có số tiền, ngày trả, mã giao dịch**. `GET /service-fees` không gồm phí đăng tin (chỉ PLACEMENT/DEPOSIT/SETTLEMENT/CREDIT/REPLACEMENT_REFUND). |

## 3. Đề xuất

| # | Cách xử lý | Cần backend? | Hiệu quả |
|---|---|---|---|
| L5 | **Chỉ gọi `replacement-slots` cho tin có bảo hành `VOIDED`** — ghép `/warranties` với `/placements` (đều đã tải) để lấy đúng các `jobId` có suất. | Không | Từ ~15 request còn số tin có người nghỉ trong bảo hành (thường 0–2). Giữ nguyên dữ liệu hiển thị. |
| L1 | **Chỉ đếm cho trang đang hiển thị** (danh sách tin đang phân trang/lọc) và đặt `staleTime` dài; hoặc bỏ số hồ sơ khỏi danh sách và hiện khi mở chi tiết tin. | Không | Giảm theo số tin trên trang. |
| L1, L2 | **Thêm endpoint đếm gộp** `GET /recruitment/applications/counts?groupBy=job` (hoặc thêm `applicationCount` vào `JobDto` của `/jobs/mine`). | **Có** | 1 request thay cho ~30 + 6. Đây là cách triệt để nhất. |
| L3, L4 | **Thêm endpoint đếm theo trạng thái** `GET /recruitment/applications/counts?groupBy=status` (nhận cùng bộ lọc jobId/dịch vụ). | **Có** | 1 request thay 7. Có thể gộp chung endpoint với dòng trên. |
| L6 | **Ngắn hạn:** chỉ gọi `posting-fee` cho tin có `postingFeeStatus = PENDING` (cần thanh toán) và tải phần đã trả khi người dùng mở tab "Đã thanh toán". **Triệt để:** thêm số tiền, ngày trả, mã giao dịch của phí đăng tin vào `JobDto` hoặc vào `GET /service-fees` (kind `POSTING`). | Ngắn hạn: không. Triệt để: **có** | Ngắn hạn giảm còn số tin đang nợ; triệt để còn 0 request riêng. |

## 4. Thứ tự đề xuất
1. **L5** (không đụng backend, lợi lớn nhất ở trang Bảo hành).
2. **L6 ngắn hạn** và **L1 theo trang** (không đụng backend).
3. Nếu được duyệt sửa backend: một endpoint đếm hồ sơ gộp theo `job` / `status` (giải quyết L1–L4), và đưa phí đăng tin vào dữ liệu có sẵn (L6). Phần backend thuộc MF-01/MF-02/MF-03 nên cần người phụ trách đồng ý.

## Chưa kiểm chứng
- Số request đo lúc quét với tài khoản Demo Client (43 tin); chưa đo thời gian tải trang trước/sau.
- Chưa xác nhận bảo hành `CLAIMED` (đang chờ HR xác minh) có thể đã có suất hay không — theo `main-flows.md`, suất chỉ mở khi HR xác nhận (`VOIDED`).
