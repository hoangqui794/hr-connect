# MF-03 Implementation Map

Tài liệu này ghi lại những khu vực và tệp đã được triển khai hoặc tác động để xây dựng MF-03 AI Matching Service. Mục đích là giúp nhóm xác định nhanh phạm vi MF-03 khi review, pull code, xử lý conflict hoặc tiếp tục phát triển.

> Cập nhật ngày 24/09/2026 từ source local trên branch `dev`.
>
> Đây là bản đồ kỹ thuật, không phải tuyên bố rằng MF-03 đã production-ready. Một số thay đổi được liệt kê bên dưới hiện vẫn là thay đổi local chưa commit.

## 1. Ranh giới trách nhiệm

MF-02 chịu trách nhiệm nhận submission, kiểm tra duplicate, lưu CV, tạo `Submission`/`Application` và attribution.

MF-03 chịu trách nhiệm:

- Nhận tác vụ chấm điểm sau khi Application đã được commit.
- Lấy temporary download URL của CV thông qua internal API của HR Connect.
- Tải và đọc PDF/DOCX hoặc OCR CV dạng ảnh.
- Trích xuất dữ liệu CV có cấu trúc.
- Lấy Job Description và Job Requirements.
- So khớp CV với Job và tính điểm thực nghiệm.
- Gửi kết quả hoặc lỗi về HR Connect bằng callback.
- Ghi structured log phục vụ theo dõi; không truy cập trực tiếp PostgreSQL.

MF-03 chỉ cung cấp bằng chứng và điểm hỗ trợ quyết định. AI không tự trả quyết định `SHORTLIST`, `REJECT` hoặc `HIRE`, không đổi trạng thái Application và không tự xác định `MatchTier`.

## 2. AI Service Python

### API

| Tệp | Vai trò |
| --- | --- |
| `app/main.py` | Khởi tạo FastAPI, health/readiness và đăng ký router. |
| `app/api/scoring_jobs.py` | Nhận tác vụ chạy nền từ HR Connect qua `POST /api/v1/scoring-jobs`. |
| `app/api/cv.py` | Upload, parse CV và endpoint `match-file`. |
| `app/api/matching.py` | Matching bằng dữ liệu JSON có cấu trúc. |

### Điều phối xử lý nền

| Tệp | Vai trò |
| --- | --- |
| `app/services/scoring_queue.py` | Quản lý bounded in-process queue và các worker. |
| `app/services/scoring_orchestrator.py` | Điều phối một tác vụ từ lấy CV/JD đến parse, matching và callback. |
| `app/clients/hrconnect_client.py` | Bao đóng toàn bộ HTTP call đến internal API và presigned storage URL. |
| `app/services/scoring_worker.py` | Compatibility shim cho các import cũ; không còn chứa nghiệp vụ. |

Luồng chính:

```text
HR Connect commit Application và AI result PENDING
    -> dispatcher gửi applicationId, cvId, jobId
    -> AI Service xác thực X-Service-Token
    -> lấy temporary CV download URL
    -> tải file CV
    -> đọc text hoặc OCR
    -> trích xuất CV có cấu trúc
    -> lấy JD/requirements
    -> matching và tính điểm
    -> callback COMPLETED hoặc FAILED
    -> HR Connect lưu kết quả và audit
```

### Đọc và phân tích CV

| Tệp | Vai trò |
| --- | --- |
| `app/services/document_parser.py` | Đọc PDF/DOCX, nhận diện layout và giới hạn tài liệu. |
| `app/services/ocr_service.py` | OCR CV dạng ảnh hoặc PDF scan. |
| `app/services/structured_cv_parser.py` | Trích xuất contact, skills, kinh nghiệm, học vấn, chứng chỉ, ngôn ngữ và confidence. |
| `app/services/normalizer.py` | Chuẩn hóa text và tên kỹ năng. |

### Matching và chấm điểm

| Tệp | Vai trò |
| --- | --- |
| `app/services/matching_service.py` | Phối hợp các bước matching. |
| `app/services/requirement_matcher.py` | Matching deterministic cho `MUST_HAVE` và `SHOULD_HAVE`. |
| `app/services/semantic_matcher.py` | Embedding và cosine similarity. |
| `app/services/score_calculator.py` | Tính `MatchScore` từ các trọng số thực nghiệm. |
| `app/services/explanation_service.py` | Sinh giải thích từ bằng chứng quan sát được. |
| `app/core/model_loader.py` | Lazy-load và cache model embedding. |

### Schema và contract

| Tệp | Vai trò |
| --- | --- |
| `app/schemas/scoring_job.py` | Contract tác vụ chạy nền và callback. |
| `app/schemas/cv.py` | Contract kết quả parse CV. |
| `app/schemas/matching_request.py` | Contract request matching JSON. |
| `app/schemas/matching_response.py` | Contract response matching. |

### Cấu hình, log và đóng gói

| Tệp | Vai trò |
| --- | --- |
| `app/core/config.py` | Đọc URL HR Connect, service token, timeout và cấu hình model. |
| `app/core/dependencies.py` | Khởi tạo và cache `DocumentParser`/`SemanticMatcher` dùng chung. |
| `app/core/logging_config.py` | Structured JSON logging và che dữ liệu nhạy cảm. |
| `.env.example` | Danh sách biến môi trường mẫu, không chứa secret thật. |
| `requirements.txt` | Dependency Python. |
| `Dockerfile` | Cấu hình container. |
| `README.md` | Hướng dẫn chạy và contract tích hợp. |

Log không được ghi raw CV, structured CV đầy đủ, presigned URL hoặc service token.

## 3. Backend HR Connect tích hợp với MF-03

### Trigger sau khi submit

| Tệp | Tác động |
| --- | --- |
| `HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs` | Tạo yêu cầu chấm điểm khi Candidate apply thành công. |
| `HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs` | Tạo yêu cầu chấm điểm khi Affiliate submit thành công. |
| `HRConnect.Application/Common/Interfaces/IMf03ScoringTrigger.cs` | Contract và payload trigger MF-03. |
| `HRConnect.Infrastructure/Services/Integration/Mf03ScoringTrigger.cs` | Tạo/cập nhật AI result ở trạng thái chờ xử lý. |
| `HRConnect.Infrastructure/Services/Integration/Mf03ScoringDispatcher.cs` | Gửi tác vụ pending sang AI Service ở background. |

Candidate hoặc Affiliate nhận phản hồi submit thành công mà không phải chờ AI parse và matching xong.

### Internal API và callback

| Tệp | Tác động |
| --- | --- |
| `HRConnect.Presentation/Endpoints/Internal/AiIntegrationEndpoints.cs` | Cấp CV download URL, cấp JD, nhận callback và đọc AI result. |
| `HRConnect.Infrastructure/Authentication/InternalServiceAuthFilter.cs` | Kiểm tra `X-Service-Token`; thiếu token trả 401, sai token trả 403. |
| `HRConnect.Presentation/Swagger/InternalServiceAuthOperationFilter.cs` | Chỉ mô tả security scheme internal service trên Swagger. |

Các internal endpoint chính:

- `GET /api/v1/internal/cvs/{cvId}/download-url`
- `GET /api/v1/internal/jobs/{jobId}/jd`
- `POST /api/v1/internal/ai-results`
- `GET /api/v1/internal/ai-results/{applicationId}`

`SwaggerEndpointTagFilter.cs` và `SwaggerTagOrderDocumentFilter.cs` là tiện ích Swagger dùng chung, không chứa nghiệp vụ MF-03.

### Database, trạng thái và audit

| Tệp | Tác động |
| --- | --- |
| `HRConnect.Domain/Entities/AiMatchResult.cs` | Lưu trạng thái, điểm, kết quả, attempt, model version và lỗi. |
| `HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs` | Cấu hình mapping dữ liệu MF-03 và audit. |
| `HRConnect.Infrastructure/Migrations/20260924124819_AddMf03ObservabilityAudit.cs` | Migration thêm các trường quan sát/audit MF-03. |
| `HRConnect.Infrastructure/Migrations/20260924124819_AddMf03ObservabilityAudit.Designer.cs` | Metadata của migration. |
| `HRConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` | Snapshot schema hiện tại. |

Các sự kiện audit đã dùng:

- `AI_SCORING_REQUESTED`
- `AI_SCORING_RETRY_REQUESTED`
- `AI_SCORING_COMPLETED`
- `AI_SCORING_FAILED`

Callback được xử lý theo hướng idempotent và không cho kết quả `FAILED` đến sau ghi đè một kết quả `COMPLETED`.

## 4. Kiểm thử

### .NET

- `HRConnect.UnitTests/Features/Integration/Mf03ScoringTriggerTests.cs`
- `HRConnect.UnitTests/Endpoints/Internal/AiResultCallbackProcessorTests.cs`
- `HRConnect.UnitTests/Filters/InternalServiceAuthFilterTests.cs`
- `HRConnect.Presentation/HttpTests/Mf03.RealFlowTests.http`
- `HRConnect.Presentation/HttpTests/Mf03.BackgroundScoringTests.http`

### Python

- `tests/test_health.py`
- `tests/test_cv_api.py`
- `tests/test_document_parser.py`
- `tests/test_structured_cv_parser.py`
- `tests/test_matching_api.py`
- `tests/test_requirement_matcher.py`
- `tests/test_semantic_matcher.py`
- `tests/test_scoring_jobs_api.py`
- `tests/test_scoring_worker.py`
- `tests/test_logging.py`
- `tests/fixtures/*.json`

## 5. Cấu hình cần đồng bộ

HR Connect và AI Service phải dùng cùng một giá trị bí mật trong biến:

```text
HRCONNECT_SERVICE_TOKEN
```

AI Service sử dụng thêm:

```text
HRCONNECT_BASE_URL
```

Backend sử dụng URL của AI Service để dispatcher gọi `/api/v1/scoring-jobs`. File `.env` thật và secret không được commit lên Git.

## 6. Những việc tài liệu này không khẳng định

- Chưa khẳng định migration đã được apply vào mọi database.
- Chưa khẳng định model BGE-M3 và OCR đã được benchmark production.
- Trọng số matching vẫn là `EXPERIMENTAL`, chưa phải business rule được phê duyệt.
- Không coi build/test pass là bằng chứng toàn bộ E2E production đã hoàn tất.
- Không coi các file đang thay đổi local là đã tồn tại trên remote cho đến khi được review, commit và push.

## 7. Cách cập nhật tài liệu

Khi thay đổi MF-03:

1. Cập nhật bảng chứa tệp bị tác động.
2. Ghi rõ endpoint hoặc contract đã đổi.
3. Cập nhật test tương ứng.
4. Ghi rõ migration mới và trạng thái apply migration.
5. Không đưa token, mật khẩu, presigned URL hoặc dữ liệu CV thật vào tài liệu.
