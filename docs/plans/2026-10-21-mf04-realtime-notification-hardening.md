# Kế hoạch hoàn thiện realtime notification cho MF04

> Phạm vi: Interview, Offer và các màn Candidate/Client thuộc MF04.
> Trạng thái: Đã triển khai và kiểm thử tại local trên nhánh `codex/mf04-realtime-hardening`; chưa commit, chưa push.
> Mốc đối chiếu: `origin/main` tại commit `182613e` ngày 2026-10-21 (đã pull và áp dụng trước khi chia commit).

## 1. Mục tiêu

Hoàn thiện đường đi của notification MF04 từ lúc backend lưu dữ liệu đến lúc người nhận thấy realtime, bấm đúng màn hình và FE làm mới đúng dữ liệu. Thay đổi phải giữ nguyên nghiệp vụ Interview/Offer hiện có, không sửa MF02, MF03, ScreeningPolicy hoặc quyền theo Service Type.

Kết quả cần đạt:

- Candidate nhận thông báo Interview/Offer trên nền tảng khi có tài khoản.
- Thông báo realtime và danh sách notification từ REST trả cùng một DTO.
- Bấm thông báo mở đúng Application hoặc Interview; không dẫn tới route không tồn tại.
- Client nhận thông báo Candidate phản hồi Offer và được mở đúng hồ sơ cần xử lý.
- FE cập nhật đúng danh sách hồ sơ, chi tiết, timeline và lịch phỏng vấn sau sự kiện realtime.
- SignalR tự phục hồi sau lỗi kết nối ban đầu hoặc sau khi hết chuỗi reconnect mặc định.
- Logout phải dừng retry và không tái sử dụng phiên cũ.
- API polling hiện có tiếp tục làm phương án dự phòng khi SignalR mất kết nối.

## 2. Vấn đề đã xác minh

1. `NotificationDto` ánh xạ Interview tới `/interviews` và Offer tới `/offers`, nhưng FE không có hai route này.
2. Notification Offer có thể gửi cho hai loại người nhận khác nhau. Candidate cần mở Application, còn Client cần mở hồ sơ trong Candidate Workbench; chỉ suy luận từ `RelatedEntityType = OFFER` là không đủ.
3. Notification Offer hết hạn thiếu `applicationId`, nên không thể tạo đường dẫn chính xác tới hồ sơ Candidate.
4. `SignalRNotificationPublisher` tự tạo anonymous payload nên thiếu một số field của DTO REST, gồm `RouteHint` và `ReadAt`.
5. Hook realtime FE invalidation một số query key cũ không tồn tại, vì vậy notification xuất hiện nhưng màn hình MF04 có thể chưa cập nhật dữ liệu.
6. `.withAutomaticReconnect()` không xử lý lần `start()` đầu tiên thất bại và dừng sau chuỗi retry hữu hạn.
7. Tài liệu `main-flows.md` còn ghi FE chưa kết nối realtime, không còn đúng với code hiện tại.

Hai endpoint `/interviews/{id}/candidate-confirm` và `/interviews/{id}/candidate-reschedule-request` không nằm trong phạm vi cần bổ sung. FE hiện tại không còn gọi chúng; Candidate chỉ xem lịch, mở meeting hoặc thêm lịch cá nhân theo luồng hiện hành.

## 3. Phạm vi triển khai theo 6 commit

### Commit 1 — `fix(mf04): resolve candidate notification routes`

Thay đổi backend để notification điều hướng đúng theo người nhận và ngữ cảnh:

- Parse metadata an toàn, không phân biệt hoa thường.
- Cho phép `routeHint` tường minh nhưng chỉ nhận internal path bắt đầu bằng `/`.
- Interview của Candidate mở `/candidate/applications/{applicationId}/interviews/{interviewId}`.
- Offer của Candidate mở `/candidate/applications/{applicationId}`.
- Metadata thiếu hoặc JSON lỗi sẽ về `/candidate/applications` thay vì tạo URL hỏng.
- Bổ sung unit test cho route Interview, Offer và fallback metadata lỗi.

Ước lượng theo diff hiện tại: khoảng **+95/-4 dòng**.

### Commit 2 — `fix(mf04): route client offer-response notifications`

Hoàn thiện metadata cho các notification Offer có ngữ cảnh đặc biệt:

- Candidate phản hồi Offer sẽ gửi Client `routeHint=/client/candidates?open={applicationId}`.
- Offer hết hạn bổ sung `applicationId` để Candidate mở đúng hồ sơ.
- Bổ sung test phân biệt route của Client với route Offer dành cho Candidate.

Ước lượng theo diff hiện tại: khoảng **+34/-1 dòng**.

### Commit 3 — `fix(mf04): unify realtime and REST notification contracts`

Chuẩn hóa payload do SignalR gửi:

- `SignalRNotificationPublisher` dùng trực tiếp `NotificationDto.From(notification)`.
- Payload realtime có cùng `RouteHint`, `ReadAt`, metadata và quy tắc điều hướng như REST API.
- Giữ nguyên `unreadCount` và group theo user.
- Bổ sung test publisher để kiểm tra DTO, route, số chưa đọc và đúng group người nhận.

Ước lượng theo diff hiện tại: khoảng **+69/-12 dòng**.

### Commit 4 — `fix(mf04-fe): refresh canonical candidate queries on realtime events`

Sửa FE để sự kiện realtime cập nhật đúng dữ liệu MF04:

- Parse metadata có kiểm soát.
- Invalidate danh sách Candidate applications.
- Invalidate Application detail và timeline theo `applicationId`.
- Invalidate Interview detail theo `interviewId`.
- Bỏ query key legacy không có consumer trong code hiện tại.
- Bổ sung test cho Interview notification và Offer notification.

Ước lượng theo diff hiện tại: khoảng **+80/-17 dòng**.

### Commit 5 — `fix(mf04-fe): harden SignalR reconnect lifecycle`

Hoàn thiện vòng đời kết nối SignalR:

- Retry cả trường hợp kết nối ban đầu thất bại.
- Khi chuỗi automatic reconnect kết thúc và `onclose` chạy, tạo lại kết nối sau thời gian chờ.
- Lịch chờ: 5 giây, 15 giây, 30 giây, sau đó tối đa 60 giây.
- Chặn callback của connection cũ ghi đè connection mới.
- `stop()` hủy timer và ngăn reconnect sau logout.
- Giữ polling REST làm fallback.
- Bổ sung test cho initial failure, reconnect exhausted và explicit stop.

Ước lượng theo diff hiện tại: khoảng **+88/-3 dòng**.

### Commit 6 — `docs(mf04): document realtime notification delivery`

Cập nhật tài liệu theo code đã xác minh:

- Ghi nhận FE đã kết nối SignalR.
- Ghi nhận cơ chế tự kết nối lại.
- Ghi nhận REST polling vẫn là fallback khi realtime gián đoạn.
- Không tuyên bố hai Candidate action API chưa tồn tại là chức năng đã hỗ trợ.

Ước lượng theo diff hiện tại: khoảng **+1/-1 dòng**.

## 4. Tổng thay đổi dự kiến

Theo code local hiện tại:

| Hạng mục | Số lượng |
| --- | ---: |
| File sửa | 10 |
| File test mới | 1 |
| Dòng thêm | khoảng 367 |
| Dòng xóa | khoảng 38 |
| Commit dự kiến | 6 |

Số dòng là hệ quả của logic và test cần thiết, không thêm code lặp để tăng thống kê đóng góp.

## 5. Kiểm thử bắt buộc

### Backend tập trung MF04

- Notification route resolver.
- SignalR publisher contract.
- Notification push interceptor.
- Candidate phản hồi Offer.
- Offer expiry.

Kết quả local hiện tại: **26/26 test pass**.

### Frontend tập trung MF04

- SignalR service lifecycle.
- Hook invalidation cache.
- Notification bell.
- Application Workbench.
- Candidate Application detail.
- Candidate Interview detail.

Kết quả local hiện tại: **45/45 test pass**.

### Regression toàn repository

- FE production build: **pass**.
- Full backend: **1719/1720 pass**. Test duy nhất lỗi thuộc MF01 real-database integration vì PostgreSQL local thiếu cột `company_size_id`; không phải lỗi MF04.
- Full FE từng có hai lỗi timing khi chạy cả suite; chạy lại đúng hai file: **7/7 pass**. Không có lỗi xác định tái hiện được từ thay đổi MF04.
- `git diff --check`: **pass**.

## 6. Điều kiện hoàn tất và quy trình đưa lên Git

Chỉ thực hiện khi người phụ trách yêu cầu push:

1. Kiểm tra lại working tree và chạy targeted tests.
2. Tạo đủ sáu commit theo thứ tự trên tại nhánh MF04.
3. Push nhánh MF04 và chờ CI/CD pass.
4. Pull `dev`, merge nhánh MF04 vào `dev`, push và chờ CI/CD pass.
5. Chỉ sau khi `dev` pass mới pull `main`, merge `dev` vào `main`, push và chờ CI/CD pass.
6. Nếu CI/CD lỗi, dừng tại nhánh đang lỗi; không tiếp tục promote lên nhánh kế tiếp.

## 7. Ngoài phạm vi

- Không thêm Candidate confirm attendance hoặc Candidate request reschedule API.
- Không đổi trạng thái/phân quyền Interview, Offer hoặc Placement.
- Không sửa quy tắc sàng lọc của MF03.
- Không sửa Submission/Consent của MF02.
- Không sửa lỗi database MF01 hoặc các cảnh báo test FE không liên quan.
- Không tạo notification email mới trong kế hoạch này; delivery account-or-email đã là luồng riêng được đưa lên `main` trước mốc đối chiếu.
