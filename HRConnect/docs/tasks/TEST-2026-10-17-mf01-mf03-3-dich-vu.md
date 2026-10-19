# Báo cáo test MF-01 → MF-03 theo 3 dịch vụ (17/10/2026)

> **Môi trường:** backend deploy `https://hr-connect-0ykm.onrender.com`, FE chạy local (`localhost:5173`, proxy về backend Render), AI v2 chạy trên máy Quí qua tunnel `https://ai-dev.hrconnectvn.online`.
> **Tài khoản:** Client, `internalhr@gmail.com`, `affiliate@gmail.com`, `candidate@gmail.com`. Người dùng tự đăng nhập; ứng viên affiliate xác nhận qua link email.
> **Liên quan:** lỗi FE còn mở ở [`FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md`](FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md) mục 5; việc hạ tầng ở [`../deploy/render-be-ai-local.md`](../deploy/render-be-ai-local.md) mục 7. BE và AI của buổi test 17/10 đã sửa xong.

## 1. Kết quả tổng

| Dịch vụ | Job test | MF-01 (tạo, duyệt) | MF-02 (nộp hồ sơ) | MF-03 (AI, sàng lọc, Client) | Kết quả |
|---|---|---|---|---|---|
| CV_APPLICATION | `[TEST] Junior .NET Backend Developer (CV Application)` (`4202f4f6`) | Tạo bằng mẫu JD → HR duyệt → ghi nhận phí đăng tin → ACTIVE | Candidate tự nộp CV_Test 1 | AI 90/100 → Client chọn ứng viên | **Đạt** |
| HEADHUNT_COD | `[TEST] Junior .NET Backend Developer (Headhunt COD)` (`bf19eeb2`) | Client đề xuất 1.5 tháng / 30 ngày / 20 ngày → HR chốt & duyệt → ACTIVE | Affiliate giới thiệu → ứng viên đồng ý qua email | AI 0/100 (CV thiết kế đồ họa, chấm đúng) → HR chọn gửi Client → Client thấy hồ sơ, **liên hệ và CV bị ẩn** | **Đạt** |
| CV_SOURCING | `[TEST] Frontend ReactJS Developer (CV Sourcing)` (`0e22786a`) | Client đề xuất 3 CV × 600.000 đ → HR chốt (cọc 50%, duyệt CV 7 ngày, thanh toán 20 ngày) → ACTIVE | Affiliate giới thiệu → ứng viên đồng ý qua email | AI 92/100 → HR chọn → giao CV (hạn 7 ngày) → Client **thấy đủ liên hệ**, chấp nhận CV | **Đạt**, nhưng xem N20 (khoản cọc) |

Luồng chính của cả 3 dịch vụ chạy hết từ đầu tới cuối. Có **27 điểm bất thường** dưới đây; N20 (cọc CV Sourcing) đã sửa và test lại ở mục 7.

## 2. Nghiệp vụ cần nhóm chốt

| Mã | Mức | Màn hình | Hiện trạng | Đề xuất |
|---|---|---|---|---|
| ~~N20~~ | ✅ Đã sửa | HR duyệt job CV_SOURCING | Ban đầu: duyệt xong job `ACTIVE` mà không có khoản cọc. **Nhóm chốt 17/10:** chưa đóng cọc thì không mở job | Đã làm và test lại trên bản deploy, xem mục 7 |
| N4 | Trung bình | HR > Duyệt tin > Ghi nhận thanh toán | Internal HR ghi nhận thanh toán thủ công được. `main-flows.md` ghi Platform Admin là bên ghi nhận thu phí | Chốt phân quyền ghi nhận thanh toán |
| N16 | Trung bình | Client > hồ sơ Headhunt | Client không xem được nội dung CV, kể cả bản đã che liên hệ, trước khi lên lịch phỏng vấn. Chỉ có điểm AI để quyết định | Chốt có cho Client xem CV đã che email/SĐT không |
| N12 | Thấp | Affiliate > chi tiết job | Affiliate không thấy điều khoản hoa hồng (tỉ lệ, 30 ngày bảo hành) khi chọn job | Hiện hoa hồng ước tính theo điều khoản đã chốt |
| N22 | Thấp | HR > sàng lọc Sourcing | "Chọn gửi Client" và "Giao CV" là 2 bước riêng, HR dễ quên bước giao | Gộp làm 1 bước, hoặc nhắc HR các hồ sơ đã chọn mà chưa giao |
| — | Thấp | HR > chọn gửi Client | Không cảnh báo khi gửi hồ sơ AI 0 điểm | Tùy nghiệp vụ: có thể hiện cảnh báo nhẹ |

## 3. Backend

| Mã | Mức | Hiện trạng | Đề xuất |
|---|---|---|---|
| N14 | Trung bình | Lịch sử hồ sơ do affiliate nộp ghi "Ứng viên Trương Hoàng Quí đã nộp hồ sơ" và người thực hiện là ứng viên. Không có tên affiliate | Ghi đúng nguồn: "Affiliate X giới thiệu, ứng viên đồng ý lúc …" |
| ~~N20~~ | ✅ | Đã sửa: duyệt tạo phiếu `DEPOSIT`, job chờ cọc; ghi nhận cọc thì mở job | — |
| N27 | Thấp | AI v2: `LOG_LEVEL=INFO` làm thư viện `httpx` in cả các request tải mô hình HuggingFace lúc khởi động, log khó đọc | Đặt logger `httpx` (và `huggingface_hub`) ở `WARNING` trong `ai-service-v2/app/main.py` |

## 4. Frontend

| Mã | Mức | Màn hình | Hiện trạng | Đề xuất |
|---|---|---|---|---|
| N5 | Trung bình | HR > Ghi nhận thanh toán | Ô "Mã tham chiếu / Số biên lai" điền sẵn giá trị giả `UNC-051271`. HR có thể xác nhận mà không nhập mã thật | Để trống, bắt buộc nhập |
| N1 | Trung bình | Client > Tin tuyển dụng | Thẻ job "Chờ duyệt" đã hiện nút "Thanh toán" | Chỉ hiện khi job ở trạng thái chờ thanh toán |
| N23 | Trung bình | Client > hồ sơ Sourcing | Sau "Chấp nhận CV", drawer vẫn hiện "Chờ phản hồi" và còn nút Chấp nhận/Từ chối, đến khi tải lại trang (giống FE-1) | Refetch drawer sau khi gọi API thành công |
| N7 | Trung bình | Client > Hồ sơ ứng viên | Trình duyệt rộng khoảng 800px: drawer chi tiết bị đẩy ra ngoài màn hình | Sửa responsive drawer |
| N6 | Thấp | HR > Dashboard | Đếm và liệt kê cả hồ sơ CV_APPLICATION (Client tự sàng lọc), kèm câu "Client lên lịch sau khi bạn chọn hồ sơ gửi đi" | Chỉ hiện HEADHUNT_COD / CV_SOURCING hoặc tách riêng |
| N8 | Thấp | Client > hồ sơ CV_APPLICATION | Client tự chọn hồ sơ nhưng nhãn hiện "Đã chọn gửi Client" | Nhãn theo dịch vụ, ví dụ "Đã chọn phỏng vấn" |
| N24 | Thấp | Client > hồ sơ Sourcing | Chip trạng thái vẫn "Đã chọn gửi Client" sau khi Client đã chấp nhận CV. Danh sách không phân biệt CV đã chấp nhận | Hiện trạng thái bàn giao (Chờ phản hồi / Đã chấp nhận / Đã từ chối) |
| N21 | Thấp | HR > chọn gửi Client (Sourcing) | Hộp xác nhận ghi Client "có thể lên lịch phỏng vấn". Với Sourcing, Client chỉ chấp nhận/từ chối CV. Không có toast sau khi chọn | Câu xác nhận theo dịch vụ, thêm toast |
| N13 | Thấp | Affiliate > Lượt giới thiệu | Hiện mã thô "Tiến độ: CV_REVIEW" / "SHORTLISTED" | Dịch sang tiếng Việt |
| N15, N17 | Thấp | Lịch sử hồ sơ (HR và Client) | Hiện mã thô "Chuyển trạng thái: SCREENING", "từ SUBMITTED sang SCREENING" | Dịch nhãn trạng thái |
| N18 | Thấp | Client > thẻ job và xem trước | Job Sourcing hiện "Cần 1 người" / "· 1 người" | Với Sourcing hiện "3 CV" (số CV muốn nhận) |
| N10 | Thấp | HR > Duyệt tin | Duyệt xong danh sách trống nhưng bộ đếm "Chờ duyệt 1" chưa cập nhật | Refetch bộ đếm |
| N11 | Thấp | Affiliate > Việc làm | Bấm job nhảy sang trang công khai `/jobs/:id` (thanh trên), mất sidebar affiliate | Mở chi tiết trong layout affiliate |
| N2 | Thấp | HR > sidebar | "Bảo hành & thử việc", "Đối soát nhận việc" nằm dưới nhóm "CHƯA CÓ API", trong khi API bảo hành MF-05 đã có | Chuyển nhóm khi đã gắn API |
| N3 | Thấp | HR > Duyệt tin > chi tiết | Cột Mức lương / Kinh nghiệm bị ép hẹp, số xuống dòng từng phần | Sửa bố cục cột |
| N9 | Thấp | Client > tạo job Headhunt | Ô "Thời hạn bảo hành đề xuất" có ví dụ "60" ngày và ghi chú mẫu "cần bảo hành 60 ngày". Quy tắc phí đã chốt 30 ngày | Đổi ví dụ theo cấu hình |
| ~~N19~~ | ✅ Đã sửa 19/10 | Thư viện mẫu JD | Mẫu .NET hiện "0 lượt dùng" dù đã dùng 2 lần. Nguyên nhân: form tạo job không đăng ký trường `templateId` nên không gửi lên backend | Đã thêm trường ẩn `templateId` trong `JobFormPage.tsx` |
| N25 | Thấp | HR > Duyệt tin > thẻ job bên trái | Job CV_SOURCING chờ cọc vẫn có nhãn chung "Chờ nộp phí" (khung chi tiết bên phải đã ghi đúng "Chờ đặt cọc CV Sourcing") | Dùng `isAwaitingSourcingDeposit` trong `JobReviewPage.tsx` để hiện "Chờ đặt cọc" |
| N26 | Thấp | Admin > "Chi trả hoa hồng" (`/admin/payouts`) | Trang Tài chính đang chạy thật (công nợ phí, hoa hồng, payout) nhưng menu vẫn nằm dưới "CHƯA CÓ API" và bị làm mờ; tiêu đề ghi "MF-05 · HEADHUNT_COD" dù có phí CV Sourcing; ghi nhận đã thu xong không có thông báo | Chuyển menu khỏi nhóm "CHƯA CÓ API" (`AdminLayout.tsx`, `rbac.ts`), đổi tiêu đề thành "Tài chính MF-05", thêm toast khi ghi nhận |

## 5. Những phần chạy đúng

- **AI qua tunnel:** chấm cả 3 dịch vụ (90, 0, 92). Nhận xét bằng tiếng Việt, trích dẫn CV đúng, liệt kê đúng yêu cầu còn thiếu.
- **Ẩn/hiện liên hệ:**
  - Headhunt: Client không thấy email, SĐT, CV ("Hiển thị sau khi ứng viên đi làm").
  - Sourcing: Client thấy đủ.
- **Chốt điều khoản thương mại:**
  - Hộp chốt điền sẵn đúng đề xuất của Client.
  - Tổng tiền và tiền cọc tính đúng (1.800.000 đ / 900.000 đ).
  - `commercialTerms` lưu đủ.
- **Đồng ý của ứng viên:** affiliate giới thiệu → ứng viên đồng ý qua email (hạn 48 giờ) → hồ sơ và AI mới bắt đầu.
- **Giao CV Sourcing:** hạn phản hồi 7 ngày, khớp điều khoản đã chốt. Chấp nhận CV lưu được thời điểm phản hồi.
- **Gói FREE:** bị khóa đúng khi công ty đã có 18 tin mở.

## 6. Dữ liệu test còn lại trên backend deploy

- 3 job `[TEST]` ở trên, đều đang `ACTIVE`.
- Job `[TEST2] Frontend ReactJS (CV Sourcing, chờ cọc)` (`f718b31d`): `ACTIVE`, cọc 600.000 đ đã ghi nhận (mã `TEST-COC-20261017`).
- Phiếu cọc 900.000 đ của job Sourcing `0e22786a` do worker tạo, đang `PENDING`.
- Hồ sơ `candidate@gmail.com` vào `[SEED] Flutter Mobile Developer` (AI 26,72).
- Các hồ sơ:
  - CV_APPLICATION: ứng viên `candidate@gmail.com`, đang phỏng vấn.
  - Headhunt: "Trương Hoàng Quí", đã chọn gửi Client.
  - Sourcing: "Trương Hoàng Quí", Client đã chấp nhận.
- Đóng hoặc xóa các job `[TEST]` trước khi demo.

## 7. Test lại tối 17/10 sau khi sửa (backend deploy mới + AI v2 mới)

| Bước | Kết quả |
|---|---|
| Backend Render chạy bản mới | ✅ Swagger có `POST /jobs/{jobId}/sourcing-settlement`, `/health/ready` Healthy |
| AI v2 qua tunnel `ai-dev` | ✅ `/health` ok; `/docs`, `/openapi.json` 404; `match-file` không token 401 |
| Client tạo `[TEST2]` CV Sourcing 2 CV × 600.000 đ, gửi duyệt | ✅ |
| Internal HR chốt điều khoản và duyệt | ✅ Job `PENDING_PAYMENT`, phiếu `DEPOSIT` 600.000 đ `PENDING`, hạn 06/11 |
| Màn Internal HR | ✅ "Chờ đặt cọc CV Sourcing", không còn nút "Ghi nhận thanh toán thủ công" (còn N25) |
| Gọi API phí đăng tin cho job Sourcing | ✅ 409 `JOB_REQUIRES_SOURCING_DEPOSIT` |
| Admin ghi nhận cọc ở trang Tài chính | ✅ Phí "Đã thanh toán", job `ACTIVE`, `postedAt` cập nhật (còn N26) |
| Job Sourcing duyệt trước khi deploy (`0e22786a`) | ✅ Worker tạo phiếu cọc 900.000 đ, job giữ `ACTIVE` |
| Candidate nộp CV IT vào `[SEED] Flutter Mobile Developer` | ✅ AI log đủ bước: nhận việc → lấy JD (9 yêu cầu) và CV (PDF 4 trang) → Gemini `gemini-3.5-flash-lite` 7,6 giây → trả kết quả **26,72** sau 49,9 giây (khoảng 38 giây là tải Sentence-BERT lần đầu sau khởi động; còn N27) |
