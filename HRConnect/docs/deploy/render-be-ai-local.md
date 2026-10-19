# Render: cho backend deploy gọi AI service chạy trên máy (test)

> **Dành cho:** thành viên có quyền sửa service backend trên Render. **Ngày:** 2026-10-16.
> **Mục đích:** test luồng MF-02 → MF-03 có điểm AI thật trên **backend deploy**, trong khi **AI service chạy trên máy** của một thành viên. AI trên Render gói Free (0,1 CPU, 512 MB) không chạy nổi: ngày 16/10 lúc 22:16 Render đã giết instance vì `/health` quá 5 giây không trả lời khi đang chấm CV.
> **Không có key thật trong file này.** Token và URL tunnel gửi riêng qua kênh nhóm.
> **Cách cố định (khuyên dùng):** quick tunnel bên dưới đổi địa chỉ mỗi lần chạy, nên phải sửa Render mỗi lần. Dùng tunnel cố định `https://ai-dev.hrconnectvn.online` theo [`cloudflare-ai-dev-tunnel.md`](cloudflare-ai-dev-tunnel.md) thì chỉ sửa Render **một lần**.

## 1. Vì sao phải sửa backend

AI không do FE gọi. Luồng là:

```
Ứng viên nộp CV (FE) → Backend Render lưu đơn → Backend gọi AI theo MF03_BASE_URL → AI chấm → AI gửi điểm về backend
```

Backend trên Render không nhìn thấy `localhost` của máy thành viên, nên AI trên máy phải được mở ra Internet bằng **Cloudflare quick tunnel**, và backend phải trỏ `MF03_BASE_URL` vào địa chỉ tunnel đó.

```
Backend (Render) ──MF03_BASE_URL──▶ https://<ten>.trycloudflare.com ──tunnel──▶ AI v2 (máy, cổng 8001)
AI v2 (máy)      ──HRCONNECT_BASE_URL──▶ https://hr-connect-0ykm.onrender.com
```

Backend đọc **`MF03_BASE_URL`** và **`HRCONNECT_SERVICE_TOKEN`** (`HRConnect.Infrastructure/DependencyInjection.cs`). Hai biến này **ghi đè** `Mf03Integration__BaseUrl` / `Mf03Integration__ServiceToken`.

## 2. Người chạy AI trên máy làm trước

1. Chạy AI v2 ở cổng 8001, ghi đè 2 biến khi chạy (không cần sửa `ai-service-v2/.env`):

   ```bash
   cd ai-service-v2
   HRCONNECT_BASE_URL=https://hr-connect-0ykm.onrender.com \
   HRCONNECT_SERVICE_TOKEN=<token đang dùng trên backend Render> \
   ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

   `ai-service-v2/.env` phải có `GEMINI_API_KEY`.
2. Mở tunnel:

   ```bash
   cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8001
   ```

   Lấy địa chỉ dạng `https://xxxx.trycloudflare.com` trong output.
3. Kiểm tra: mở `https://xxxx.trycloudflare.com/health` → `{"status":"ok","service":"ai-service-v2"}`.
4. Gửi địa chỉ tunnel cho người sửa Render.

## 3. Người sửa Render làm

Render → service **`hr-connect-0ykm`** (backend) → **Environment**:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `MF03_BASE_URL` | `https://xxxx.trycloudflare.com` (địa chỉ tunnel vừa nhận) | Không có `/` ở cuối. **Chỉ sửa biến này**, các biến khác giữ nguyên |
| `HRCONNECT_SERVICE_TOKEN` | **Không đổi** | Kiểm tra giá trị này **giống hệt** token người chạy AI dùng ở bước 2.1. Khác nhau thì AI báo 401/403 |
| `Mf03Integration__ProcessingTimeoutMinutes` (tùy chọn) | `3` | Backend gửi lại việc chấm sau 3 phút thay vì 15 phút, test nhanh hơn. Xóa khi test xong |

Bấm **Save, rebuild, and deploy** → đợi trạng thái **Live** → mở `https://hr-connect-0ykm.onrender.com/health/ready` thấy `Healthy`.

## 4. Kiểm tra luồng

1. FE: ứng viên nộp CV vào một job `CV_APPLICATION`.
2. Log AI trên máy phải có lần lượt:
   - `POST /api/v1/scoring-jobs` → `202 Accepted` (backend đã gọi tới AI qua tunnel).
   - Sau đó AI gọi về backend lấy JD, CV và gửi kết quả (`/api/v1/internal/...`).
3. Client mở hồ sơ → ô **Đánh giá của AI** có điểm `/100`.

| Gặp | Nguyên nhân | Sửa |
|---|---|---|
| Log AI không có `POST /api/v1/scoring-jobs` | Backend chưa trỏ đúng tunnel, hoặc chưa deploy lại | Kiểm tra `MF03_BASE_URL`, deploy lại backend |
| AI báo `401` / `403` | Token hai bên khác nhau | Chạy lại AI với đúng token của backend |
| `AI_PROVIDER_UNAVAILABLE` | Gemini key sai hoặc hết hạn mức | Kiểm tra `GEMINI_API_KEY` trong `ai-service-v2/.env` |
| Tunnel không mở được | `cloudflared` bị tắt, hoặc máy ngủ | Chạy lại tunnel; địa chỉ sẽ **đổi**, phải cập nhật lại `MF03_BASE_URL` |

## 5. Test xong: trả lại như cũ

1. Render → `hr-connect-0ykm` → Environment:
   - `MF03_BASE_URL=https://hrconnect-ai-service-v2.onrender.com`
   - Xóa `Mf03Integration__ProcessingTimeoutMinutes` nếu đã thêm.
2. **Save, rebuild, and deploy**.
3. Tắt `cloudflared` và AI trên máy.

## 6. Lưu ý

- Máy phải bật, AI và tunnel phải đang chạy trong suốt lúc test. Hồ sơ nộp khi AI tắt không bị mất: backend tự thử lại tối đa 5 lần, sau đó chuyển HR xem tay.
- Trong lúc tunnel mở, AI trên máy công khai trên Internet. Từ 17/10 `/api/v1/scoring-jobs` và `/api/v1/match-file` đều cần token, `/docs` tắt, **miễn là `.env` không bật `ALLOW_UNAUTHENTICATED_TEST_ENDPOINTS`**. Không chia sẻ địa chỉ tunnel ra ngoài nhóm, test xong tắt ngay.
- CV demo sẽ được gửi lên Gemini để chấm.
- Muốn AI chạy ổn định trên Render (không cần máy ai bật) thì phải nâng `hrconnect-ai-service-v2` lên gói **tối thiểu 1 CPU / 2 GB RAM**.

## 7. Việc hạ tầng còn mở (từ buổi test 17/10)

Làm tay trên Render / Cloudflare, không phải code.

| # | Việc | Người làm |
|---|---|---|
| OPS-1 | AI v2 trên Render gói Free (0,1 CPU, 512 MB) không chạy nổi. Nâng `hrconnect-ai-service-v2` lên tối thiểu **1 CPU / 2 GB RAM**. Trong lúc chưa nâng thì dùng AI trên máy qua tunnel (`cloudflare-ai-dev-tunnel.md`). | Người giữ Render |
| OPS-2 | Thêm rule WAF cho `ai-dev.hrconnectvn.online` theo mục 2.1 của `cloudflare-ai-dev-tunnel.md`. AI đã tắt `/docs` và bắt token cho `match-file`, rule WAF là lớp chặn thêm. | Trí |
| OPS-3 | Đổi các key đã lộ qua ảnh chụp, chat: tunnel token `hrconnect-ai-dev`, `HRCONNECT_SERVICE_TOKEN`, Resend API key, R2 access key/secret, mật khẩu Supabase (nếu còn dùng), `JwtSettings__Secret` trên Render. Gemini key đã đổi. Đổi xong cập nhật Render và `.env` từng máy. | Cả nhóm |
| OPS-4 | `SUBMISSION_CONSENT_URL_BASE` trên Render phải là địa chỉ FE thật (`https://<fe>/submission-consent`), không phải `localhost`; nếu sai thì link trong email xác nhận gửi ứng viên không mở được. | Người giữ Render |
| OPS-5 | Khi deploy BE-04: chạy migration `AddContactRequest`, deploy lại AI v2 (endpoint `/api/v1/semantic-match`), đặt `CONTACT_NOTIFY_EMAIL`. | Người deploy |

Chuỗi kết nối: backend đọc `DATABASE_URL` dạng `postgresql://...` (ưu tiên hơn `ConnectionStrings__DefaultConnection`). Khi môi trường không phải Development (hoặc chạy trên Render) mà chuỗi trỏ `localhost` thì backend dừng ngay với thông báo rõ ràng.
