# Quy tắc phí và hoa hồng của 3 dịch vụ (bản thống nhất)

> **Dành cho:** cả nhóm (MF-01, MF-02, MF-03, MF-04, MF-05).
> **Ngày:** 2026-10-14.
> **Mục đích:** trước đây nhóm có hai bộ tài liệu nghiệp vụ khác nhau (3 file mô hình kinh doanh cũ trong `HRConnect/docs` và bộ "1. APPLICATION / 2. CV SOURCING / 3. HEADHUNT"), mỗi người code theo một bộ nên code bị lệch. File này là **nguồn duy nhất** để code theo; 3 file cũ trong repo đã được xóa (vẫn xem lại được trong lịch sử git). Tài liệu khác nếu mâu thuẫn với file này thì **làm theo file này**.

Ký hiệu trong file:
- ✅ **Đã chốt**: đã được xác nhận (người phụ trách hoặc GVHD).
- 🟡 **Đề xuất**: chờ nhóm xác nhận. Trong lúc chờ, code theo đề xuất.

---

## 0. Nguyên tắc chung (áp dụng cho cả 3 dịch vụ)

| # | Nguyên tắc | Trạng thái |
|---|---|---|
| G1 | **Không viết cứng con số** (giá, hệ số, số ngày, %). Admin cấu hình **giá trị mặc định** ở trang Cài đặt (`/admin/settings`). | ✅ |
| G2 | Giá do **Internal HR thỏa thuận với Client**, Client **không tự nhập giá**. Khi duyệt job, Internal HR **được tinh chỉnh** các con số; màn duyệt điền sẵn mặc định. | ✅ |
| G3 | Con số HR chốt được **lưu trên job lúc duyệt**. Admin đổi mặc định sau đó **không** ảnh hưởng job đã duyệt. Mọi chỉnh sửa có audit (giá trị trước, giá trị sau, người duyệt, thời điểm). | ✅ |
| G4 | Tiền chuyển **ngoài hệ thống**. HR Connect chỉ ghi nhận số tiền, trạng thái, ngày, mã tham chiếu, chứng từ. | ✅ |
| G5 | Hoa hồng Affiliate **chỉ được chi sau khi Client đã trả phí** và Admin duyệt. | ✅ |

---

## 1. HEADHUNT_COD – Phí tuyển dụng thành công

### 1.1 Phí Client trả

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Công thức | **Phí = lương gross tháng trong offer × hệ số phí**, tính cho **từng người** đi làm | ✅ |
| Hệ số phí | **Internal HR tinh chỉnh khi duyệt job** theo thỏa thuận với Client. Admin chỉ cấu hình giá trị **điền sẵn** (`mf05.headhunt.fee_multiplier`). Không cố định 1,5 hay 2,0 | ✅ |
| Khoảng hợp lệ | 0,1 – 10 | ✅ |
| Lúc phát sinh phí | Khi ứng viên **thực tế bắt đầu đi làm** (Placement được xác nhận). Ký offer **chưa** phát sinh phí | ✅ |
| Tuyển nhiều người | Mỗi người đi làm là một khoản phí riêng. Tuyển thiếu thì chỉ tính số người đã đi làm | ✅ |
| Hạn thanh toán | Ngày đi làm + số ngày hạn thanh toán (mặc định **20 ngày**, HR chỉnh được khi duyệt). Trạng thái phí: `PENDING → DUE → PAID`, quá hạn → `OVERDUE` | ✅ |

### 1.2 Bảo hành

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Thời gian | **30 ngày** kể từ ngày đi làm (mặc định, HR chỉnh được khi duyệt) | ✅ |
| Ứng viên nghỉ trong bảo hành | **Không hoàn phí**. HR Connect **tìm người thay thế miễn phí** cho Client | 🟡 |
| Người thay thế | Không phát sinh phí mới. Bảo hành tính lại từ đầu cho người thay thế | 🟡 |

### 1.3 Hoa hồng Affiliate

> **Quy tắc của GVHD:** ứng viên đi làm **đủ 1 tháng (30 ngày)** thì Affiliate **đạt 100% hoa hồng ngay**, không chia nhiều mốc. ✅

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Mức hoa hồng | Theo **Commission Rule** do Admin cấu hình (số tiền cố định hoặc % phí). Không nhập trên job | ✅ |
| Lúc **đạt** | Ứng viên đi làm **đủ 30 ngày** → đạt **100%** | ✅ |
| Lúc **chi** | Chỉ sau khi **Client đã trả phí** và **Admin duyệt** | ✅ |
| Ứng viên nghỉ **trước** ngày 30 | Hoa hồng của ứng viên đó bị **hủy toàn bộ** | 🟡 |
| Ứng viên nghỉ **sau** ngày 30 | Hoa hồng đã đạt **không bị ảnh hưởng** | ✅ |
| Người thay thế | Affiliate giới thiệu người thay thế được hoa hồng (lấy từ khoản phí cũ), cũng phải đi làm đủ 30 ngày | 🟡 |

**Trạng thái hoa hồng (mỗi trạng thái chỉ có MỘT nghĩa):**

| Trạng thái | Nghĩa | Affiliate thấy |
|---|---|---|
| `PENDING` | Đã giới thiệu, ứng viên **chưa đi làm** | "Đang chờ ứng viên đi làm" |
| `IN_WARRANTY` 🟡 | Ứng viên **đã đi làm, chưa đủ 30 ngày** | "Đang trong 30 ngày đầu" |
| `ON_HOLD` | Client **báo ứng viên nghỉ**, chờ Internal HR xác minh | "Tạm giữ – đang xác minh" |
| `EARNED` | **Đủ 30 ngày**, đạt 100% | "Đã đạt, chờ Client thanh toán" |
| `PAYABLE` | Client **đã trả phí** + Admin **đã duyệt** | "Chờ chuyển tiền" |
| `PAID` | Đã chuyển tiền | "Đã nhận" |
| `CANCELLED` | Ứng viên nghỉ trước ngày 30 (đã xác minh) | "Đã hủy" |

```
PENDING ──đi làm──▶ IN_WARRANTY ──đủ 30 ngày──▶ EARNED ──Client trả + Admin duyệt──▶ PAYABLE ──▶ PAID
                         │
                  Client báo nghỉ
                         ▼
                      ON_HOLD ──HR xác minh: nghỉ thật──▶ CANCELLED
                         └────HR xác minh: vẫn đi làm──▶ quay lại IN_WARRANTY
```

> 🟡 `IN_WARRANTY` là trạng thái mới đề xuất, để **không** dùng chung `ON_HOLD` cho hai nghĩa khác nhau. Nếu nhóm không muốn thêm trạng thái mới thì dùng lại `PENDING` cho giai đoạn này (như code MF-05 trước 14/10). **Tuyệt đối không** dùng `EARNED` cho "vừa đi làm", vì Affiliate sẽ hiểu là đã có tiền.

### 1.4 Ví dụ

ABC tuyển 1 người. Internal HR thỏa thuận với ABC hệ số **1,8**, bảo hành 30 ngày, thanh toán trong 20 ngày. Nam (do Affiliate Hùng giới thiệu) đi làm ngày 01/11, lương 30 triệu.

| Ngày | Sự kiện | Phí | Hoa hồng Hùng |
|---|---|---|---|
| 01/11 | Nam đi làm | Phát sinh **54 triệu** (30 × 1,8), hạn trả 21/11 | `IN_WARRANTY` |
| 18/11 | ABC trả phí | `PAID` | vẫn `IN_WARRANTY` |
| 01/12 | Nam đủ 30 ngày | | `EARNED` (100%) |
| 02/12 | Admin duyệt | | `PAYABLE` → chuyển tiền → `PAID` |

Nếu ABC trả phí **sau** ngày 01/12 thì hoa hồng của Hùng nằm ở `EARNED` cho tới khi ABC trả.

---

## 2. CV_SOURCING – Phí theo số CV đạt yêu cầu

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Thỏa thuận trước | Số CV (Sourcing Target), tiêu chí, giá mỗi CV. Client đề xuất số CV; **Internal HR được tinh chỉnh** số CV, giá mỗi CV, thời hạn xem xét, hạn thanh toán khi duyệt JD | ✅ |
| Giá mỗi CV | Admin cấu hình giá điền sẵn; HR chốt theo từng job. Không viết cứng 500.000 hay 600.000 | ✅ |
| Đặt cọc | **50%** tổng gói khi job được duyệt (cấu hình được). Phần còn lại tính theo **số CV thực tế được chấp nhận** | 🟡 |
| Giao thiếu | Phần cọc dư được hoàn hoặc trừ vào lần sau | 🟡 |

**Khi nào một CV được tính tiền** — phải đủ **tất cả**:
1. Ứng viên **đã đồng ý** cho dùng hồ sơ (consent `CONFIRMED`).
2. Không trùng; không phải ứng viên Client đã có từ trước.
3. CV hợp lệ, đúng job và tiêu chí; Internal HR đã xác nhận đạt.
4. Client **chấp nhận** trong thời hạn xem xét, **hoặc** hết thời hạn mà Client không phản hồi → **coi như chấp nhận**. 🟡

**Không** tính tiền: hồ sơ trùng, ứng viên từ chối consent, hồ sơ giả, gửi sai job, Client từ chối **kèm lý do hợp lệ** trong thời hạn. Client không chọn ứng viên để phỏng vấn **không** phải lý do từ chối.

**Hoa hồng Affiliate:**

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Quỹ hoa hồng | **60%** phí (Admin cấu hình) | ✅ |
| Mỗi CV | Quỹ ÷ Sourcing Target. Chỉ CV được tính tiền mới có hoa hồng | ✅ |
| Lúc đạt | CV được Client chấp nhận → `EARNED` | ✅ |
| Lúc chi | Client trả đủ **và** hết thời hạn tranh chấp → `PAYABLE` → `PAID` | ✅ |
| Không trả | Khi Affiliate vừa upload CV | ✅ |

---

## 3. CV_APPLICATION – Phí đăng tin

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| Giá | **Giá công khai** theo gói, không thương lượng. Admin quản lý danh mục gói (giá, số ngày, số hồ sơ tối đa, có AI chấm điểm hay không) | ✅ |
| Trình tự | **Duyệt trước, trả tiền sau:** Client gửi duyệt → Internal HR/Admin duyệt → tạo đơn `PENDING_PAYMENT` → Client trả → `PAID` → job `ACTIVE`, bắt đầu nhận hồ sơ | 🟡 |
| Lý do | Nếu trả trước rồi mới duyệt, job bị từ chối sẽ phải hoàn tiền | |
| Gói FREE | Giới hạn theo cấu hình (số job đang mở, chu kỳ đăng lại) | ✅ |
| Hoa hồng | **Không có**. Toàn bộ là doanh thu nền tảng | ✅ |

---

## 4. Những chỗ code đang lệch file này

| # | Ở đâu | Đang làm | Cần sửa thành | Người phụ trách |
|---|---|---|---|---|
| 1 | MF-01 `JobFormPage.tsx` | Client tự nhập hệ số phí, giá mỗi CV | Bỏ ô giá khỏi form Client (G2) | MF-01 |
| 2 | MF-01 `JobReviewPage.tsx`, `ApproveJob` | HR chỉ xem giá, không sửa | HR tinh chỉnh điều khoản khi duyệt, có audit (G2, G3) | MF-01 |
| 3 | MF-01 `BusinessSettingsOptions` | Mặc định viết cứng: 14 ngày, 100.000đ/CV | Đọc từ trang Cài đặt Admin (G1) | MF-01 |
| 4 | MF-01 gói đăng tin | Chặn gửi duyệt khi chưa trả tiền | Duyệt trước, trả tiền sau (mục 3) | MF-01 |
| 5 | MF-01 migrations | 5 migration thiếu `.Designer.cs`, snapshot không cập nhật | Tạo lại migration chuẩn | MF-01 |
| 6 | MF-05 `BusinessSettings.cs` | Hệ số điền sẵn đổi thành 2,0 | Giá trị điền sẵn do nhóm chốt; HR chỉnh từng job | MF-05 |
| 7 | MF-05 `WarrantyClaimCommands` / `PlacementFinanceService` | Vừa đi làm → `ON_HOLD` | `IN_WARRANTY` (hoặc `PENDING`) — mục 1.3 | MF-05 |
| 8 | MF-05 `SettlementCommands.cs` | Thông báo ghi "60 ngày" | Lấy số ngày bảo hành của job | MF-05 |
| 9 | MF-05 `financeLabels.ts` | `EARNED` = "Đã đạt mốc đi làm" | Nhãn theo bảng mục 1.3 | MF-05 |
| 10 | MF-05 phí dịch vụ | Chưa có trạng thái `DUE` | Thêm `DUE` (mục 1.1) | MF-05 |

---

## 5. Cần nhóm xác nhận

1. Thêm trạng thái `IN_WARRANTY` hay dùng lại `PENDING`?
2. Ứng viên nghỉ trong bảo hành: thay người miễn phí + hủy hoa hồng — đồng ý?
3. CV_SOURCING: đặt cọc 50% và "hết hạn xem xét thì coi như chấp nhận" — đồng ý? Thời hạn xem xét bao nhiêu ngày?
4. CV_APPLICATION: chuyển sang "duyệt trước, trả tiền sau" — đồng ý?
5. Giá trị điền sẵn của hệ số phí Headhunt: 1,5 hay 2,0?

Khi nhóm chốt xong, cập nhật bảng trên (đổi 🟡 thành ✅) và sửa các tài liệu cũ trỏ về file này.
