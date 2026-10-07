# HRConnect-FE

React 18 + Vite + TypeScript. Gọi backend `HRConnect.Presentation` qua `src/services/apiClient.ts`.

## Chạy ở máy

1. Chạy backend: `dotnet run --project HRConnect/HRConnect.Presentation` (mặc định `http://localhost:5041`).
2. Chạy frontend:

   ```bash
   cd HRConnect-FE
   npm ci
   npm run dev
   ```

3. Mở `http://localhost:5173`.

Không cần file `.env` khi chạy ở máy: `apiClient` gọi đường dẫn tương đối `/api/v1`, và Vite chuyển tiếp `/api` tới backend (`vite.config.ts`).

## Cấu hình (tùy chọn)

Sao chép `.env.example` thành `.env.local`:

| Biến | Dùng khi |
| --- | --- |
| `VITE_API_PROXY_TARGET` | Backend không chạy ở `http://localhost:5041` (ví dụ profile https `7289`, Docker `8080`) |
| `VITE_API_URL` | Build production, khi frontend và backend khác domain (ví dụ `https://api.example.com/api/v1`) |

## Gọi API

- Luôn gọi qua `apiClient`. Nó tự gắn JWT, và khi gặp `401` sẽ gọi `/auth/refresh-token` một lần rồi gửi lại request. Làm mới thất bại thì phát sự kiện `hrconnect:unauthorized`, `authStore` sẽ đăng xuất.
- Token chỉ đọc/ghi qua `src/services/authTokenStorage.ts`.
- Hiển thị lỗi bằng `getApiErrorMessage(err)`; thông điệp `message` từ backend luôn được ưu tiên.
