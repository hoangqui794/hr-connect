# Affiliate Portal Design QA

## Phạm vi

- Mẫu đối chiếu: `C:\Users\Admin\.codex\generated_images\01a0d93e-4da0-76b2-8ef3-f1e8b8ec7bab\exec-19c4786c-fe1b-4b8a-b3c0-4f9bd2e6a712.png`
- Môi trường kiểm tra: web desktop, khung nhìn 1268 × 714.
- Màn hình: Tổng quan, Giới thiệu ứng viên, Lượt giới thiệu, Hoa hồng & chi trả.
- Mobile không thuộc phạm vi vòng chỉnh sửa này theo yêu cầu của người dùng.

## Vòng 1 — phát hiện và sửa sai khác

| Mức độ | Phát hiện | Cách xử lý |
| --- | --- | --- |
| P0 | Không có lỗi chặn thao tác chính. | Không áp dụng. |
| P1 | Tổng quan chưa có bố cục vận hành giống mẫu: KPI, việc cần xử lý, tiến độ và cơ hội nổi bật chưa rõ thứ bậc. | Thiết kế lại toàn bộ lưới dashboard, đưa số liệu và việc cần xử lý lên trước. |
| P1 | Trang giới thiệu ứng viên dùng trường chọn việc khó quét nhanh, khác mẫu danh sách công việc. | Thay bằng ô tìm kiếm và danh sách radio dạng thẻ; giữ khối hướng dẫn và hành động ở cột phải. |
| P1 | Trang hoa hồng thiếu cấu trúc tổng quan tài chính và lịch chi trả. | Bổ sung tab, ba KPI, biểu đồ theo tháng, lịch chi trả và tài khoản nhận tiền. |
| P2 | Sidebar, khoảng cách, chiều cao hàng và thẻ dữ liệu còn quá rộng so với mẫu. | Thu gọn sidebar, topbar, padding, bảng và các thẻ để tăng mật độ thông tin. |
| P2 | Một số nhãn trạng thái còn thiên về mã hệ thống. | Chuẩn hóa nhãn tiếng Việt theo ý nghĩa người dùng. |

## Vòng 2 — kiểm tra kết quả

- Bố cục bốn màn hình đã đồng nhất với ngôn ngữ thiết kế của mẫu: sidebar xanh đậm, trạng thái tím, nền sáng, thẻ trắng và mật độ dữ liệu cao.
- Các thao tác chính vẫn hiển thị rõ: chọn cơ hội, gửi yêu cầu xác nhận, lọc lượt giới thiệu, làm mới dữ liệu và khai báo tài khoản nhận tiền.
- Trạng thái có nhãn tiếng Việt, màu và vị trí nhất quán.
- Dữ liệu hiển thị lấy từ API hiện có; không thêm số liệu giả để làm đẹp giao diện.
- Kiểm tra trực tiếp trên trình duyệt không phát hiện lỗi hiển thị chặn thao tác. Lỗi kết nối thông báo thời gian thực `401` đến từ phiên đăng nhập cục bộ, không thuộc thay đổi giao diện và không làm gián đoạn dữ liệu các trang đã kiểm tra.

final result: passed
