# Cloudflare Tunnel cố định cho AI service chạy trên máy: `ai-dev.hrconnectvn.online`

> **Dành cho:** Trí (đang giữ tài khoản Cloudflare quản lý tên miền `hrconnectvn.online`). **Ngày:** 2026-10-17.
> **Liên quan:** [`render-be-ai-local.md`](render-be-ai-local.md).
> **Không có key thật trong file này.** Tunnel token gửi riêng cho Quí qua tin nhắn, không commit, không dán vào nhóm chung.

## 1. Mục đích

Backend trên Render (`hr-connect-0ykm`) gọi AI service qua biến `MF03_BASE_URL`. AI v2 đang chạy trên **máy Quí** (AI trên Render gói Free không chạy nổi). Hiện đang dùng *quick tunnel* nên **mỗi lần chạy lại, địa chỉ đổi và phải sửa Render**.

Tạo một **tunnel cố định** gắn với `https://ai-dev.hrconnectvn.online`:

```
Backend (Render) ──MF03_BASE_URL──▶ https://ai-dev.hrconnectvn.online ──Cloudflare Tunnel──▶ AI v2 trên máy Quí (http://localhost:8001)
```

Sau khi làm xong:
- `MF03_BASE_URL` trên Render chỉ đặt **một lần**.
- Quí chỉ cần bật AI và chạy 1 lệnh tunnel mỗi lần test; Trí **không** phải làm gì thêm.
- Máy Quí tắt thì backend không gọi được AI, tự thử lại rồi chuyển hồ sơ cho HR xem tay. Không mất dữ liệu.

Tên miền đang dùng nameserver Cloudflare (`carlos.ns.cloudflare.com`, `pam.ns.cloudflare.com`), nên làm được trên dashboard.

## 2. Trí làm trên Cloudflare (khoảng 10 phút)

Dùng **tunnel quản lý trên dashboard** (có token), để Quí không cần quyền vào tài khoản Cloudflare.

1. Vào **Cloudflare dashboard → Zero Trust** (`one.dash.cloudflare.com`). Lần đầu vào Zero Trust có thể phải chọn gói **Free** và đặt tên team, không cần thẻ.
2. **Networks → Tunnels → Create a tunnel** → chọn **Cloudflared** → đặt tên **`hrconnect-ai-dev`** → **Save tunnel**.
3. Màn **Install and run connectors**: copy **tunnel token** (chuỗi dài sau `--token` trong lệnh mẫu). **Gửi riêng token này cho Quí.** Không cần chạy lệnh cài đặt trên máy Trí.
4. Bấm **Next** → tab **Public Hostname** → **Add a public hostname**:

   | Mục | Giá trị |
   |---|---|
   | Subdomain | `ai-dev` |
   | Domain | `hrconnectvn.online` |
   | Path | để trống |
   | Service Type | `HTTP` |
   | URL | `localhost:8001` |

   → **Save hostname**. Cloudflare tự tạo bản ghi DNS `ai-dev` (chỉ **thêm** một bản ghi, không đụng tới email hay bản ghi khác).

### 2.1. Chặn gọi lung tung vào AI (nên làm)

`ai-dev.hrconnectvn.online` là địa chỉ cố định, công khai. Endpoint `/api/v1/scoring-jobs` có token bảo vệ, nhưng **`/api/v1/match-file` và `/docs` thì không**: ai biết địa chỉ có thể gọi và tốn quota Gemini.

Cloudflare dashboard → chọn tên miền `hrconnectvn.online` → **Security → WAF → Custom rules → Create rule**:

- **Rule name:** `ai-dev only scoring and health`
- **Expression** (Edit expression):

  ```
  (http.host eq "ai-dev.hrconnectvn.online" and not http.request.uri.path in {"/health" "/api/v1/scoring-jobs"})
  ```

- **Action:** `Block` → **Deploy**.

Kiểm tra: mở `https://ai-dev.hrconnectvn.online/docs` → bị chặn; `https://ai-dev.hrconnectvn.online/health` → vẫn trả `ok` (khi máy Quí đang chạy AI và tunnel).

### 2.2. Báo lại

Gửi Quí: **tunnel token** (riêng tư) và xác nhận đã tạo hostname `ai-dev.hrconnectvn.online`.

## 3. Quí làm trên máy

Mỗi lần test:

1. Bật AI v2 (cửa sổ terminal 1):

   ```bash
   cd ai-service-v2
   HRCONNECT_BASE_URL=https://hr-connect-0ykm.onrender.com \
   HRCONNECT_SERVICE_TOKEN=<token đang dùng trên backend Render> \
   ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

2. Bật tunnel (cửa sổ terminal 2):

   ```bash
   cloudflared tunnel run --token <tunnel token Trí gửi>
   ```

   Không cần `cloudflared tunnel login`. Để không phải dán token mỗi lần, lưu token vào biến môi trường `TUNNEL_TOKEN` của máy rồi chạy `cloudflared tunnel run`.

3. Kiểm tra: `https://ai-dev.hrconnectvn.online/health` → `{"status":"ok","service":"ai-service-v2"}`.

## 4. Sửa Render một lần duy nhất

Render → **`hr-connect-0ykm`** → **Environment**:

```env
MF03_BASE_URL=https://ai-dev.hrconnectvn.online
```

`HRCONNECT_SERVICE_TOKEN` trên backend phải **giống hệt** token Quí dùng ở bước 3.1. → **Save, rebuild, and deploy**.

Sau bước này, không cần sửa Render nữa, kể cả khi Quí tắt/bật máy.

## 5. Kiểm tra toàn luồng

1. Ứng viên nộp CV vào job `CV_APPLICATION` trên FE.
2. Terminal AI trên máy Quí có `POST /api/v1/scoring-jobs` → `202 Accepted`, sau đó AI gọi về backend.
3. Client mở hồ sơ → ô **Đánh giá của AI** có điểm.

| Gặp | Nguyên nhân | Sửa |
|---|---|---|
| `/health` qua tên miền báo lỗi `1033` / `502` | Tunnel hoặc AI trên máy chưa chạy | Bật lại terminal 1 và 2 |
| Bị chặn `403` khi gọi `/api/v1/scoring-jobs` từ backend | Rule WAF sai đường dẫn | Kiểm tra lại expression ở mục 2.1 |
| AI báo `401` / `403` khi gọi về backend | Token hai bên khác nhau | Chạy lại AI với đúng token của backend |

## 6. Gỡ bỏ khi không dùng nữa

- Zero Trust → Networks → Tunnels → `hrconnect-ai-dev` → **Delete** (bản ghi DNS `ai-dev` xóa kèm, nếu không thì xóa tay trong DNS).
- Xóa rule WAF ở mục 2.1.
- Render: đổi `MF03_BASE_URL` về `https://hrconnect-ai-service-v2.onrender.com` (khi AI trên Render đã nâng gói 1 CPU / 2 GB).
- Lộ tunnel token thì: Tunnels → `hrconnect-ai-dev` → **Refresh token** / tạo lại, gửi token mới cho Quí.
