# CI/CD triển khai HR Connect trên Cloud Server

## 1. Phạm vi

Pipeline production gồm hai workflow độc lập:

| Workflow | File | Nhiệm vụ |
|---|---|---|
| CI — Quality Gates | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Kiểm tra Backend, Frontend, AI v2, Dockerfile và script triển khai. |
| CD — Cloud Server | [`.github/workflows/deploy-cloud.yml`](../../.github/workflows/deploy-cloud.yml) | Build image Backend và AI v2 trên GitHub, đẩy lên GHCR rồi triển khai đúng commit lên Cloud Server. |

Frontend vẫn được Vercel triển khai riêng. Render không còn nằm trong kiến trúc triển khai của dự án.

## 2. Luồng production

```text
Dev push feature/*, fix/* hoặc dev
              │
              ▼
       CI — Quality Gates
       (không deploy production)

Merge commit đã duyệt vào main
              │
              ▼
       CI — Quality Gates
              │
      lỗi ─────┴───── đạt
      dừng             │
                       ▼
              CD — Cloud Server
              ├─ build Backend image trên GitHub
              ├─ build AI v2 image trên GitHub
              ├─ push GHCR tag sha-<40 ký tự>
              ├─ SSH bằng deploy key
              ├─ server pull image, không build source
              ├─ migrate database một lần
              ├─ dựng màu không hoạt động (blue hoặc green)
              ├─ kiểm tra health trực tiếp
              ├─ chuyển Caddy sang màu mới
              ├─ kiểm tra lại qua HTTPS công khai
              └─ lỗi thì giữ/khôi phục màu cũ
```

`concurrency: cloud-production` bảo đảm chỉ một lượt production được triển khai tại một thời điểm. Image dùng tag commit SHA bất biến, không dùng `latest` để quyết định bản chạy.

## 3. Dữ liệu production trên server

Các file secrets không được đưa lên GitHub:

```text
/opt/hrconnect/deploy/
├── env/
│   ├── backend.env       # chmod 600
│   └── ai-v2.env         # chmod 600
├── caddy/
│   ├── Caddyfile
│   └── active-upstreams.caddy
├── data/
│   └── ai-v2/            # hàng đợi AI bền vững cho blue/green
├── state/
│   ├── active-color      # blue hoặc green
│   └── deploy.lock       # chặn hai lượt deploy đồng thời
├── releases/
│   └── <commit-sha>/     # compose + Caddyfile + release.env + deploy script
├── current -> releases/<commit-sha>
└── previous -> releases/<commit-sha>
```

Workflow chỉ tải manifest triển khai và image. Nó không đọc, ghi hoặc đưa nội dung hai file `.env` vào log.

## 4. Chuẩn bị tài khoản triển khai

Máy chủ hiện có thể dùng tài khoản `hradmin`, với điều kiện tài khoản đó:

1. Đăng nhập được bằng SSH key, không dùng mật khẩu.
2. Có quyền chạy Docker (`docker version` không cần `sudo`).
3. Có quyền ghi dưới `/opt/hrconnect/deploy`.
4. Có `caddy`, `flock` và `curl`.

Nên tạo một SSH key riêng chỉ dành cho GitHub Actions, không dùng private key cá nhân. Public key được thêm vào `/home/hradmin/.ssh/authorized_keys`; private key được lưu trong GitHub Secret.

Tạo trước thư mục và bảo vệ env:

```bash
sudo mkdir -p /opt/hrconnect/deploy/{env,releases,caddy,data,state}
sudo chown -R hradmin:hradmin /opt/hrconnect/deploy
chmod 700 /opt/hrconnect/deploy /opt/hrconnect/deploy/env /opt/hrconnect/deploy/state
chmod 600 /opt/hrconnect/deploy/env/backend.env /opt/hrconnect/deploy/env/ai-v2.env
```

### Thiết lập Caddy một lần

Blue-green chỉ tự chuyển traffic khi Caddy đọc file được pipeline quản lý. Thực hiện một lần trên server:

```bash
sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-hrconnect
sudo mkdir -p /opt/hrconnect/deploy/caddy
sudo chown -R hradmin:hradmin /opt/hrconnect/deploy/caddy
sudo ln -sfn /opt/hrconnect/deploy/caddy/Caddyfile /etc/caddy/Caddyfile
```

Lượt deploy đầu sẽ nạp cấu hình mới bằng `systemctl reload caddy`. Nếu tài khoản deploy chưa được phép chạy riêng lệnh này không cần mật khẩu, quản trị viên cấu hình `sudoers` theo nguyên tắc quyền tối thiểu hoặc reload thủ công ở lần đầu. Các lượt sau dùng Caddy Admin API tại `127.0.0.1:2019`.

## 5. GitHub Secrets bắt buộc

Vào **Repository → Settings → Secrets and variables → Actions**:

| Secret | Giá trị |
|---|---|
| `PROD_SSH_HOST` | IP hoặc hostname Cloud Server. |
| `PROD_SSH_PORT` | Cổng SSH production. |
| `PROD_SSH_USER` | Tài khoản deploy, hiện tại là `hradmin`. |
| `PROD_SSH_PRIVATE_KEY` | Private key riêng của GitHub Actions, không có passphrase tương tác. |
| `PROD_SSH_KNOWN_HOSTS` | Dòng host key đã xác minh của Cloud Server. |

Lấy `known_hosts` từ máy quản trị và đối chiếu fingerprint với server trước khi lưu:

```powershell
ssh-keyscan -p 24700 162.4.176.117
```

Không dùng `StrictHostKeyChecking=no`. Workflow phải dừng nếu host key không khớp.

## 6. GHCR

Workflow sử dụng `GITHUB_TOKEN` ngắn hạn để:

- push hai image từ GitHub runner;
- đăng nhập GHCR tạm thời trên server trước khi pull.

Các package GHCR có thể để private. Workflow cần quyền `packages: write` ở job build và `packages: read` ở job deploy; không cần PAT dài hạn trên server.

Image production:

```text
ghcr.io/hoangqui794/hrconnect-backend:sha-<commit>
ghcr.io/hoangqui794/hrconnect-ai-v2:sha-<commit>
```

## 7. Lần chạy đầu tiên

1. Merge workflow vào `main` sau khi CI đạt.
2. Cấu hình đủ năm GitHub Secrets.
3. Hoàn thành bước liên kết Caddy ở mục 4.
4. Mở **Actions → CD — Cloud Server → Run workflow** trên nhánh `main`.
5. Script chạy migration bằng image Backend mới nhưng chưa đổi traffic.
6. Lần đầu dựng `blue`; lần tiếp theo luân phiên `green` và `blue`.
7. Chỉ khi health trực tiếp và HTTPS công khai đều đạt thì `active-color` và symlink `current` mới được cập nhật.

Endpoint được kiểm tra:

- Blue: Backend `18080`, AI `18001`.
- Green: Backend `28080`, AI `28001`.
- `https://api.hrconnectvn.online/health/live`
- `https://api.hrconnectvn.online/health/ready`
- `https://ai.hrconnectvn.online/health`

Sau lần chạy thủ công thành công, mọi push vào `main` có CI đạt sẽ tự triển khai.

## 8. Rollback

Script [`deploy/scripts/deploy-production.sh`](../../deploy/scripts/deploy-production.sh) rollback khi:

- không pull được image;
- migration lỗi;
- Docker Compose không khởi động được service;
- health trực tiếp không đạt trước khi chuyển traffic;
- health công khai không đạt sau khi chuyển traffic.

Nếu lỗi trước switch, màu đang hoạt động không bị thay đổi. Nếu lỗi sau switch, script khôi phục file upstream Caddy cũ rồi dừng màu mới. GitHub Actions vẫn hiển thị màu đỏ để nhóm điều tra dù production đã được phục hồi. Migration không tự rollback; mọi migration production phải theo chiến lược expand/contract để hai phiên bản có thể chạy trong thời gian chuyển màu.

Kiểm tra màu đang phục vụ:

```bash
cat /opt/hrconnect/deploy/state/active-color
cat /opt/hrconnect/deploy/caddy/active-upstreams.caddy
```

## 9. Theo dõi và xử lý lỗi

| Biểu hiện | Cách kiểm tra |
|---|---|
| CI lỗi | Sửa test/build trước; CD sẽ không chạy. |
| Thiếu SSH secret | Job `Validate production SSH configuration` ghi đúng tên secret còn thiếu. |
| `Host key verification failed` | Cập nhật `PROD_SSH_KNOWN_HOSTS` sau khi xác minh fingerprint thật. |
| GHCR trả `denied` | Kiểm tra quyền Packages của Actions và package thuộc đúng repository owner. |
| Pull image lỗi | Kiểm tra dung lượng ổ đĩa, mạng và trạng thái GHCR. |
| Backend live đạt nhưng ready lỗi | Kiểm tra PostgreSQL và biến môi trường Backend. |
| AI health lỗi | Xem `docker logs hrconnect-ai-v2` và biến môi trường AI v2. |
| Workflow rollback | Xem log health, sau đó kiểm tra `state/active-color`, upstream Caddy, `current` và `previous`. |
| Caddy symlink error | Liên kết `/etc/caddy/Caddyfile` tới file managed như hướng dẫn mục 4. |
| Migration lỗi | Xem log migration; sửa migration theo expand/contract trước khi chạy lại. |

Các lệnh quan sát an toàn:

```bash
color="$(cat /opt/hrconnect/deploy/state/active-color)"
docker compose --project-name "hrconnect-$color" \
  --env-file /opt/hrconnect/deploy/current/release.env \
  -f /opt/hrconnect/deploy/current/compose.prod.yml ps
docker stats --no-stream
df -h /
```

## 10. Bảo vệ production

- Bắt buộc Pull Request và job **CI / Required gate** trước khi merge `main`.
- Chặn force-push và xóa `main`.
- GitHub Environment `production` chỉ cho phép nhánh `main` deploy.
- Không commit `.env`, SSH private key hoặc token.
- Không chạy `git pull` và không build source trên production.
- Không tự động xóa image đang được `current` hoặc `previous` sử dụng.
- Không sửa tay `active-color` hoặc upstream Caddy khi một lượt deploy đang chạy.
- Không dùng migration phá hủy trong cùng release với thay đổi code phụ thuộc schema mới.
- Chỉ nâng cấp hệ điều hành/Docker trong cửa sổ bảo trì riêng.
