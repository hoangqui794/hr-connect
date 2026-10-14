# MF-02: Kiểm tra PDF đang chặn nhầm 78% CV thật

> **Dành cho:** dev phụ trách MF-02 (tiếp nhận hồ sơ, tải CV).
> **Ngày:** 2026-10-14.
> **Mức độ:** 🔴 **Nghiêm trọng**: phần lớn ứng viên không nộp được CV.
> **Code liên quan:** `HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs` → `ValidatePdfStructure` (thêm ở commit `a7e06bc`, 2026-09-26, "reject malformed and active-content PDF uploads").

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

## 3. Cách sửa đề xuất

Dùng một thư viện **đọc PDF thật** cho .NET (đề xuất **PdfPig** – `UglyToad.PdfPig`, mã nguồn mở, giấy phép Apache-2.0, đọc được object stream) thay cho việc dò chuỗi.

| Kiểm tra | Hiện tại (byte thô) | Đề xuất |
|---|---|---|
| Đúng là PDF | Header `%PDF-1.x/2.x`, `%%EOF`, `startxref` | **Giữ nguyên** (rẻ, chặn sớm file rác) |
| Có trang | Dò chuỗi `/Type /Page` | Mở bằng thư viện, `NumberOfPages >= 1`; mở lỗi → "PDF bị hỏng" |
| Mã hóa | Dò `/Encrypt` | Kiểm tra trailer có khóa `/Encrypt` qua thư viện (hoặc mở thất bại vì cần mật khẩu) |
| JavaScript / Launch | Dò `/JS`, `/JavaScript`, `/Launch` trong toàn file | Duyệt **các đối tượng đã giải nén**: chặn dictionary có `/S /JavaScript`, `/S /Launch`, hoặc khóa `/JS` thật; chặn `/Names` → `/JavaScript` ở Catalog |
| `/OpenAction`, `/AA` | Cấm luôn | **Chỉ chặn khi** action trỏ tới có `/S /JavaScript` hoặc `/S /Launch`; cho phép destination (mảng trang / tham chiếu trang) |
| File nhúng | Dò `/EmbeddedFile` | Kiểm tra Catalog `/Names` → `/EmbeddedFiles` và annotation `/FileAttachment` |
| `/RichMedia` | Dò chuỗi | Kiểm tra annotation có `/Subtype /RichMedia` |

**Thông báo lỗi:** giữ đúng thông báo hiện tại cho từng loại lỗi để giao diện không phải sửa.

**Nếu chưa kịp tích hợp thư viện (sửa tạm):**
1. Bỏ hẳn quy tắc `/Type /Page`; số trang sẽ do bộ đọc CV phía AI kiểm tra lại.
2. Bỏ `/OpenAction` khỏi danh sách cấm.
3. Chỉ chặn `/JS` khi đứng sau một khóa dictionary (ví dụ `/S /JavaScript /JS`), không chặn khi gặp ở byte ngẫu nhiên.

Ghi rõ đây là **sửa tạm**, vì nó vẫn không thấy được nội dung trong object stream (mục 2.3).

---

## 4. Test cần thêm

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

**Kiểm tra trên CV thật:** chạy lại script kiểm tra trên bộ 32 CV mẫu (nhờ Quí gửi; bộ CV có dữ liệu cá nhân nên **không commit vào repo**). Kỳ vọng sau khi sửa: **32/32 nộp được**.

---

## 5. Cách tái hiện lỗi

1. Đăng nhập tài khoản Candidate demo.
2. Mở một job `CV_APPLICATION` đang `ACTIVE` → Ứng tuyển → chọn tải file CV mới.
3. Chọn một CV xuất từ TopCV, Canva hoặc Word (PDF 1.7).
4. Kết quả hiện tại: `400 – "Tài liệu PDF không có trang nội dung hợp lệ."`

Kiểm tra nhanh một file có bị ảnh hưởng không: mở file bằng trình soạn thảo, tìm chuỗi `/ObjStm`. Nếu có `/ObjStm` mà không có `/Type /Page` thì file sẽ bị chặn.

---

## 6. Ngoài phạm vi MF-02 (để biết)

- Bộ đọc CV phía AI (`ai-service` v1) cũng gặp vấn đề với PDF có **trang dạng ảnh** (trang không có lớp chữ). Phía MF-03 đang xử lý, không liên quan tới lỗi này.
