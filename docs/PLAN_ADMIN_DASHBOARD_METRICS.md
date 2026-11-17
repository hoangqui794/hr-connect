# Plan & Spec: Admin Dashboard Metrics & Motion Charts (`GET /api/v1/admin/dashboard/metrics`)

> **Mục tiêu:** Nâng cấp trang Tổng quan Admin (`AdminOverviewPage.tsx`) từ bảng phím tắt tĩnh thành **Command & Analytics Dashboard** với dữ liệu vận hành thực tế và bộ biểu đồ mượt mà theo chuẩn **`unslop`** + **`motion`**.  
> **Phạm vi:** Backend (.NET 8 Clean Architecture + MediatR) & Frontend (React 18 + TypeScript + `motion/react`).

> [!IMPORTANT]
> **Yêu cầu bắt buộc dành cho Dev / AI khi triển khai (Incremental Push Policy):**
> - Làm việc trên nhánh riêng (`feat/...`).
> - **Commit theo từng phần hoàn chỉnh**, không gom cả BE lẫn FE vào một commit:
>   - Xong 1 handler / endpoint bên **BE** (pass build/test phần đó) → commit.
>   - Xong 1 component / chart bên **FE** (pass lint/build/test phần đó) → commit.
> - Chỉ push khi được yêu cầu. Không tự ý merge hoặc push thẳng vào `dev` / `main` khi chưa có lệnh xác nhận.

---

## 1. Kiến trúc tổng thể

Hiện tại `AdminOverviewPage.tsx` đang gọi nhiều API phân trang (`pageSize: 1`) rời rạc để lấy tổng số lượng (`total`) và chưa có dữ liệu chuỗi thời gian cho biểu đồ.  
Ta thay thế bằng **1 endpoint tổng hợp duy nhất**:

- **Method & Route:** `GET /api/v1/admin/dashboard/metrics?range=7d|30d|90d`
- **Mặc định:** `range = 30d` (nếu truyền giá trị ngoài `7d | 30d | 90d` thì fallback về `30d`).
- **Response Envelope:** Dự án không có class `ApiResponse<T>`; trả `Results.Ok(new { success = true, data = result })` giống `ReportEndpoints.cs` (FE đọc `response.data.data`). Lỗi `BadRequestException` → `Results.BadRequest(new { success = false, message })`.
- **Tiền tệ:** Mọi số tiền tính theo VND như `ReportRepository` (`primaryCurrency = "VND"`); trả thêm `currencyCode: "VND"` trong `data`.

---

## 2. Backend Specification (.NET 8)

### 2.1. Cấu trúc file cần tạo / cập nhật
1. **Application Layer (`HRConnect.Application/Features/Admin/Dashboard/`):**
   - `GetAdminDashboardMetricsQuery.cs`: Chứa `GetAdminDashboardMetricsQuery(string Range)`, các Response DTOs (`AdminDashboardMetricsDto`, `DashboardKpiDto`, `CashflowPointDto`, `ActivityPointDto`, `RoleBreakdownDto`), và `GetAdminDashboardMetricsQueryHandler`.
2. **Presentation Layer (`HRConnect.Presentation/Endpoints/V1/Admin/`):**
   - `AdminDashboardEndpoints.cs`: Minimal API endpoint theo đúng pattern của `AdminAuditLogEndpoints.cs`.
   - Đăng ký `app.MapAdminDashboardEndpoints()` tại file cấu hình endpoint routing (nơi đăng ký `MapAdminAuditLogEndpoints`).

### 2.2. Bảo mật & Phân quyền
- Bắt buộc `.RequireAuthorization()`.
- Kiểm tra quyền `report.view` qua `PermissionAuthorization.HasPermission(user, "report.view")` — quyền này đã seed với mô tả "View reports and dashboards" (`DatabaseSeeder.cs`) và đang dùng ở `ReportEndpoints.cs`. Không đủ quyền → `return PermissionAuthorization.Forbidden("report.view")` (403).

### 2.3. JSON Contract (`data`)

```json
{
  "range": "30d",
  "generatedAtUtc": "2026-11-15T13:30:00Z",
  "currencyCode": "VND",
  "kpis": {
    "pendingApprovals": 5,
    "activeUsers": 420,
    "suspendedUsers": 3,
    "auditEventsToday": 128,
    "overdueServiceFeesCount": 2,
    "overdueServiceFeesAmount": 45000000,
    "payableCommissionsCount": 4,
    "payableCommissionsAmount": 18500000,
    "openDisputesCount": 1
  },
  "cashflowSeries": [
    {
      "date": "2026-10-17",
      "serviceFeesPaidAmount": 30000000,
      "postingFeesPaidAmount": 2500000,
      "payoutsAmount": 9000000
    }
  ],
  "activitySeries": [
    {
      "date": "2026-10-17",
      "newUsers": 4,
      "auditEvents": 62,
      "approvalsCompleted": 2
    }
  ],
  "userRoleBreakdown": [
    { "role": "CANDIDATE", "count": 260 },
    { "role": "CLIENT_COMPANY_USER", "count": 85 },
    { "role": "AFFILIATE", "count": 68 },
    { "role": "INTERNAL_HR", "count": 7 },
    { "role": "PLATFORM_ADMIN", "count": 2 }
  ]
}
```

**Nguồn dữ liệu từng KPI:**
| Trường | Cách tính |
|---|---|
| `pendingApprovals` | Cùng điều kiện danh sách duyệt mà trang hiện gọi: `adminService.getApprovals({ status: 'UNDER_REVIEW' })` |
| `activeUsers` / `suspendedUsers` | User theo trạng thái ACTIVE / SUSPENDED (như `adminUsersApi.list({ status })` đang dùng) |
| `auditEventsToday` | Audit log từ 00:00 hôm nay (như query `fromUtc: todayStart` hiện tại) |
| `overdueServiceFees*` | `ServiceFees` có `Status == ServiceFeeStates.Overdue`, loại `ServiceFeeKinds.OwedToClient` |
| `payableCommissions*` | `Commissions` có trạng thái PAYABLE (hằng trong `FinanceStates.cs`) |
| `openDisputesCount` | `DisputeStates.Open` + `DisputeStates.UnderReview` |

Role code phải đúng 5 role seed: `CANDIDATE`, `AFFILIATE`, `CLIENT_COMPANY_USER`, `INTERNAL_HR`, `PLATFORM_ADMIN`.

### 2.4. Lưu ý triển khai Query (EF Core)
- **Tối ưu đọc:** Luôn dùng `.AsNoTracking()` trên toàn bộ query thống kê.
- **Không dùng `Task.WhenAll` trên cùng một `DbContext`:** EF Core `DbContext` không thread-safe, hãy `await` tuần tự từng query gọn nhẹ (đã `GroupBy` trên PostgreSQL, chỉ trả về tối đa 7–90 dòng).
- **Không viết logic doanh thu lần thứ hai:** `HRConnect.Infrastructure/Repositories/ReportRepository.cs` (khối revenue: `collectedFees`, `cvAppPaidItems`, `completedPayouts`) đã tính đúng 3 khoản tiền bên dưới cho trang Báo cáo. Thêm hàm group-by-ngày vào `IReportRepository` / `ReportRepository` dùng chung điều kiện đó. Handler đi qua repository, không inject `ApplicationDbContext`.
- **Múi giờ (giờ Việt Nam):** Báo cáo hiện có tính ngày theo giờ VN (`ReportTimeRangeHelper.cs`: `VietnamOffset = +7`, `ReportTimeRange` gồm `FromDate`/`ToDate`/`FromUtc`/`ToUtcPlusOne`). Dashboard dùng cùng cách: khoảng = `ReportTimeRangeHelper.Create(today - (N-1), today)`, nhóm theo **ngày giờ VN** (timestamp UTC + 7h). "Hôm nay" của `auditEventsToday` tính từ 00:00 giờ VN. Nhóm theo ngày UTC sẽ đẩy giao dịch 00:00–07:00 giờ VN sang ngày hôm trước và lệch với `/reports/revenue`.
- **Lấp đầy ngày trống (Zero-fill):** Với `cashflowSeries` và `activitySeries`, tạo dải ngày (giờ VN) liên tục từ `FromDate` đến `ToDate` trên C# rồi map dữ liệu từ DB vào (ngày không phát sinh giao dịch gán giá trị `0`), giúp biểu đồ FE vẽ đường liên tục không bị gãy trục X.
- **Quy ước tiền tệ:** Cộng theo đúng trạng thái thực tế đã ghi nhận tiền:
  - `serviceFeesPaidAmount`: `ServiceFees` có `Status == ServiceFeeStates.Paid`, **chỉ `Kind` PLACEMENT / DEPOSIT / SETTLEMENT**, nhóm theo ngày giờ VN của `PaidAt`. Phải loại `ServiceFeeKinds.OwedToClient` (CREDIT, REPLACEMENT_REFUND): đây là tiền HR Connect hoàn cho Client, khi hoàn xong cũng mang trạng thái PAID. (Tùy chọn: trả thêm `refundsPaidAmount` cho khoản hoàn.)
  - `postingFeesPaidAmount`: bảng `JobPostingFees` (không có bảng `PostingFeePayments`) có `Status == "PAID"`, nhóm theo `PaidAt`; bỏ phí `Amount == 0` (gói FREE, `PaymentReference = "FREE_TIER"`).
  - `payoutsAmount`: `Payouts` có `Status == PayoutStates.Completed` ("COMPLETED"; `SUCCEEDED` là trạng thái của `OnlinePayment`, không phải Payout), nhóm theo `PayoutDate`.

### 2.5. Unit / Integration Tests (BE)
- Test handler trả đủ số ngày tương ứng với `range = 7d`, `30d`, `90d` (kể cả ngày không có dữ liệu vẫn trả `0`).
- Test fallback về `30d` khi truyền `range` không hợp lệ.
- Test phân quyền trả `403` cho tài khoản không phải Admin.

---

## 3. Frontend Specification (React + TypeScript + `motion` + `unslop`)

> **Nguyên tắc thư viện:** Không cài thêm thư viện chart nặng (`recharts`, `chart.js`, ...). Dự án đã có sẵn gói `motion` (`motion/react`), dùng **SVG thuần + `motion`** để vẽ biểu đồ nhẹ, sắc nét 60fps và khớp 100% thiết kế `unslop`.

### 3.1. Files cần chỉnh sửa / tạo mới (`HRConnect-FE/`)
1. `src/types/api/admin.ts`: Thêm `DashboardRange`, `AdminDashboardMetrics`, `DashboardKpis`, `CashflowPoint`, `ActivityPoint`, `RoleBreakdownPoint`.
2. `src/services/api/adminApi.ts`: Thêm `adminDashboardApi.getMetrics(range: DashboardRange)`.
3. `src/features/admin-console/components/DashboardCharts.tsx` *(tạo mới)*:
   - `CashflowAreaChart`: Biểu đồ SVG 2 đường mượt (`Thu phí` màu `#2563EB` vs `Chi hoa hồng` màu `#059669`).
   - `ActivityBarChart`: Biểu đồ cột mini cho nhịp hoạt động (`auditEvents` / `newUsers`).
   - `RoleBreakdownBar`: Thanh phân bổ tỷ lệ người dùng theo vai trò.
4. `src/features/admin-console/AdminOverviewPage.tsx`: Tái cấu trúc giao diện sử dụng `adminDashboardApi.getMetrics(range)` và giữ lại khối **Hoạt động gần đây** (6 audit log mới nhất).

### 3.2. Thiết kế UI & Chuyển động (`unslop` + `motion/react`)
1. **Range Switcher Pill (`7 ngày` | `30 ngày` | `90 ngày`):**
   - Dùng `motion.span` với `layoutId="overview-range-pill"` (`type: 'spring', stiffness: 450, damping: 35`) để pill active trượt mượt khi đổi khoảng thời gian.
2. **KPI Strip (4 thẻ đầu trang):**
   - Dùng lại `StatTile` từ `./ui` (đã tích hợp sẵn `AnimatedCount` đếm số mượt và `whileTap` lò xo):
     - *Chờ duyệt tài khoản* (`pendingApprovals`) → click tới `/admin/approvals`
     - *Phí quá hạn* (`overdueServiceFeesCount` + hint số tiền `money(...)`) → click tới `/admin/finance`
     - *Hoa hồng chờ chi* (`payableCommissionsCount` + hint số tiền `money(...)`) → click tới `/admin/finance`
     - *Sự kiện hôm nay* (`auditEventsToday`) → click tới `/admin/audit-logs`
3. **Biểu đồ Dòng tiền (`CashflowAreaChart`):**
   - Đường cong (`<motion.path>`) animate `initial={{ pathLength: 0, opacity: 0.4 }}` → `animate={{ pathLength: 1, opacity: 1 }}` (`duration: 0.7, ease: [0.16, 1, 0.3, 1]`).
   - Vùng phủ dưới đường dùng `<linearGradient>` độ mờ thấp (`opacity: 0.14 → 0`), giữ nền trắng sạch và viền hairline `border-slate-200/80`.
   - **Tương tác Hover:** Di chuột qua các điểm ngày hiện đường gióng dọc mảnh (`stroke-dasharray`) + tooltip nổi hiển thị ngày, tổng thu, tổng chi bằng `font-mono tabular-nums`.
4. **Biểu đồ Cột Nhịp hoạt động (`ActivityBarChart`):**
   - Dùng `<motion.rect>` mọc từ đáy lên (`initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}`, `transformOrigin: 'bottom'`, `delay: idx * 0.015`) kèm tooltip khi hover từng cột.
5. **Trạng thái Loading / Empty / Error & Accessibility:**
   - Khi đang tải (`isLoading`): hiển thị khung Skeleton đúng kích thước biểu đồ (tránh layout shift CLS).
   - Khi có lỗi API: hiển thị `<Alert type="error" showIcon>` kèm nút "Thử lại".
   - Toàn bộ nằm trong `<MotionConfig reducedMotion="user">` của `AdminLayout.tsx`.
6. **Làm mới realtime:** query key `['admin-dashboard-metrics', range]` — khai báo root `['admin-dashboard-metrics']` trong `src/hooks/notificationRefreshKeys.ts` (nhóm `FINANCE` và `JOB`, cạnh `['admin-overview']`) để số liệu tự cập nhật khi có thông báo.
7. **Khối đang có trên trang:** ngoài "Hoạt động gần đây", trang hiện còn đếm loại dịch vụ và quy tắc hoa hồng đang bật — quyết định giữ hay bỏ, không bỏ ngầm.

### 3.3. Unit Tests (FE)
- Cập nhật hoặc bổ sung test cho `AdminOverviewPage`:
  - Mock `adminDashboardApi.getMetrics` trả dữ liệu mẫu 7 ngày.
  - Kiểm tra hiển thị đúng 4 KPI, đổi `range` (`7 ngày` → `30 ngày`) gọi lại API với param mới, và click KPI điều hướng đúng route.
- Chạy kiểm tra: `npm run lint`, `npm run build`, `npx vitest run src/features/admin-console/`.

---

## 4. Checklist nghiệm thu (Definition of Done)

- [ ] **BE:** Endpoint `GET /api/v1/admin/dashboard/metrics` hoạt động đúng với `7d`, `30d`, `90d`, zero-fill đủ ngày, quyền 403 được bảo vệ, `dotnet test` pass.
- [ ] **FE:** Thay thế các call `pageSize=1` rời rạc trên `AdminOverviewPage` bằng `adminDashboardApi.getMetrics`.
- [ ] **FE:** Biểu đồ SVG + `motion` hiển thị mượt, có hover tooltip số liệu `font-mono tabular-nums`, không bị tràn ngang trên desktop/mobile.
- [ ] **BE:** `serviceFeesPaidAmount` không gồm tiền hoàn (CREDIT, REPLACEMENT_REFUND); đối chiếu `GET /api/v1/reports/revenue` cùng kỳ: `postingFeesPaidAmount` và `payoutsAmount` khớp tuyệt đối; `serviceFeesPaidAmount` − tổng tiền hoàn (`ServiceFeeKinds.OwedToClient`: CREDIT + REPLACEMENT_REFUND) đã PAID trong kỳ = phần thu phí dịch vụ của báo cáo (`ReportRepository` cộng các khoản này với dấu âm, dashboard chỉ loại ra không trừ). Kỳ không có tiền hoàn thì khớp tuyệt đối.
- [ ] **Verify:** `npm run lint` (0 warnings), `npm run build`, và toàn bộ test liên quan đều pass.
