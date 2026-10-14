# MF-01 (Giao diện): việc cần làm theo quy tắc phí mới

> **Dành cho:** Sang — giao diện MF-01 (Job).
> **Ngày:** 2026-10-14.
> **Backend:** Mi làm, xem [`mf01-be-viec-can-lam-theo-quy-tac-phi.md`](mf01-be-viec-can-lam-theo-quy-tac-phi.md). Request/response đầy đủ nằm ở các mục A2, A4, A5 của file đó.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md).

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ✅ đã đúng.

---

## Ý tưởng chính

Giữ ý của MF-01: **Client được nhập mức phí mong muốn** để Internal HR có căn cứ thỏa thuận. Bổ sung phần còn thiếu: **Internal HR chốt con số cuối cùng khi duyệt**.

```
Client nhập JD + phí ĐỀ XUẤT (không bắt buộc)
        │  gửi duyệt
        ▼
Internal HR xem đề xuất ──► liên hệ Client thỏa thuận (ngoài hệ thống)
        │
        ▼
Internal HR nhập phí ĐÃ CHỐT (điền sẵn = đề xuất của Client, hoặc mặc định Admin)
        │  duyệt
        ▼
Job lưu cả 2 bộ: proposedTerms (Client đề xuất) + commercialTerms (HR chốt)
MF-05 tính tiền theo commercialTerms
```

## API giao diện cần dùng (Mi làm)

| Màn hình | API | Mục trong file backend |
|---|---|---|
| Form tạo / sửa job (Client) | `POST /api/v1/jobs`, `PUT /api/v1/jobs/{jobId}` — gửi khối `proposedTerms` thay cho `feeMultiplier`, `warrantyDays`, `paymentDueDays`, `sourcingPricePerCv` | A2 |
| Màn duyệt job (Internal HR, Admin) | `GET /api/v1/jobs/{jobId}/commercial-terms/defaults` — lấy `proposed`, `adminDefaults`, `prefill`, `ranges` | A4.1 |
| Màn duyệt job | `POST /api/v1/jobs/{jobId}/approve` — body có `commercialTerms`, `agreementReference`, `note` | A4.2 |
| Chi tiết job (Client) | `GET /api/v1/jobs/{jobId}` — đọc `proposedTerms`, `commercialTerms` | A5 |

Trong lúc Mi chưa xong API: dựng giao diện với dữ liệu giả theo đúng JSON mẫu trong file backend, rồi nối vào sau.

Ví dụ body form tạo job HEADHUNT_COD:

```jsonc
{
  "serviceTypeId": "uuid",
  "title": "Senior .NET Developer",
  "quantity": 2,
  "proposedTerms": {            // null nếu Client bỏ trống toàn bộ
    "feeMultiplier": 1.5,         // % lương năm → feeMultiplier = % × 12 / 100 (giữ cách tính hiện có)
    "warrantyDays": 30,
    "paymentDueDays": 20,
    "note": "Mong muốn phí 1,5 tháng vì tuyển 2 người"
  }
}
```

---

### F1. 🔴 Form tạo / sửa job của Client (`JobFormPage.tsx`)

Hiện form là một trang dài; các ô phí nằm lẫn giữa tên vị trí, kinh nghiệm, lương. Chia lại bằng `Steps` (antd):

| Bước | Tên | Nội dung |
|---|---|---|
| 1 | **Chọn dịch vụ** | Mỗi dịch vụ là một thẻ, có mô tả ngắn và **cách tính phí** (chỉ để đọc, xem bảng dưới). Chọn dịch vụ trước vì mỗi dịch vụ cần thông tin khác nhau |
| 2 | **Mô tả công việc** | Tên vị trí, số lượng, phạm vi hiển thị, mô tả, quyền lợi, yêu cầu, kỹ năng, lương, hạn nhận hồ sơ. Giống nhau cho cả 3 dịch vụ |
| 3 | **Nhu cầu và chi phí** | Theo dịch vụ đã chọn (xem bảng dưới) |
| 4 | **Xem lại và gửi duyệt** | Tóm tắt JD + khối **"Về chi phí"** + nút "Lưu nháp" / "Gửi duyệt" |

- Đổi dịch vụ ở bước 1 khi đã nhập bước 3 → hỏi xác nhận, xóa dữ liệu bước 3 của dịch vụ cũ.
- "Lưu nháp" dùng được ở mọi bước; bước nào thiếu thông tin bắt buộc thì đánh dấu ở thanh `Steps`.
- Khung "Tiến độ và xem trước" bên phải giữ nguyên.

**Nội dung theo dịch vụ:**

| | Bước 1 – thẻ dịch vụ (chỉ đọc) | Bước 3 – Nhu cầu và chi phí | Bước 4 – khối "Về chi phí" |
|---|---|---|---|
| **CV_APPLICATION** | "Đăng tin, ứng viên tự nộp hồ sơ. Trả theo gói, giá công khai." | Chọn **gói đăng tin** (hiện giá, số ngày, số hồ sơ tối đa của từng gói). Không có ô đề xuất phí | "Gói STANDARD: 1.500.000đ / 30 ngày. Bạn thanh toán **sau khi tin được duyệt**." |
| **CV_SOURCING** | "HR Connect tìm và giao CV đạt yêu cầu. Trả theo số CV bạn chấp nhận; đặt cọc khi tin được duyệt." | **Số CV muốn nhận** (bắt buộc) + khối **"Mức phí bạn đề xuất (không bắt buộc)"**: giá mỗi CV, ghi chú | "Bạn muốn nhận 10 CV. Giá mỗi CV và tiền đặt cọc sẽ được chuyên viên HR Connect xác nhận với bạn trước khi đăng tin. Bạn đề xuất: 500.000đ/CV." |
| **HEADHUNT_COD** | "HR Connect tuyển giúp bạn. Chỉ trả khi ứng viên bắt đầu đi làm, theo lương của người được tuyển. Bảo hành thay người miễn phí." | Khối **"Mức phí bạn đề xuất (không bắt buộc)"**: số tháng lương **hoặc** % lương năm (giữ cách nhập hiện có), bảo hành, hạn thanh toán, ghi chú | "Phí tính khi ứng viên bắt đầu đi làm, theo lương trong offer. Chuyên viên HR Connect sẽ liên hệ thống nhất mức phí, bảo hành và hạn thanh toán trước khi đăng tin. Bạn đề xuất: 1,5 tháng lương." |

**Câu chữ khối đề xuất phí (bước 3):**
- Tiêu đề: **"Mức phí bạn đề xuất (không bắt buộc)"**. Bỏ tiêu đề cũ "🎯 Thỏa thuận phí dịch vụ Headhunt" và câu "Nhập các điều khoản thương mại đã thống nhất…".
- Mô tả: *"Chuyên viên HR Connect sẽ liên hệ để thống nhất mức phí trước khi đăng tin. Mức phí chính thức là mức được xác nhận khi tin được duyệt."*
- Bỏ dấu bắt buộc ở các ô phí; bỏ placeholder "100,000" và "14".
- **Không** hiện giá mặc định của Admin trên form Client (tránh Client coi đó là giá cuối) **[cần nhóm xác nhận nếu muốn hiện "giá tham khảo"]**.

---

### F2. 🔴 Màn duyệt job của Internal HR và Admin (`JobReviewPage.tsx`)

thay các `Tag` phí bằng khối **"Điều khoản phí"**:
- Cột trái **"Client đề xuất"** (chỉ đọc, kèm ghi chú của Client); cột phải **"Chốt"** (ô sửa được, điền sẵn `prefill`).
- Hiện mặc định Admin nhỏ bên dưới để HR tham khảo; hiện khoảng hợp lệ.
- Ô nào HR sửa khác đề xuất → tô màu và bắt buộc nhập "Mã tham chiếu thỏa thuận".
- CV_SOURCING: hiện tổng phí và tiền cọc dự kiến, cập nhật theo ô đang nhập.
- Nút "Duyệt và công bố" gửi body như trên.

Mã lỗi backend cần hiện thành câu dễ hiểu ngay dưới ô tương ứng:

| Mã | Câu hiển thị |
|---|---|
| `TERM_OUT_OF_RANGE` | "Giá trị phải từ … đến …" (lấy khoảng từ `ranges`) |
| `AGREEMENT_REFERENCE_REQUIRED` | "Bạn đã chốt khác mức Client đề xuất. Nhập mã tham chiếu thỏa thuận (email, hợp đồng)." |
| `NOTE_REQUIRED` | "Bạn giảm số CV so với yêu cầu của Client. Ghi lý do để Client thấy." |

Nút **Từ chối** thêm lựa chọn lý do **"Chưa thống nhất được mức phí"** (`REJECTED_TERMS_NOT_AGREED`).

---

### F3. 🟠 Chi tiết job phía Client

- Chưa duyệt: *"Mức bạn đề xuất: 1,2 tháng lương. Đang chờ HR Connect xác nhận."*
- Đã duyệt: *"Phí dịch vụ = lương offer × **1,4** cho mỗi người đi làm. Thanh toán trong **20** ngày kể từ ngày đi làm. Bảo hành **30** ngày."* (lấy từ `commercialTerms`). Nếu khác đề xuất, ghi thêm *"(bạn đề xuất 1,2)"*.

---

### F4. ✅ CV_APPLICATION: thanh toán sau khi duyệt

Backend đã đúng (duyệt → `PENDING_PAYMENT` → thanh toán → `ACTIVE`). Kiểm tra lại: Client chỉ thấy nút **"Thanh toán"** khi job ở `PENDING_PAYMENT`, không thấy trước khi gửi duyệt.

---

### F5. Tiêu chí nghiệm thu giao diện

1. Form Client có 4 bước; các ô phí chỉ xuất hiện ở bước 3 và bước 4, không nằm lẫn trong bước mô tả công việc.
2. Chọn CV_APPLICATION → bước 3 chỉ có chọn gói, không có ô đề xuất phí; bước 4 hiện giá gói và câu "thanh toán sau khi tin được duyệt".
3. Bỏ trống toàn bộ ô đề xuất phí vẫn gửi duyệt được (HEADHUNT_COD, CV_SOURCING).
4. Đổi dịch vụ ở bước 1 sau khi đã nhập bước 3 → có hộp xác nhận, dữ liệu bước 3 cũ bị xóa.
5. Màn duyệt có 2 cột "Client đề xuất" (chỉ đọc) và "Chốt" (sửa được, điền sẵn `prefill`).
6. Sửa ô "Chốt" khác đề xuất → ô được tô màu, ô "Mã tham chiếu thỏa thuận" thành bắt buộc.
7. CV_SOURCING: tổng phí và tiền cọc dự kiến cập nhật ngay khi sửa số CV hoặc giá mỗi CV.
8. Chi tiết job phía Client: chưa duyệt hiện "Đang chờ HR Connect xác nhận"; đã duyệt hiện số đã chốt, kèm "(bạn đề xuất …)" nếu khác.
9. Mã lỗi backend hiện đúng câu ở bảng F2, không hiện mã thô.

## Thứ tự gợi ý

1. **F1** (form 4 bước) — làm được ngay bằng dữ liệu giả.
2. **F2** khi Mi xong A4.1 và A4.2.
3. **F3** khi Mi xong A5.
