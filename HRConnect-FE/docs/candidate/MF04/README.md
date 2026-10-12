# MF-04 — Candidate Profile và Recruitment Lifecycle UI

## Chức năng backend hiện đã có

- Candidate Profile/skills/visibility endpoints cơ bản.
- Candidate có thể rút Application với ownership, concurrency và cập nhật Interview/Offer liên quan.
- Candidate scope cho danh sách/detail/history Interview.
- Candidate scope cho danh sách/detail/respond Offer.
- Worker xử lý Offer hết hạn.

## Khoảng trống backend cần hoàn thiện trước khi gắn UI đầy đủ

- Profile contract thật cho dữ liệu nghề nghiệp; bỏ phụ thuộc localStorage.
- Candidate Application detail projection có `concurrencyToken` và `allowedActions`.
- Candidate timeline projection đã lọc dữ liệu nội bộ.
- Signed URL xem đúng CV đã nộp theo Application.
- Notification khi Interview/Offer/Application thay đổi.
- Filter/sort rõ cho Interview sắp tới và Offer cần phản hồi.

BE được sửa endpoint/DTO để đúng business MF-04. Khi chốt, cập nhật contract thật ở đây và service `src/services/api/mf04`; không gửi DTO nội bộ rồi yêu cầu FE tự ẩn field.

## UI cần hoàn thiện

### `/candidate/profile`

- Dữ liệu DB là nguồn sự thật; lỗi save không báo thành công.
- Nhóm thông tin cá nhân, nghề nghiệp, skills, mục tiêu, salary/location/work mode và visibility.
- Email đăng nhập read-only; email identity chuyển sang trang MF-02.
- CV chỉ hiển thị summary/link sang kho MF-02.

### `/candidate/applications/:applicationId`

- Job/Company, status, submitted CV, timeline public, Interview, Offer và Placement.
- Chỉ hiện action backend trả trong `allowedActions`.
- Xử lý token cũ `409` bằng tải snapshot mới.
- Không hiển thị feedback, actor, participant nội bộ, Offer draft hoặc note nội bộ.

## Test UI

1. Profile load/save từ DB và giữ dữ liệu sau refresh.
2. Candidate A không xem/sửa dữ liệu Candidate B.
3. Withdraw/Offer response dùng concurrency hiện tại; token cũ xử lý `409` rõ ràng.
4. Timeline không lộ dữ liệu nội bộ.
5. Interview/Offer chỉ hiện hành động được server cho phép.
6. Signed CV URL ngắn hạn và đúng ownership.
