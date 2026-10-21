# CI/CD và triển khai Backend trên Render

## Phạm vi

Pipeline có hai workflow độc lập:

| Workflow | File | Nhiệm vụ |
|---|---|---|
| CI — Quality Gates | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Kiểm tra Backend, Frontend, AI service và Docker image của Backend. |
| CD — Backend on Render | [`.github/workflows/deploy-render.yml`](../../.github/workflows/deploy-render.yml) | Triển khai duy nhất Backend .NET lên Render sau khi CI của `main` đạt. |

Frontend và AI service **không được deploy lên Render bởi pipeline này**. Chúng chỉ tham gia quality gate để một thay đổi gây lỗi tích hợp không đi vào production.

## Luồng triển khai production

```text
push main
   │
   ▼
CI — Quality Gates
   ├─ Backend: restore → build → test + coverage
   ├─ Frontend: npm ci → lint → test → production build
   ├─ AI v2: compile → pytest
   └─ Backend Dockerfile: production image build
   │
   ├─ bất kỳ bước nào lỗi ──> dừng, không deploy
   │
   ▼
CD — Backend on Render
   ├─ yêu cầu Render build đúng commit SHA của main
   ├─ theo dõi trạng thái deploy thật mỗi 20 giây
   ├─ xác minh commit được đánh dấu live chính là commit đã duyệt
   └─ gọi /health/ready đến khi Backend healthy
```

GitHub Environment `production` ghi nhận lịch sử deploy và hiển thị đường dẫn tới Backend. `concurrency: render-production` ngăn hai lần triển khai production chạy đồng thời.

## Cấu hình GitHub bắt buộc

Vào **Repository → Settings → Secrets and variables → Actions**.

### Repository secrets

| Tên | Bắt buộc | Giá trị |
|---|:---:|---|
| `RENDER_API_KEY` | Có | API key tạo trong Render Account Settings. |
| `RENDER_SERVICE_ID` | Có | ID của **Backend service**, bắt đầu bằng `srv-`. Không dùng ID của AI service. |

Workflow sẽ báo lỗi rõ ràng nếu thiếu secret; không âm thầm bỏ qua deploy.

### Repository variables

| Tên | Bắt buộc | Giá trị đề nghị |
|---|:---:|---|
| `RENDER_SERVICE_URL` | Không | `https://hr-connect-0ykm.onrender.com` |
| `RENDER_HEALTHCHECK_URL` | Không | `https://hr-connect-0ykm.onrender.com/health/ready` |

Nếu không khai báo variables, workflow dùng hai địa chỉ trên làm mặc định.

## Cấu hình Render

Backend service phải liên kết đúng repository và có thể checkout commit của nhánh `main`. Nên tắt Auto-Deploy dạng `On Commit` để tránh Render tự tạo một deploy đồng thời với GitHub Actions. GitHub Actions sẽ là nơi duy nhất ra lệnh deploy production sau khi quality gate đạt.

Không đưa API key, service ID hoặc biến môi trường production vào source code hay log workflow.

## Cấu hình bảo vệ trên GitHub

Thiết lập branch protection/ruleset cho `dev` và `main`:

1. Bắt buộc Pull Request trước khi merge.
2. Bắt buộc job **CI / Required gate** thành công.
3. Bắt buộc nhánh cập nhật với branch đích trước khi merge.
4. Chặn force-push và xóa `main`.
5. Với GitHub Environment `production`, giới hạn deployment branch là `main`; có thể thêm required reviewer nếu nhóm muốn duyệt thủ công trước production.

## Cách theo dõi deploy

1. Mở tab **Actions** trên GitHub.
2. Chọn workflow **CD — Backend on Render**.
3. Job hiển thị từng trạng thái Render: `created`, `queued`, `build_in_progress`, `update_in_progress`, `live`.
4. Phần **Job summary** ghi commit, deploy ID, trạng thái cuối, URL Backend và đường dẫn Render dashboard.
5. Chỉ khi đúng commit ở trạng thái `live` và `/health/ready` trả thành công, GitHub mới đánh dấu deployment xanh.

Có thể chạy lại thủ công từ nhánh `main` bằng **Run workflow**. Tùy chọn `clear_cache` chỉ dùng khi cache build Render gặp sự cố; mặc định giữ cache để deploy nhanh hơn.

## Xử lý lỗi thường gặp

| Biểu hiện | Kiểm tra |
|---|---|
| `Missing required GitHub secret RENDER_API_KEY` | Tạo hoặc cập nhật secret `RENDER_API_KEY`. |
| `RENDER_SERVICE_ID must ... begin with srv-` | Secret đang thiếu hoặc không phải ID Backend service. |
| Render build một commit khác | Kiểm tra service Render có liên kết đúng repository và commit còn tồn tại trên `main`. |
| Trạng thái `build_failed` | Mở link Render dashboard trong Job summary để xem build log. |
| Render báo `live` nhưng workflow đỏ | Kiểm tra `/health/ready`, database và biến môi trường của Backend. |
| Workflow CD không chạy | Kiểm tra workflow CI của push `main` có kết luận `success` và job `CI / Required gate` đã đạt. |
