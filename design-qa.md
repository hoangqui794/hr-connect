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

## Vòng 3 — trạng thái và chi tiết lượt giới thiệu

- Nguồn thị giác: mẫu đối chiếu phía trên và hệ thống giao diện Affiliate đã được duyệt ở vòng 2.
- Implementation: `http://127.0.0.1:5173/affiliate/submissions` và trạng thái chi tiết của hàng đầu tiên; ảnh bằng chứng được chụp trực tiếp trong Codex Browser tại khung nhìn 1268 × 714, device scale 1.
- Trạng thái kiểm tra: dữ liệu thật sau khi tải xong, gồm trạng thái thành công, hết hạn và tiến độ tuyển dụng.

| Mức độ | Phát hiện trước sửa | Thay đổi | Bằng chứng sau sửa |
| --- | --- | --- | --- |
| P1 | Trạng thái chỉ là chấm màu và chữ nên khó quét nhanh; thử nghiệm hai badge xếp chồng tiếp tục làm giao diện vụn và lặp ý. | Hợp nhất thành một khối trạng thái: tiến độ tuyển dụng là nội dung chính, biểu tượng nằm trong ô màu nhẹ, dòng phụ giải thích ứng viên đã đồng ý cho giới thiệu. | Danh sách hiển thị rõ “Đã đi làm”, “Đã được chọn”, “Đang phỏng vấn” hoặc “Hết hạn xác nhận” trong một cụm duy nhất, không lặp badge. |
| P1 | Chi tiết chỉ có một khối trắng gồm nhãn và giá trị, thiếu phân cấp và không giải thích hồ sơ đang ở đâu. | Tạo hero xanh đậm, khối trạng thái hiện tại, tiến trình ba bước, ba thẻ thông tin và lịch sử xác nhận. | Toàn bộ trạng thái, ứng viên, CV, quyền giới thiệu và mốc xác nhận nhìn thấy theo thứ tự ưu tiên ngay trong một màn hình desktop. |
| P2 | Nút xem chi tiết mặc định trắng/đen và cột hành động bị tràn khỏi vùng nhìn. | Dùng nút tím có biểu tượng, thu gọn độ rộng cột và giới hạn bảng ở 890px. | Nút “Xem chi tiết” hiển thị đầy đủ trong vùng nội dung 1268px. |

### Kiểm tra bề mặt bắt buộc

- Typography: giữ font hệ thống hiện có, tăng rõ cấp độ tiêu đề, nhãn, mô tả và dữ liệu; không có chữ quan trọng dưới 10px.
- Spacing: dùng nhịp 8/12/16/24px, ba thẻ thông tin cân bằng và không tràn ngang ở desktop.
- Màu: trạng thái success/warning/danger/info/neutral có cặp nền–chữ riêng; biểu tượng và chữ giúp người dùng không phải dựa vào màu đơn thuần.
- Hình ảnh và biểu tượng: dùng Ant Design Icons hiện có, không dùng emoji hay hình giả lập.
- Nội dung: toàn bộ thuật ngữ là tiếng Việt hướng đến cộng tác viên; dữ liệu lấy từ API, không thêm dữ liệu minh họa giả.
- Ghi chú tự do như dữ liệu test “gà”, “tôi thích” không còn xuất hiện trong bảng; trang chi tiết chỉ hiện lý do với các trạng thái cần người dùng xử lý.
- Tương tác: bộ lọc, tải lại, xem chi tiết, quay lại và gửi lại xác nhận vẫn hoạt động; focus và accessible name của nút được giữ nguyên.

## Vòng 4 — Kho ứng viên

- Implementation: `http://127.0.0.1:5173/affiliate/candidates`, gồm danh sách và drawer “Hồ sơ ứng viên”.
- Trước sửa: bảng chỉ hiển thị số rời rạc; drawer là nền trắng với nội dung và nút đặt liên tiếp, thiếu thứ bậc.
- Sau sửa: bảng có nhãn “CV có thể dùng”, “lượt giới thiệu”, thời gian tương đối và nút “Xem hồ sơ”; drawer có hero nhận diện, thông tin liên hệ, số liệu, CTA chính và thẻ CV riêng.
- Kiểm tra tương tác: tìm kiếm, mở hàng bằng chuột/bàn phím, xem CV, chọn CV và chuyển sang luồng giới thiệu mới.
- Kiểm tra trực quan tại 1268 × 714: không tràn ngang, nút hành động hiển thị đầy đủ, drawer không che nội dung chính cần thao tác.

## Vòng 5 — Quyền ghi nhận và điều hướng

- Implementation: `http://127.0.0.1:5173/affiliate/attributions`.
- Trước sửa: bảng chỉ có chấm xanh “Đang hiệu lực”, không giải thích căn cứ ghi nhận hoặc quyền này dùng để làm gì.
- Sau sửa: có khối giải thích quyền ghi nhận, tổng số quyền, căn cứ bằng tiếng Việt, trạng thái kèm mô tả và thời gian tương đối; CTA dẫn thẳng đến hoa hồng.
- Sidebar đổi từ xanh navy gần đen sang xanh lam `#174a87`; chữ và nhóm điều hướng được tăng sáng để giữ độ tương phản và đồng bộ toàn portal Affiliate.
- Kiểm tra trực quan tại 1268 × 714: bảng không tràn, nhãn không chồng nhau, trạng thái và căn cứ đọc được trong một lượt quét.

final result: passed
