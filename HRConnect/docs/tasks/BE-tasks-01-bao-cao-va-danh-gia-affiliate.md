# BE task 01: Dashboard báo cáo và đánh giá chất lượng Affiliate

> **Ngày:** 2026-10-15. **Ưu tiên:** 🔴 Cao, sản phẩm phải nộp của đề tài; Frontend đang chờ API.
> **Căn cứ đề tài:** mục *Reporting & Company Directory* ("Dashboard summaries: jobs by status, top-performing affiliates by quarter/year, revenue by service line") và *Partner & Finance* ("affiliate quality rating based on submission-to-hire conversion rather than raw volume").
> **Hiện trạng code** (GitNexus, `main` `5640eb1`): chưa có query hay endpoint báo cáo nào. Bảng `affiliate_performance` (entity `AffiliatePerformance`) **đã có** nhưng chưa có code nào ghi hay đọc. Quyền `report.view` (Platform Admin) và `affiliate.performance.view_own` (Affiliate) **đã seed** trong `Permission.md`.

Quy ước chung: Vertical Slice + MediatR theo README mục 7; response `{ success, data }`; không viết cứng con số nghiệp vụ (đọc từ `IAdminBusinessSettings`); chạy GitNexus `impact` trước khi sửa symbol có sẵn và `detect-changes` trước khi commit.

**Cách làm và bàn giao**

- **Ước lượng:** khoảng 4–5 ngày (A: 2 ngày, B: 2–3 ngày).
- **Phụ thuộc:** Không phụ thuộc ai; đọc dữ liệu MF-04/MF-05 đã có. Không sửa file của MF-05, chỉ thêm query mới.
- **Nhánh:** `feature/<tên-ngắn>` tạo từ `dev`, PR vào `dev`, ít nhất 1 người review; CI xanh mới merge.
- **Cài đặt mới:** thêm khóa vào `BusinessSettingKeys` (`HRConnect.Application/Common/Settings/BusinessSettings.cs`) để hiện ở trang Cài đặt Admin.
- **Xong khi:** đạt hết mục nghiệm thu, có unit test, `dotnet test` pass, migration có `.Designer.cs`, Swagger có mô tả tiếng Việt, cập nhật trạng thái **[CHƯA CÓ CODE]** trong `main-flows.md` / tài liệu Actor nếu có.
- **Bàn giao FE:** cập nhật tài liệu Frontend ngay khi Phần A merge vào `dev`.
- **Nghiệp vụ chưa rõ:** xác nhận với người phụ trách nghiệp vụ trước, không tự đoán.

---

## Phần A. Dashboard báo cáo (Platform Admin)

Chỉ đọc dữ liệu, không thêm bảng. Đặt trong `HRConnect.Application/Features/Reports/Queries/...`, endpoint mới `Endpoints/V1/Reports/ReportEndpoints.cs`, quyền `report.view`.

Mọi API nhận chung bộ lọc thời gian:

| Query | Kiểu | Mặc định |
|---|---|---|
| `from`, `to` | `DateOnly` | đầu năm hiện tại → hôm nay |
| `groupBy` | `MONTH` \| `QUARTER` \| `YEAR` | `MONTH` (chỉ API có chuỗi thời gian) |

### A1. Tổng quan

```http
GET /api/v1/reports/overview?from=&to=
```

```jsonc
{
  "jobs": { "byStatus": { "ACTIVE": 12, "PAUSED": 2, "CLOSED": 30, "PENDING_REVIEW": 3, "DRAFT": 5, "REJECTED": 1 },
            "byServiceType": { "HEADHUNT_COD": 20, "CV_SOURCING": 15, "CV_APPLICATION": 18 } },
  "applications": { "submitted": 340, "shortlisted": 120, "interview": 60, "placed": 18 },
  "placements": { "started": 18, "warrantyPassed": 12, "warrantyVoided": 2 },
  "companies": { "verified": 25, "pending": 3 },
  "affiliates": { "active": 40, "pending": 5 }
}
```

`jobs.byStatus` đếm theo trạng thái **hiện tại**; các số còn lại đếm bản ghi phát sinh trong `[from, to]`.

### A2. Doanh thu theo dịch vụ

```http
GET /api/v1/reports/revenue?from=&to=&groupBy=QUARTER
```

```jsonc
{
  "currency": "VND",
  "totals": { "HEADHUNT_COD": { "billed": 540000000, "collected": 400000000 },
              "CV_SOURCING":  { "billed": 30000000,  "collected": 30000000 },
              "CV_APPLICATION": { "billed": 0, "collected": 0 } },
  "series": [ { "period": "2026-Q3", "HEADHUNT_COD": 200000000, "CV_SOURCING": 10000000, "CV_APPLICATION": 0 } ],
  "commission": { "earned": 80000000, "paid": 50000000 }
}
```

**Nguồn dữ liệu từng dịch vụ** (đã kiểm tra entity trên `main`):

| Dịch vụ | Bảng | `billed` (phát sinh trong kỳ) | `collected` (thu trong kỳ) |
|---|---|---|---|
| `HEADHUNT_COD` | `service_fee` (gắn `placement_id`) | `amount` theo `created_at`, trừ `status = CANCELLED` nếu có | `amount` có `status = PAID`, theo `paid_at` |
| `CV_APPLICATION` | `job_posting_fee` (gói đăng tin) | `amount` theo `created_at`, trừ `CANCELLED` | `amount` có `status = PAID`, theo `paid_at` |
| `CV_SOURCING` | **chưa có bảng** (MF-05 mục E8 chưa làm) | trả `0` | trả `0` |

- `series` dùng `collected`, nhóm theo `groupBy`. Kỳ theo giờ Việt Nam (UTC+7).
- `commission.earned`: tổng `commission.amount` có `status` thuộc `EARNED`, `PAYABLE`, `PAID` và **ngày hết bảo hành** (`warranty.end_date` của placement) nằm trong kỳ. `commission.paid`: tổng `payout.amount` có `status = COMPLETED` và `payout_date` trong kỳ.
- Thiếu dữ liệu thì trả `0`, **không** báo lỗi. Khi MF-05 làm xong E8 thì thêm nguồn CV_SOURCING, không đổi hợp đồng API.

### A3. Top Affiliate

```http
GET /api/v1/reports/top-affiliates?from=&to=&sortBy=PLACEMENTS&limit=10
```

`sortBy`: `PLACEMENTS` (mặc định) | `SUBMISSION_TO_HIRE_RATE` | `COMMISSION_EARNED`.

```jsonc
{ "items": [ { "affiliateId": "uuid", "fullName": "Hùng", "totalSubmissions": 40, "totalPlacements": 6,
               "submissionToHireRate": 0.15, "qualityRating": 4.2, "ratingLabel": "GOOD", "commissionEarned": 30000000 } ] }
```

Lấy số liệu từ Phần B (`affiliate_performance` của kỳ phù hợp); nếu kỳ chưa được tính thì tính trực tiếp như B2. Khi `sortBy = SUBMISSION_TO_HIRE_RATE`, chỉ xếp hạng Affiliate có ít nhất `affiliate.rating.min_submissions` lượt nộp (dùng chung khóa ở B1, mặc định 5) để 1/1 không đứng đầu.

### A4. Top công ty

```http
GET /api/v1/reports/top-companies?from=&to=&sortBy=PLACEMENTS&limit=10
```

`sortBy`: `PLACEMENTS` | `REVENUE` | `ACTIVE_JOBS`. Trả `companyId`, `companyName`, `industry`, `activeJobs`, `placements`, `revenueCollected`.

### Nghiệm thu A

1. Không có quyền `report.view` → `403`; Internal HR, Client, Affiliate đều bị chặn.
2. Seed 2 job khác dịch vụ + 1 phí `PAID` → `overview` và `revenue` khớp số đếm tay.
3. Kỳ không có dữ liệu → các số là `0`, `items` rỗng, không lỗi.
4. Có test cho từng query (dữ liệu nhỏ trong InMemory/Postgres test như các test MF-05).

---

## Phần B. Đánh giá chất lượng Affiliate

### B1. Quy tắc tính

Cho mỗi Affiliate và mỗi kỳ (`PeriodStart`–`PeriodEnd`):

| Cột `affiliate_performance` | Cách đếm |
|---|---|
| `TotalSubmissions` | Lượt nộp của Affiliate **được ứng viên đồng ý** (submission `ACCEPTED`/consent `CONFIRMED`) trong kỳ. Không đếm lượt bị chặn trùng, bị từ chối consent hay hết hạn |
| `TotalShortlisted` | Application từ các lượt trên đã từng `SHORTLISTED` |
| `TotalInterviews` | Application đã từng `INTERVIEW` |
| `TotalPlacements` | Application `PLACED` **và** bảo hành không bị `VOIDED` |
| `SubmissionToHireRate` | `TotalPlacements / TotalSubmissions`; `null` nếu `TotalSubmissions = 0` |
| `QualityRating` | Thang 0–5, xem dưới |
| `RatingLabel` | `EXCELLENT` / `GOOD` / `AVERAGE` / `LOW` / `NEW` |
| `CalculationVersion` | Ví dụ `"v1"`, đổi khi đổi công thức |

**Công thức (v1):** `QualityRating = 5 × (wHire × hireRateChuẩnHóa + wShortlist × shortlistRate)`, làm tròn 1 chữ số thập phân, trong đó:
- `shortlistRate = TotalShortlisted / TotalSubmissions`
- `hireRateChuẩnHóa = min(SubmissionToHireRate / hireRateTarget, 1)`

Dưới số lượt tối thiểu → `RatingLabel = NEW`, `QualityRating = null`.

**Giá trị mặc định (đã chốt, đặt trong cài đặt `affiliate.rating.*`, không viết cứng; Admin đổi được):**

| Khóa cài đặt | Mặc định | Khoảng | Lý do chọn |
|---|---|---|---|
| `affiliate.rating.weight_hire` | `0.7` | 0–1 | Đề tài yêu cầu chấm theo **tuyển được**, nên tỷ lệ tuyển chiếm phần lớn |
| `affiliate.rating.weight_shortlist` | `0.3` | 0–1 | Phần còn lại thưởng cho CV đúng yêu cầu dù chưa tuyển; tổng 2 trọng số phải bằng 1 (validate khi lưu) |
| `affiliate.rating.hire_rate_target` | `0.20` | 0.01–1 | Khoảng 1/5 CV giới thiệu được tuyển là mức tốt của headhunter; đạt mức này trở lên thì phần tuyển được tính tối đa |
| `affiliate.rating.min_submissions` | `5` | 1–100 | Dưới 5 lượt thì tỷ lệ dao động quá mạnh (1/1 = 100%), chưa đủ để đánh giá |
| `affiliate.rating.excellent_min` | `4.0` | 0–5 | `QualityRating ≥ 4.0` → `EXCELLENT` |
| `affiliate.rating.good_min` | `3.0` | 0–5 | `≥ 3.0` → `GOOD` |
| `affiliate.rating.average_min` | `2.0` | 0–5 | `≥ 2.0` → `AVERAGE`; thấp hơn → `LOW`. Validate `excellent > good > average` |

**Ví dụ kiểm tra:** 10 lượt, 4 qua sàng lọc, 2 tuyển được → hire 0,2 (chuẩn hóa 1,0), shortlist 0,4 → `5 × (0,7 × 1,0 + 0,3 × 0,4) = 4,1` → `EXCELLENT`. 10 lượt, 2 qua sàng lọc, 0 tuyển → `5 × (0 + 0,3 × 0,2) = 0,3` → `LOW`.

> Tỷ lệ consent hết hạn cao (Affiliate "xí chỗ") có thể trừ điểm (`main-flows.md` mục 2.2). Để v2 nếu nhóm muốn.

### B2. Tính định kỳ

- Worker chạy hằng ngày (dùng chung kiểu `BackgroundService` như `WarrantyProgressWorker`), tính lại kỳ **tháng hiện tại** và **quý hiện tại** cho mọi Affiliate có hoạt động; upsert theo khóa `(affiliate_id, period_start, period_end)` (đã có index unique).
- Lệnh tính lại tay cho Admin: `POST /api/v1/admin/affiliate-performance/recalculate` `{ "from", "to" }`, quyền `report.view`.

### B3. API

| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/affiliates/me/performance?period=MONTH\|QUARTER\|YEAR` | `affiliate.performance.view_own` | Affiliate xem của mình, kỳ hiện tại + lịch sử |
| `GET` | `/api/v1/admin/affiliates/{affiliateId}/performance` | `report.view` | Admin xem từng Affiliate |
| `POST` | `/api/v1/admin/affiliate-performance/recalculate` | `report.view` | Tính lại |

Response mỗi kỳ: đủ các cột ở B1 + `periodStart`, `periodEnd`, `calculatedAt`.

### Nghiệm thu B

1. Affiliate có 10 lượt được đồng ý, 2 người đi làm, 1 người bị `VOIDED` → `TotalPlacements = 1`, `SubmissionToHireRate = 0,1`.
1b. Hai ví dụ ở B1 ra đúng `4,1 / EXCELLENT` và `0,3 / LOW`; đổi trọng số trong cài đặt thì lần tính sau ra số mới, không cần sửa code.
2. Lượt bị chặn trùng / từ chối consent không làm tăng `TotalSubmissions`.
3. Dưới số lượt tối thiểu → `NEW`.
4. Chạy worker 2 lần → không tạo trùng dòng.
5. Affiliate A không xem được số liệu của Affiliate B.

---

## Giao cho FE

Khi xong, bổ sung route + response vào [`API-INTEGRATION-BACKLOG.md`](../../../HRConnect-FE/docs/tasks/API-INTEGRATION-BACKLOG.md) (mục "Chưa làm được") để Frontend làm trang dashboard Admin và thẻ "Hiệu suất của tôi" cho Affiliate.
