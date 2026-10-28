# HR Connect Candidate UI

<!-- impeccable:design-schema 1 -->

## Direction

Candidate dùng cùng hệ điều hướng công khai với Guest để trải nghiệm không bị đứt đoạn. Sau đăng nhập, thanh điều hướng giữ nguyên cấu trúc và bổ sung đúng các lối vào cần thiết cho Candidate. Bố cục ưu tiên khả năng quét nhanh, hành động rõ và trạng thái tuyển dụng dễ hiểu hơn hiệu ứng trang trí.

## Navigation

- Guest và Candidate dùng chung `Navbar`.
- Không hiển thị mục hoặc mã kỹ thuật “Vai trò”.
- Guest có lối vào việc làm công khai, giải pháp dịch vụ, liên hệ, đăng nhập và đăng ký.
- Candidate có thêm “Phù hợp với bạn”; “Việc làm” dẫn đến danh sách đầy đủ.
- Menu thu gọn dùng tiếng Việt thân thiện, không hiển thị enum như `CANDIDATE`.

## Visual System

- Nền trang: xanh xám rất nhạt; bề mặt chính màu trắng.
- Hành động chính: xanh dương; đề xuất phù hợp có thể dùng điểm nhấn xanh lá.
- Bo góc vừa phải, viền mảnh, bóng nhẹ; tránh phủ bóng tối lên thẻ và nhãn trạng thái.
- Tiêu đề đậm, nội dung phụ xám; khoảng cách theo nhịp 8px.
- Trạng thái luôn có nhãn và biểu tượng, không truyền đạt chỉ bằng màu.

## Job Discovery

- Từ khóa và địa điểm luôn hiển thị.
- Bộ lọc ít dùng nằm trong “Bộ lọc nâng cao”.
- Chỉ hiển thị bộ lọc backend hỗ trợ: hình thức, loại dịch vụ, kinh nghiệm, khoảng lương và sắp xếp.
- Bộ lọc đang áp dụng phải nhìn thấy và xóa riêng hoặc xóa tất cả được.
- Trạng thái bộ lọc được lưu trên URL để tải lại hoặc chia sẻ không mất lựa chọn.

## Applications

- Mỗi đơn là một hàng/thẻ toàn chiều rộng để tiến trình bảy bước đủ chỗ đọc.
- Trạng thái hiện tại đặt ngay dưới thông tin công việc, dùng màu theo ngữ nghĩa.
- Bảy bước nhất quán: Đã nộp, Đang được xem, Được chọn, Phỏng vấn, Chờ offer, Đã nhận offer, Đi làm.
- Hồ sơ bị từ chối hoặc kết thúc phải nổi bật vừa đủ, không phủ lớp tối lên toàn bộ thẻ.

## Accessibility

- Nút biểu tượng có nhãn truy cập.
- Focus bàn phím phải nhìn thấy.
- Nhãn trường nhập luôn tồn tại; không dùng placeholder thay cho label.
- Bố cục không tràn ngang trên web desktop; menu thu gọn vẫn có đủ lối vào quan trọng.
