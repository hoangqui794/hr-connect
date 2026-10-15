# MF-02: Khắc phục kiểm tra PDF chặn nhầm CV thật

> **Dành cho:** dev phụ trách MF-02 (tiếp nhận hồ sơ, tải CV).
> **Ngày phát hiện:** 2026-10-14.
> **Cập nhật kiểm thử CV thật:** 2026-10-15.
> **Trạng thái:** ✅ **Đã sửa trên nhánh `feature/mf02-pdf-validation`**.
> **Code hiện tại:** `HRConnect/HRConnect.Infrastructure/Services/Storage/PdfCvValidator.cs`, được gọi tập trung từ `CvStorageService.ReadAndValidatePdfAsync` trước khi upload R2 hoặc ghi database.

## 0. Kết quả xử lý

- Đã pin package chính thức `PdfPig` phiên bản `0.1.16`.
- Đã xóa bộ dò token trên byte thô và thay bằng parse cấu trúc PDF.
- PDF 1.7 dùng object stream/xref stream, destination `/OpenAction`, internal GoTo, URI link và chữ `/JS` nằm trong content stream được chấp nhận.
- JavaScript, Launch, action ngoài allowlist, file nhúng, FileAttachment, RichMedia, PDF mã hóa, không có trang, quá 30 trang hoặc vượt giới hạn traversal bị từ chối bằng mã lỗi ổn định.
- Validator chỉ duyệt các nhánh có thể chứa hành động thực thi; bỏ qua cây accessibility, tài nguyên hiển thị và nội dung trang. Khóa `/A` chỉ được xem là action khi giá trị thực sự là action dictionary.
- Candidate upload, Candidate apply bằng file mới và Affiliate submit dùng chung validator qua `CvStorageService`; file bị từ chối dừng trước R2, repository, audit và `SaveChanges`.
- `MAX_CV_PDF_PAGES=30` cho phép điều chỉnh giới hạn trang theo môi trường.
- 42 test trực tiếp cho validator, 84 test nhóm Storage và toàn bộ 1.475 test backend đã qua.
- Đã chạy validator thật trên 32 CV private tại `D:\Ki_9\CV`: **32/32 được chấp nhận**. File không được commit vào repository.

Các commit triển khai:

- `7d46081` — thêm PdfPig và cấu hình giới hạn trang.
- `81de33b` — thay validator byte thô bằng validator cấu trúc.
- `8add764` — bổ sung ma trận regression cho PDF hiện đại và PDF nguy hiểm.

Các CV thật có dữ liệu cá nhân chỉ được dùng để acceptance tại máy local. Không commit tên file, nội dung hoặc bản PDF thật vào Git.

---

## 1. Ảnh hưởng

`ReadAndValidatePdfAsync` → `ValidatePdfStructure` chạy với **mọi đường nộp CV dạng file**:

- Candidate tự ứng tuyển: `POST /api/v1/jobs/{jobId}/apply` (gửi file mới)
- Affiliate giới thiệu ứng viên: `POST /api/v1/jobs/{jobId}/candidate-submissions` (gửi file mới)
- Tải CV lên kho CV của Candidate

Thử trên **32 CV thật** (lấy từ TopCV, Canva, Word, LaTeX… thuộc nhiều ngành):

| Kết quả | Số CV |
|---|---|
| ✅ Nộp được | **7** |
| ❌ Bị từ chối | **25 (78%)** |

Cả 25 file đều là PDF hợp lệ: mở bằng trình đọc PDF (PyMuPDF) thì đọc đủ trang và nội dung.

### 1.1 Regression phát hiện ngày 2026-10-15

Sau bản chuyển sang PdfPig đầu tiên, chạy **chính `PdfCvValidator`** trên cùng thư mục 32 CV cho kết quả:

| Kết quả | Số CV |
|---|---|
| ✅ Nộp được | **6** |
| ❌ `PDF_ACTIVE_CONTENT` | **15** |
| ❌ `PDF_TRAVERSAL_LIMIT` | **11** |

Hai nguyên nhân mới đều là false positive:

1. PDF tagged do Canva/Adobe tạo dùng khóa `/A` trong `StructElem` để lưu thuộc tính layout/accessibility. Validator hiểu mọi `/A` là action nên yêu cầu `/S` và chặn nhầm.
2. Validator duyệt toàn bộ `StructTreeRoot`, font, XObject, resource và content graph. Các nhánh này không tự thực thi action nhưng có thể sâu hơn 32 cấp hoặc hơn 10.000 token ở CV bình thường.

Bản sửa hiện tại dùng traversal dạng stack, giữ node budget chống DoS, chỉ nhận diện `/A` khi giá trị là action dictionary và bỏ qua các nhánh trình bày/accessibility không có khả năng thực thi. Kết quả acceptance sau sửa là **32/32**.

---

## 2. Nguyên nhân

`ValidatePdfStructure` **dò chuỗi ký tự trên byte thô của file** thay vì đọc cấu trúc PDF. Có 2 quy tắc chặn nhầm.

### 2.1 Quy tắc "phải có `/Type /Page`": chặn nhầm 25 CV

```csharp
var documentText = Encoding.Latin1.GetString(bytes);
if (!documentText.Contains("/Type /Page", StringComparison.Ordinal) &&
    !documentText.Contains("/Type/Page", StringComparison.Ordinal))
{
    throw new BadRequestException("Tài liệu PDF không có trang nội dung hợp lệ.");
}
```

Từ **PDF 1.5** trở đi, các đối tượng (kể cả phần mô tả trang `/Type /Page`) thường được **nén trong object stream** (`/ObjStm`). Nén xong, chuỗi `/Type /Page` **không còn xuất hiện dạng đọc được** trong file.

Ví dụ thực tế:

| File | Phiên bản | Số trang (đọc bằng PyMuPDF) | Thấy `/Type /Page` trong byte thô | Có `/ObjStm` |
|---|---|---|---|---|
| CV Software Engineer (.NET) | PDF 1.7 | 3 | ❌ Không | ✅ Có |
| CV B2B Sales | PDF 1.7 | 2 | ❌ Không | ✅ Có |
| CV .NET Backend | PDF 1.4 | 1 | ✅ Có | ❌ Không → **nộp được** |

→ Gần như mọi CV xuất từ công cụ hiện đại đều dùng PDF 1.5+ nén, nên đều bị chặn.

### 2.2 Quy tắc "cấm `/OpenAction`, `/AA`, `/JS`…": chặn nhầm thêm 3 CV

```csharp
string[] forbiddenFeatures =
[
    "/Encrypt", "/JavaScript", "/JS", "/Launch", "/EmbeddedFile",
    "/RichMedia", "/OpenAction", "/AA"
];
```

Nếu bỏ quy tắc ở mục 2.1 thì vẫn còn 3 CV bị chặn, và **cả 3 đều không chứa mã độc**:

| CV | Bị chặn vì | Thực tế trong file |
|---|---|---|
| CV IT (LaTeX) | `/OpenAction` | `/OpenAction 1 0 R`: trỏ tới **trang cần mở khi xem file**, không phải JavaScript |
| CV IT (Word) | `/OpenAction` | `/OpenAction 42 0 R`: cũng chỉ là lệnh mở trang |
| CV Marketing | `/JS` | 3 byte `/JS` **nằm ngẫu nhiên trong dữ liệu ảnh/font đã nén**, không phải tên đối tượng PDF |

Cả 3 file **không có** `/JavaScript`.

`/OpenAction` là mục chuẩn của PDF, dùng để chọn trang và mức phóng to khi mở file. Word, LaTeX và nhiều công cụ khác đều tự thêm vào. Chỉ nguy hiểm khi nó trỏ tới **hành động** `/S /JavaScript` hoặc `/S /Launch`.

### 2.3 Lớp kiểm tra này cũng không chặn được file độc thật

Vì chỉ dò byte thô, kẻ tấn công chỉ cần **đặt JavaScript bên trong object stream đã nén** là `"/JavaScript"`, `"/JS"`, `"/OpenAction"` đều không lộ ra → file độc **vẫn được chấp nhận**.

Tóm lại, cách dò chuỗi trên byte thô **vừa chặn nhầm file thật, vừa bỏ lọt file độc**.

---

## 3. Giải pháp đã triển khai

Dùng một thư viện **đọc PDF thật** cho .NET (đề xuất **PdfPig** – `UglyToad.PdfPig`, mã nguồn mở, giấy phép Apache-2.0, đọc được object stream) thay cho việc dò chuỗi.

| Kiểm tra | Trước khi sửa (byte thô) | Đã triển khai |
|---|---|---|
| Đúng là PDF | Header `%PDF-1.x/2.x`, `%%EOF`, `startxref` | **Giữ nguyên** (rẻ, chặn sớm file rác) |
| Có trang | Dò chuỗi `/Type /Page` | Mở bằng thư viện, `NumberOfPages >= 1`; mở lỗi → "PDF bị hỏng" |
| Mã hóa | Dò `/Encrypt` | Kiểm tra trailer có khóa `/Encrypt` qua thư viện (hoặc mở thất bại vì cần mật khẩu) |
| JavaScript / Launch | Dò `/JS`, `/JavaScript`, `/Launch` trong toàn file | Duyệt **các đối tượng đã giải nén**: chặn dictionary có `/S /JavaScript`, `/S /Launch`, hoặc khóa `/JS` thật; chặn `/Names` → `/JavaScript` ở Catalog |
| `/OpenAction`, `/AA` | Cấm luôn | **Chỉ chặn khi** action trỏ tới có `/S /JavaScript` hoặc `/S /Launch`; cho phép destination (mảng trang / tham chiếu trang) |
| File nhúng | Dò `/EmbeddedFile` | Kiểm tra Catalog `/Names` → `/EmbeddedFiles` và annotation `/FileAttachment` |
| `/RichMedia` | Dò chuỗi | Kiểm tra annotation có `/Subtype /RichMedia` |
| Tagged PDF và resource graph | Không phân biệt ngữ cảnh | Không coi `/A` của `StructElem` là action; không duyệt accessibility, content và resource graph không thực thi |
| Link Candidate | Không kiểm tra scheme | Cho phép `http`, `https`, `mailto`, `tel`; từ chối `javascript`, `file`, `data`, `vbscript` và scheme lạ |

**Thông báo lỗi:** giữ đúng thông báo hiện tại cho từng loại lỗi để giao diện không phải sửa.

**Phương án sửa tạm từng được cân nhắc nhưng không sử dụng:**
1. Bỏ hẳn quy tắc `/Type /Page`; số trang sẽ do bộ đọc CV phía AI kiểm tra lại.
2. Bỏ `/OpenAction` khỏi danh sách cấm.
3. Chỉ chặn `/JS` khi đứng sau một khóa dictionary (ví dụ `/S /JavaScript /JS`), không chặn khi gặp ở byte ngẫu nhiên.

Ghi rõ đây là **sửa tạm**, vì nó vẫn không thấy được nội dung trong object stream (mục 2.3).

---

## 4. Test đã bổ sung

Tạo bộ file mẫu trong `HRConnect.UnitTests` (file nhỏ, không chứa dữ liệu cá nhân):

| # | File mẫu | Kỳ vọng |
|---|---|---|
| 1 | PDF 1.4 không nén, 1 trang | ✅ Chấp nhận |
| 2 | **PDF 1.7 có object stream** (`/ObjStm`), 2 trang | ✅ Chấp nhận (**đang bị từ chối**) |
| 3 | PDF có `/OpenAction [3 0 R /Fit]` (lệnh mở trang) | ✅ Chấp nhận (**đang bị từ chối**) |
| 4 | PDF có ảnh nén mà dữ liệu ảnh chứa byte `/JS` | ✅ Chấp nhận (**đang bị từ chối**) |
| 5 | PDF có `/OpenAction` → `/S /JavaScript` | ❌ Từ chối |
| 6 | PDF có JavaScript **nằm trong object stream** | ❌ Từ chối (**đang bị chấp nhận**) |
| 7 | PDF có `/S /Launch` | ❌ Từ chối |
| 8 | PDF có file đính kèm (`/EmbeddedFiles`) | ❌ Từ chối |
| 9 | PDF mã hóa (cần mật khẩu) | ❌ Từ chối |
| 10 | File `.pdf` nhưng nội dung là ảnh PNG / văn bản | ❌ Từ chối |
| 11 | PDF bị cắt cụt (thiếu `%%EOF`) | ❌ Từ chối |
| 12 | Quá giới hạn dung lượng (`MAX_CV_FILE_SIZE_MB`, mặc định 10) | ❌ Từ chối |
| 13 | Tagged PDF có `/StructElem /A` là thuộc tính accessibility | ✅ Chấp nhận |
| 14 | Page resource graph lớn hơn node budget | ✅ Chấp nhận vì tài nguyên hiển thị không phải action graph |
| 15 | Portfolio/GitHub/email/phone dùng scheme phổ biến | ✅ Chấp nhận |
| 16 | URI dùng scheme chủ động hoặc truy cập file local | ❌ Từ chối |
| 17 | Associated file `/AF` nằm trong structure tree | ❌ Từ chối bằng lượt quét cấu trúc riêng |

**Kiểm tra trên CV thật:** đã chạy lại validator trên bộ 32 CV private; kết quả **32/32 nộp được**. Bộ CV có dữ liệu cá nhân nên không commit vào repo.

---

## 5. Cách tái hiện lỗi trên phiên bản cũ

1. Đăng nhập tài khoản Candidate demo.
2. Mở một job `CV_APPLICATION` đang `ACTIVE` → Ứng tuyển → chọn tải file CV mới.
3. Chọn một CV xuất từ TopCV, Canva hoặc Word (PDF 1.7).
4. Kết quả trước khi sửa: `400 – "Tài liệu PDF không có trang nội dung hợp lệ."`

Kiểm tra nhanh một file có bị ảnh hưởng không: mở file bằng trình soạn thảo, tìm chuỗi `/ObjStm`. Nếu có `/ObjStm` mà không có `/Type /Page` thì file sẽ bị chặn.

---

## 6. Ngoài phạm vi MF-02 (để biết)

- Bộ đọc CV phía AI (`ai-service` v1) cũng gặp vấn đề với PDF có **trang dạng ảnh** (trang không có lớp chữ). Phía MF-03 đang xử lý, không liên quan tới lỗi này.
