# GitNexus Engineering Plan

> Task: Thay bộ kiểm tra PDF bằng dò byte thô của MF02 bằng kiểm tra cấu trúc dựa trên PdfPig, giảm chặn nhầm CV thật nhưng vẫn chặn nội dung chủ động và PDF nguy hiểm trước khi upload.
> Evidence verified at commit `f886cb2ed44841ac8631780e930ca621d17dbc8c`; GitNexus index ở commit `97a444c8e8cfe52674a2a0e89400ec9059268228` (chậm 28 commit). Đã thử làm mới đúng một lần bằng `node .gitnexus/run.cjs analyze --index-only --pdg` nhưng worker thất bại khi khởi động do áp lực bộ nhớ; mọi kết luận quan trọng bên dưới vì vậy được đối chiếu lại từ source hiện tại.
> Evidence provenance schema 2 không thể tạo trên máy Windows hiện tại vì helper chính thức từ chối nền tảng không có Linux `/proc/self/fd` hoặc macOS `O_DIRECTORY/O_NOFOLLOW`. Theo chỉ dẫn trước đó của người dùng, kế hoạch được ghi trực tiếp vào `docs/plans`; hạn chế này được giữ rõ trong §12.

## 1. Objective

Thay `CvStorageService.ValidatePdfStructure` đang đọc toàn bộ byte PDF thành chuỗi Latin-1 bằng một bộ kiểm tra PDF độc lập sử dụng package chính thức `PdfPig` phiên bản cố định `0.1.16`.

Kết quả cần đạt:

- [verified] Cả ba đường tải file PDF của MF02 dùng cùng một chính sách: tải vào kho CV cá nhân, Candidate tải file mới khi ứng tuyển và Affiliate tải CV cho Candidate.
- [verified] PDF 1.5+ dùng object stream, `/OpenAction` chỉ trỏ tới trang và byte `/JS` tình cờ trong stream nén không còn bị chặn nhầm.
- [inferred] File có JavaScript/Launch hoặc action chủ động nguy hiểm, file nhúng, RichMedia, mã hóa, không có trang hay bị hỏng vẫn bị từ chối trước khi ghi R2/database.
- [inferred] Không đổi API request/response thành công, database, Swagger hoặc FE; lỗi đầu vào vẫn là HTTP 400 với thông báo tiếng Việt ổn định.
- [verified] Không đưa OCR vào MF02. CV dạng ảnh vẫn được tiếp nhận; việc OCR/chấm điểm thuộc MF03.

## 2. Current Behaviour

- [verified] `UploadCvPdfAsync` và `UploadAffiliateCvPdfAsync` cùng đi vào `UploadCvPdfCoreAsync`, và method này gọi `ReadAndValidatePdfAsync` trước mọi upload R2 hay ghi metadata (`HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs:40-88`, `:214-255`).
- [verified] `ReadAndValidatePdfAsync` đã kiểm tra stream rỗng, đuôi `.pdf`, dung lượng khai báo, giới hạn 10 MB, kích thước thực tế và giữ đúng bytes sẽ upload (`CvStorageService.cs:460-520`). Các kiểm tra này đúng và cần giữ.
- [verified] `ValidatePdfStructure` tự đọc header, `%%EOF`, `startxref`, offset xref, tìm chuỗi `/Type /Page`, sau đó cấm các tên `/Encrypt`, `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/OpenAction`, `/AA` trong toàn byte file (`CvStorageService.cs:522-614`).
- [verified] Quy tắc `/Type /Page` không đọc được page dictionary nằm trong object stream; tài liệu điều tra và phép tái hiện độc lập trên bộ 32 CV private đều cho kết quả 7 file được nhận, 25 file bị chặn vì không có token trang ở dạng byte thô (`HRConnect/docs/MF02/mf02-loi-kiem-tra-pdf-chan-nham-cv.md:18-54`).
- [verified] Cấm tên token trong toàn file vừa chặn nhầm `/OpenAction` hợp lệ và `/JS` tình cờ trong dữ liệu nén, vừa không phát hiện chắc chắn action độc nằm trong object stream (`mf02-loi-kiem-tra-pdf-chan-nham-cv.md:56-82`).
- [verified] Test hiện tại còn mã hóa giả định sai: bất kỳ `/OpenAction` nào cũng phải bị từ chối (`HRConnect/HRConnect.UnitTests/Services/Storage/CvStorageServiceTests.cs:243-254`).

## 3. Relevant Architecture

- [verified] `ICvStorageService` là contract Application dùng cho upload, download, adopt và delete CV; thay đổi này không cần sửa chữ ký contract (`HRConnect/HRConnect.Application/Common/Interfaces/ICvStorageService.cs:5-69`).
- [verified] Ba caller upload file là:
  1. `UploadCvCommandHandler` cho kho CV cá nhân (`UploadCvCommandHandler.cs:48-55`).
  2. `ApplyJobCommandHandler` khi Candidate chọn file mới (`ApplyJobCommandHandler.cs:133-155`).
  3. `SubmitCandidateCommandHandler` khi Affiliate nộp file (`SubmitCandidateCommandHandler.cs:428-438`).
- [verified] `CvStorageService` được đăng ký scoped qua DI; cấu hình R2 được bind một lần và có thể nhận biến môi trường (`HRConnect/HRConnect.Infrastructure/DependencyInjection.cs:130-173`).
- [verified] `R2Settings` hiện có giới hạn dung lượng nhưng chưa có giới hạn số trang (`HRConnect/HRConnect.Application/Common/Models/R2Settings.cs:3-29`).
- [verified] Infrastructure chạy .NET 8 và chưa tham chiếu thư viện đọc PDF (`HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj:1-39`).
- [verified] CI chuẩn của repo restore, build Release rồi chạy toàn bộ solution tests (`.github/workflows/ci-cd.yml:54-61`).
- [verified] Package NuGet `PdfPig` 0.1.16 hỗ trợ `net8.0`, mở PDF từ bytes/stream, đọc `NumberOfPages`, tokenized `Structure`, annotations và embedded files. Vì package còn dưới 1.0 và README cảnh báo minor version có thể đổi public API, phải pin chính xác `0.1.16`.

## 4. GitNexus Findings

- [graph] `query(search_query="CV PDF upload validation storage candidate affiliate apply", repo="hr-connect")` tìm thấy `ICvStorageService` và vùng storage nhưng process mapping yếu trên index cũ; kết quả không được dùng làm bằng chứng duy nhất.
- [graph] `context(name="CvStorageService", file_path="HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs", repo="hr-connect")` xác định class tại lines 15-615 và các method upload/validate trung tâm.
- [graph] `impact(target="CvStorageService", direction="upstream", maxDepth=3, repo="hr-connect")` báo LOW với một direct dependent là constructor test. Kết quả này là lower-confidence vì DI/interface dispatch không nối được ba handler; source search hiện tại đã xác nhận đủ ba caller ở §3.
- [graph] `context(name="ICvStorageService", file_path="HRConnect/HRConnect.Application/Common/Interfaces/ICvStorageService.cs", repo="hr-connect")` xác nhận đây là boundary dùng chung, nhưng thay validator bên trong không yêu cầu đổi interface.
- [verified] Blast radius thực tế nằm ở mọi upload file mới; chọn `cvId` có sẵn, download, adopt, delete và MF03 dispatcher không đi qua validator mới và không đổi hành vi.
- [verified] Direct dependent do graph báo là `CvStorageServiceTests`; constructor test phải được cập nhật nếu `CvStorageService` nhận thêm dependency validator.

## 5. Statement-Level PDG Findings

- [graph] `pdg_query(mode="controls", target="ValidatePdfStructure", repo="hr-connect")` neo đúng vùng `CvStorageService.cs:522-587` nhưng trả 0 edge.
- [graph] `pdg_query(mode="flows", target="ReadAndValidatePdfAsync", variable="bytes", repo="hr-connect")` neo đúng vùng `:460-520` nhưng trả 0 edge.
- [graph] `explain(target="CvStorageService", repo="hr-connect")` không có taint finding. Do lần refresh `--pdg` thất bại và index cũ, không được hiểu các kết quả rỗng này là bằng chứng an toàn.
- [verified] Source cho thấy thứ tự bắt buộc: đọc stream có giới hạn → so sánh kích thước thực → kiểm tra PDF → reset position → upload R2 → tạo metadata. Validator mới phải nằm đúng vị trí hiện tại để file bị từ chối không tạo side effect (`CvStorageService.cs:460-519`, `:227-255`).
- [verified] Khi loop đọc stream vượt `MaxCvFileSizeBytes`, method dừng ngay; parser chỉ nhận buffer đã bị chặn kích thước. Không được đưa parser trực tiếp vào stream trước guard này (`CvStorageService.cs:487-505`).
- [inferred] PdfPig parse đồng bộ và không hỗ trợ hủy giữa chừng. Giới hạn bytes, độ sâu token traversal, số object thăm và số trang là lớp kiểm soát tài nguyên; không dùng `Task.Run` vì chỉ chuyển tải CPU sang thread pool.

## 6. Proposed Changes

### 6.1 Dependency và cấu hình

- **File:** `HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj`
  - [inferred] Thêm `<PackageReference Include="PdfPig" Version="0.1.16" />`; không dùng prerelease/custom build và không chép source GitHub vào repository.
- **File:** `HRConnect/HRConnect.Application/Common/Models/R2Settings.cs`
  - [inferred] Thêm `MaxCvPdfPages` với mặc định 30. Đây là giới hạn business đủ rộng cho CV/portfolio nhưng ngăn file hàng nghìn trang đi tiếp.
- **File:** `HRConnect/HRConnect.Infrastructure/DependencyInjection.cs`
  - [inferred] Bind `MAX_CV_PDF_PAGES` khi là số nguyên dương; đăng ký validator stateless dưới dạng singleton/concrete service và inject vào `CvStorageService`.
- **Files:** `.env.example`, `.env.e2e.example`, `HRConnect/.env.example`
  - [inferred] Tài liệu hóa `MAX_CV_PDF_PAGES=30`; không sửa `.env` thật và không đưa secret vào commit.

### 6.2 Bộ kiểm tra PDF riêng

- **New file:** `HRConnect/HRConnect.Infrastructure/Services/Storage/PdfCvValidator.cs`
  - [inferred] Tạo `PdfCvValidator` stateless, nhận bytes đã qua size guard và `R2Settings`.
  - [inferred] Giữ cheap preflight `%PDF-` và marker `%%EOF` để loại file đổi đuôi/cắt cụt sớm. Bỏ việc tự phân tích `startxref`/xref offset vì PdfPig strict parser mới là nguồn sự thật cho classic xref, xref stream và incremental revisions.
  - [inferred] Mở document bằng `PdfDocument.Open` với strict parsing (`UseLenientParsing=false` hoặc API tương đương đã được xác nhận ở package 0.1.16) và `MaxStackDepth` hữu hạn. Mọi parse exception dự kiến được map sang lỗi 400 tiếng Việt; không trả stack trace/parser detail cho client.
  - [inferred] Từ chối document mã hóa/cần password; không thử password rỗng hoặc bypass permission.
  - [inferred] Yêu cầu `1 <= NumberOfPages <= MaxCvPdfPages`.
  - [inferred] Duyệt object graph đã token hóa, không quét raw/decoded stream payload. Traversal phải có `visited` cho indirect references, độ sâu tối đa 32 và tối đa 10.000 object/token nodes; cycle hoặc vượt ngưỡng trả lỗi PDF không an toàn thay vì treo request.
  - [inferred] Chính sách action cho CV thụ động:
    - Cho phép internal destination và action `/S /GoTo` nội bộ.
    - Cho phép `/S /URI` để giữ hyperlink LinkedIn/GitHub/portfolio bình thường.
    - Từ chối `/S /JavaScript`, `/S /Launch`, `/S /GoToR`, `/S /SubmitForm`, `/S /ImportData`, `/S /Rendition`, `/S /Sound`, `/S /Movie` và action type không nằm trong allowlist.
    - `/OpenAction` chỉ hợp lệ khi là destination hoặc internal GoTo; nếu là action dictionary thì áp cùng allowlist.
    - `/AA` không bị chặn chỉ vì tồn tại; từng action con phải được resolve và kiểm tra theo cùng chính sách.
    - `/JS` chỉ có ý nghĩa nguy hiểm trong action JavaScript thực, không phải byte tình cờ trong image/font/content stream.
  - [inferred] Từ chối embedded files qua `document.Advanced.TryGetEmbeddedFiles`, Catalog Names `/EmbeddedFiles` hoặc page annotation `/Subtype /FileAttachment`.
  - [inferred] Từ chối annotation `/Subtype /RichMedia` và action media tương ứng.
  - [inferred] Log structured warning với reason code (`PDF_MALFORMED`, `PDF_ENCRYPTED`, `PDF_PAGE_LIMIT_EXCEEDED`, `PDF_ACTIVE_CONTENT`, `PDF_EMBEDDED_FILE`, `PDF_TRAVERSAL_LIMIT`) nhưng không log bytes, text CV, object graph, email hay tên file đầy đủ.

### 6.3 Tích hợp vào storage

- **File/symbol:** `CvStorageService` constructor, `ReadAndValidatePdfAsync`, `ValidatePdfStructure`, `ContainsPdfName`, `IsPdfTokenDelimiter`.
  - [inferred] Inject `PdfCvValidator` vào constructor.
  - [verified] Giữ nguyên validation stream/name/extension/declared size/actual size và buffer lifecycle trong `ReadAndValidatePdfAsync`.
  - [inferred] Sau khi buffer hoàn tất, gọi validator mới trên exact bytes rồi reset position.
  - [inferred] Xóa ba helper quét byte thô; không để hai bộ policy cùng tồn tại.
  - [inferred] Dùng `BadRequestException(message, errorCode)` với thông báo tiếng Việt ổn định. Nhóm lỗi cấu trúc dùng thông báo “Tài liệu PDF bị hỏng hoặc không hợp lệ.”; mã hóa, quá số trang và nội dung chủ động có message riêng. Response thành công và metadata không đổi.

### 6.4 Test fixtures và regression

- **New file:** `HRConnect/HRConnect.UnitTests/Services/Storage/PdfCvValidatorTests.cs`
  - [inferred] Test chính sách parser/action trực tiếp, tách khỏi R2/repository mocks.
- **New directory:** `HRConnect/HRConnect.UnitTests/TestData/Pdf/`
  - [inferred] Thêm fixture rất nhỏ, không PII, kèm README nêu nguồn/cách tạo và kỳ vọng. Binary fixture chỉ dùng khi test builder không tạo được object stream, encryption hoặc embedded file đáng tin cậy.
- **File:** `CvStorageServiceTests.cs`
  - [inferred] Cập nhật constructor, giữ test integration cho “validate trước upload”. Thay test “mọi OpenAction đều bị chặn” bằng hai nhánh: destination an toàn được nhận và JavaScript/Launch bị chặn.

## 7. Implementation Sequence

1. **Khóa dependency và compile-spike API.** Thêm PdfPig 0.1.16, restore, tạo validator skeleton và xác nhận chính xác API `ParsingOptions`, structure tokens, annotations và embedded files. Nếu API khác với tên dự kiến, điều chỉnh implementation nhưng giữ policy §6.2; không nâng package ngoài 0.1.16 trong cùng thay đổi.
2. **Bổ sung cấu hình tài nguyên.** Thêm `MaxCvPdfPages`, bind env, cập nhật ba template môi trường và unit tests cấu hình nếu có.
3. **Xây parser core.** Thực hiện preflight, strict open, encryption/page checks và mapping exception. Giữ class stateless và dispose `PdfDocument` trong mọi nhánh.
4. **Xây structural security traversal.** Thêm resolver cho dictionary/array/indirect reference, visited set, depth/node budgets; kiểm tra Catalog, Names, OpenAction, AA, annotations, embedded files và RichMedia theo allowlist.
5. **Tích hợp storage.** Inject validator, thay call quét raw bytes, xóa helper cũ. Xác nhận failure xảy ra trước R2/DB cho cả Candidate và Affiliate.
6. **Bổ sung fixtures và test validator.** Bao phủ toàn bộ ma trận §8, đặc biệt object stream hợp lệ và JavaScript trong object stream.
7. **Cập nhật test storage/callers.** Chứng minh cùng validator được dùng cho cả `UploadCvPdfAsync` và `UploadAffiliateCvPdfAsync`, và rejected file không gọi storage/repository/audit.
8. **Verification toàn solution và corpus private.** Restore/build/test Release theo CI; chạy 32 CV local không commit. Nếu CV nào còn bị từ chối, phân loại theo reason code và chỉ sửa khi đó là false positive; không làm yếu policy để đạt con số hình thức.
9. **GitNexus gate trước commit.** Chạy `detect_changes(scope="all")`; vì index hiện stale, kết quả UNKNOWN/partial phải được bổ sung bằng `rg` caller check và review diff. Không commit `CV/` hoặc fixture chứa dữ liệu thật.

## 8. Test Strategy

### 8.1 Validator tests

Trong `PdfCvValidatorTests.cs`, bắt buộc có các scenario input → action → outcome:

1. PDF 1.4 classic xref, một trang → accept.
2. PDF 1.7 dùng `/ObjStm` và xref stream, hai trang → accept.
3. `/OpenAction [page /Fit]` → accept.
4. Stream nén có bytes `/JS` nhưng không phải token action → accept.
5. Link annotation `/S /URI` tới HTTPS → accept.
6. Internal `/S /GoTo` → accept.
7. `/OpenAction` resolve tới `/S /JavaScript` → reject `PDF_ACTIVE_CONTENT`.
8. JavaScript nằm trong object stream → reject `PDF_ACTIVE_CONTENT`.
9. `/S /Launch` → reject.
10. `/S /GoToR`, `/SubmitForm`, `/ImportData` và unknown action type → reject.
11. `/AA` chỉ có internal GoTo → accept; `/AA` chứa JavaScript → reject.
12. Catalog embedded files → reject `PDF_EMBEDDED_FILE`.
13. FileAttachment annotation → reject.
14. RichMedia annotation/action → reject.
15. PDF password-encrypted → reject `PDF_ENCRYPTED`.
16. Zero-page hoặc vượt 30 trang → reject đúng code.
17. Cycle indirect references không treo; visited set kết thúc có kiểm soát.
18. Vượt traversal depth/node budget → reject `PDF_TRAVERSAL_LIMIT`.
19. File `.pdf` thực chất PNG/text → reject malformed.
20. PDF thiếu `%%EOF`, xref hỏng hoặc bị cắt → reject malformed.

### 8.2 Storage regression tests

Trong `CvStorageServiceTests.cs`:

- Giữ test extension, size limit, declared/actual mismatch và fake PDF.
- Candidate personal upload hợp lệ vẫn upload một lần, ghi metadata/audit như cũ.
- Affiliate upload hợp lệ vẫn giữ provenance, `PENDING_CONSENT`, không tự SaveChanges như contract hiện tại.
- Validator reject ở cả hai public upload methods → `IFileStorageService.UploadAsync`, repository add, audit và SaveChanges đều không được gọi.
- Safe OpenAction/object-stream fixture đi hết đường upload.
- Active-content fixture bị chặn trước R2.

### 8.3 Verification commands

Các command tồn tại và khớp CI:

```powershell
dotnet restore HRConnect/HRConnect.sln
dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore
dotnet test HRConnect/HRConnect.sln --configuration Release --no-build --verbosity normal
```

Chạy tập trung khi phát triển:

```powershell
dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --configuration Release --filter "FullyQualifiedName~PdfCvValidatorTests|FullyQualifiedName~CvStorageServiceTests"
```

Manual/private corpus gate:

- Chạy validator trên 32 PDF trong `CV/` mà không upload, không ghi log filename và không commit file.
- Kỳ vọng business: mọi CV lành mạnh được nhận. Mục tiêu hiện tại là 32/32, nhưng file nào thực sự mã hóa hoặc có feature bị policy cấm phải được báo riêng chứ không ép accept.
- Với ít nhất một file được nhận, test thủ công cả kho CV cá nhân, Candidate apply và Affiliate submission để xác nhận cùng response/status cũ.

## 9. Risk and Impact Analysis

- **DI/interface-dispatch blind spot — medium.** [verified] Graph chỉ thấy constructor test nhưng source có ba handler upload. Cần giữ `ICvStorageService` không đổi và test cả hai public upload entry points.
- **Parser dependency dưới 1.0 — medium.** [verified] PdfPig cảnh báo public API có thể đổi theo minor version. Pin `0.1.16`; không dùng floating range; Dependabot update sau này phải có fixture regression.
- **False negative security traversal — high.** [inferred] Chỉ kiểm tra Catalog sẽ bỏ sót action ở annotation hoặc object gián tiếp. Traversal phải resolve indirect references, Names trees và page annotations, có test action trong object stream.
- **False positive policy — high.** [verified] Đây chính là lỗi hiện tại. Không quét raw bytes/stream payload; cho phép URI, internal GoTo và destination hợp lệ.
- **CPU/memory abuse — medium.** [inferred] File 10 MB có thể có cấu trúc phức tạp. Giữ size guard trước parser; đặt parser stack, traversal node/depth và page limits. Không test bằng timeout giòn; dùng fixture bounded-complexity và theo dõi duration qua logs/metrics sau deploy.
- **Exception leakage/500 — medium.** [inferred] PdfPig có nhiều exception parse. Bắt các exception dự kiến ở boundary validator và map 400; unexpected exception vẫn log server-side và đi theo middleware 500, không nuốt lỗi lập trình.
- **Cancellation limitation — low/medium.** [inferred] Parse đồng bộ không hủy giữa chừng; không gọi parser nếu request đã cancellation trước parse, nhưng không giả định có thể dừng giữa parse.
- **No database/API migration — low.** [verified] Dữ liệu và contract upload không đổi; rollback là revert code/package/config page limit, không cần rollback schema.
- **Direct dependent accounting.** [graph] Direct dependent duy nhất graph báo là `CvStorageServiceTests`; đã được đưa vào §6.4/§8. Source-confirmed callers `UploadCvCommandHandler`, `ApplyJobCommandHandler`, `SubmitCandidateCommandHandler` không đổi code nhưng được bao phủ bởi contract/storage regression.
- **MF03 independence.** [verified] Validator chỉ quyết định file có được lưu; không OCR, không chấm điểm và không thay retry/outbox MF03.

## 10. Files Expected to Change

| File | Symbols | Reason |
|---|---|---|
| `HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj` | PackageReference | Pin PdfPig 0.1.16 |
| `HRConnect/HRConnect.Application/Common/Models/R2Settings.cs` | `R2Settings` | Thêm giới hạn số trang |
| `HRConnect/HRConnect.Infrastructure/DependencyInjection.cs` | service registration / env binding | Bind page limit và đăng ký validator |
| `.env.example` | `MAX_CV_PDF_PAGES` | Template môi trường root |
| `.env.e2e.example` | `MAX_CV_PDF_PAGES` | Template E2E |
| `HRConnect/.env.example` | `MAX_CV_PDF_PAGES` | Template backend |
| `HRConnect/HRConnect.Infrastructure/Services/Storage/PdfCvValidator.cs` | new `PdfCvValidator` | Parse và kiểm tra security policy |
| `HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs` | constructor, `ReadAndValidatePdfAsync`; remove raw helpers | Dùng validator trước upload |
| `HRConnect/HRConnect.UnitTests/Services/Storage/PdfCvValidatorTests.cs` | new test class | Ma trận parser/security |
| `HRConnect/HRConnect.UnitTests/Services/Storage/CvStorageServiceTests.cs` | constructor and upload tests | Regression integration/storage side effects |
| `HRConnect/HRConnect.UnitTests/TestData/Pdf/*` | sanitized fixtures + README | Object stream, action, encryption, embedded fixtures |

Không dự kiến sửa `ICvStorageService`, endpoint, Swagger, FE, entity, migration hoặc MF03.

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Replace MF02 raw-byte PDF checks with a bounded PdfPig 0.1.16 structural validator shared by all CV file-upload flows."
  acceptance_criteria:
    - "Modern object-stream CV PDFs and safe OpenAction/URI links are accepted."
    - "JavaScript, Launch/unsafe actions, embedded files, RichMedia, encryption, malformed/zero-page/oversized-page documents are rejected before R2/database side effects."
    - "Candidate personal upload, Candidate apply, and Affiliate submission keep existing successful API contracts."
    - "All solution tests pass and the private 32-CV corpus is assessed without being committed or logged."
  evidence_provenance:
    schema_version: 2
    head_commit: "f886cb2ed44841ac8631780e930ca621d17dbc8c"
    generated_plan_path: "docs/plans/2026-10-15-gitnexus-plan-mf02-pdf-validation.md"
    unavailable_reason: "Official evidence-provenance helper refuses win32 because safe descriptor-anchored snapshot/write is unsupported; user previously authorized direct docs/plans output."
    global_dirty_digest: null
    cited_path_manifest: []
  primary_symbols:
    - symbol: "CvStorageService.ReadAndValidatePdfAsync"
      file: "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs"
      lines: "460-520"
      role: "Read and size-bound exact upload bytes before structural validation."
    - symbol: "CvStorageService.ValidatePdfStructure"
      file: "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs"
      lines: "522-587"
      role: "Buggy raw-byte validator to replace."
    - symbol: "CvStorageService.UploadCvPdfCoreAsync"
      file: "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs"
      lines: "214-275"
      role: "Shared pre-R2 integration point for Candidate and Affiliate uploads."
  related_symbols:
    - symbol: "ICvStorageService"
      relationship: "implemented-by"
      relevance: "Public Application contract remains unchanged."
    - symbol: "UploadCvCommandHandler.Handle"
      relationship: "calls UploadCvPdfAsync"
      relevance: "Candidate CV library upload."
    - symbol: "ApplyJobCommandHandler.Handle"
      relationship: "calls UploadCvPdfAsync"
      relevance: "Candidate apply with new file."
    - symbol: "SubmitCandidateCommandHandler.Handle"
      relationship: "calls UploadAffiliateCvPdfAsync"
      relevance: "Affiliate candidate submission."
  execution_path:
    - "Handler supplies stream/name/declared size to ICvStorageService."
    - "CvStorageService checks extension and bounded exact byte count."
    - "PdfCvValidator strict-parses and applies page/action/embedded/encryption/resource policy."
    - "On success, buffer position resets and exact bytes upload to R2."
    - "Metadata/audit/database work occurs only after storage success."
  pdg_constraints:
    - description: "PDG refresh failed; zero-edge controls/flows results are inconclusive. Preserve source-verified validation-before-upload ordering."
      affected_statements:
        - "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs:227-255"
        - "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs:487-513"
      implementation_consequence: "Never parse after R2 upload and never remove the byte-size guard before parser invocation."
  architectural_patterns:
    - pattern: "Central storage service shared by all upload handlers"
      example_location: "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs:40-88"
      usage_guidance: "Integrate once in UploadCvPdfCoreAsync/ReadAndValidatePdfAsync; do not duplicate checks in endpoints."
    - pattern: "Options bound from section plus environment fallback"
      example_location: "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs:130-154"
      usage_guidance: "Add MAX_CV_PDF_PAGES using the existing positive-integer pattern."
  files_to_modify:
    - file: "HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj"
      symbols: ["PackageReference"]
      intended_change: "Pin PdfPig 0.1.16."
    - file: "HRConnect/HRConnect.Infrastructure/Services/Storage/PdfCvValidator.cs"
      symbols: ["PdfCvValidator"]
      intended_change: "New bounded structural validator."
    - file: "HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs"
      symbols: ["CvStorageService", "ReadAndValidatePdfAsync", "ValidatePdfStructure"]
      intended_change: "Inject/call new validator and remove raw token scanning."
    - file: "HRConnect/HRConnect.Application/Common/Models/R2Settings.cs"
      symbols: ["R2Settings"]
      intended_change: "Add MaxCvPdfPages default 30."
    - file: "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs"
      symbols: ["AddInfrastructure"]
      intended_change: "Bind page limit and register validator."
    - file: "HRConnect/HRConnect.UnitTests/Services/Storage/PdfCvValidatorTests.cs"
      symbols: ["PdfCvValidatorTests"]
      intended_change: "Add parser/security matrix."
    - file: "HRConnect/HRConnect.UnitTests/Services/Storage/CvStorageServiceTests.cs"
      symbols: ["CvStorageServiceTests"]
      intended_change: "Update constructor and storage integration regressions."
  tests:
    - file: "HRConnect/HRConnect.UnitTests/Services/Storage/PdfCvValidatorTests.cs"
      scenarios:
        - "classic/object-stream/safe destination/URI -> accept"
        - "JavaScript/Launch/unsafe action -> reject"
        - "embedded/FileAttachment/RichMedia/encrypted -> reject"
        - "malformed/page/traversal limits -> reject deterministically"
    - file: "HRConnect/HRConnect.UnitTests/Services/Storage/CvStorageServiceTests.cs"
      scenarios:
        - "valid candidate and affiliate uploads retain metadata behavior"
        - "validator rejection produces zero R2/database/audit calls"
  verification_commands:
    - "dotnet restore HRConnect/HRConnect.sln"
    - "dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore"
    - "dotnet test HRConnect/HRConnect.sln --configuration Release --no-build --verbosity normal"
    - "dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --configuration Release --filter FullyQualifiedName~PdfCvValidatorTests|FullyQualifiedName~CvStorageServiceTests"
  risks:
    - "Stale GitNexus index misses DI/interface callers; source-confirmed caller list is authoritative."
    - "PdfPig is pre-1.0; exact version and regression fixtures are mandatory."
    - "Recursive PDF references require visited/depth/node bounds."
    - "Do not regress safe URI/internal destination behavior."
  assumptions:
    - "PdfPig 0.1.16 low-level tokens expose enough structure to resolve Catalog/Names/actions/annotations; verify exact API by compile in sequence step 1."
    - "Default MaxCvPdfPages=30 is acceptable for HR Connect CV business; verify against private corpus before release."
    - "Private CV/ contains only manual verification data and remains untracked/uncommitted."
  open_questions: []
  avoid:
    - "Do not scan raw or decoded stream bytes for PDF names."
    - "Do not blanket-ban OpenAction, AA, URI, or internal GoTo."
    - "Do not upload to R2 or write database state before validation succeeds."
    - "Do not add OCR/PaddleOCR or modify MF03."
    - "Do not commit private CV files, filenames, extracted text, secrets, or local .env."
    - "Do not upgrade beyond PdfPig 0.1.16 in this change."
```

## 12. Assumptions and Open Questions

### Assumptions to re-verify at implementation start

1. [assumed] PdfPig 0.1.16 exposes the low-level token/annotation APIs required by the traversal. Verification: restore exact package, compile a minimal validator test against `PdfDocument.Structure`, `GetObject`, `page.GetAnnotations()` and `Advanced.TryGetEmbeddedFiles` before writing full policy.
2. [assumed] `MaxCvPdfPages=30` does not reject legitimate HR Connect CV/portfolio use cases. Verification: record maximum page count across the private 32-CV corpus and adjust only with a documented business reason.
3. [assumed] URI hyperlinks are required and safe enough to retain. The validator does not fetch or resolve the URI; it only allows the action type. URL reputation scanning is explicitly deferred.
4. [assumed] The private `CV/` directory remains local-only. Verification: `git status --short` before commit must show none of its children staged.

### Evidence limitations

- GitNexus index is 28 commits behind. The only allowed refresh attempt failed; no second refresh should be attempted in this planning session.
- PDG/taint outputs are inconclusive, so implementation ordering and caller scope come from current source reads.
- The official evidence helper refuses Windows; global dirty digest and cited manifest are unavailable. The only observed untracked repository content before writing this plan was the private `CV/` directory.

### Explicitly deferred

- OCR cho scanned/image-only CV, PaddleOCR và cải thiện text extraction thuộc MF03.
- Antivirus/CDR sandbox, URL reputation scanning và asynchronous malware pipeline có thể là lớp defense-in-depth sau này; không cần để sửa false-positive hiện tại.
- Metrics dashboard cho PDF rejection reason có thể thêm sau khi log reason codes đã ổn định; không mở rộng API response trong thay đổi này.

## 13. Definition of Done

- `PdfPig` được pin đúng `0.1.16`; restore/build .NET 8 thành công.
- `CvStorageService` không còn `Encoding.Latin1`/raw token scan cho `/Type /Page`, `/JS`, `/OpenAction` hoặc các feature khác.
- Một validator riêng strict-parse exact upload bytes và enforce size-before-parse, encryption, page, action allowlist, embedded/RichMedia và traversal budgets.
- Ba đường upload file của MF02 dùng chung validator qua storage service; chọn CV có sẵn không bị parse lại.
- File bị từ chối không tạo R2 object, CandidateCv metadata, audit entry hoặc transaction side effect.
- Toàn bộ scenario §8 có test; fixture không có dữ liệu cá nhân và nguồn/cách tạo được ghi lại.
- Full Release restore/build/test theo CI đều pass.
- Bộ 32 CV private được chạy aggregate; CV lành mạnh không còn bị chặn vì object stream/OpenAction destination/random `/JS`, và không file nào được commit/log chi tiết.
- `detect_changes(scope="all")` được chạy trước commit; mọi UNKNOWN do stale graph được đối chiếu bằng source diff/caller search.
- Không có thay đổi DB migration, Swagger, FE, MF03, OCR hay contract `ICvStorageService`.
