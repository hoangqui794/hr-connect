# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Ứng viên đang tìm việc, theo dõi đơn ứng tuyển và quản lý hồ sơ nghề nghiệp trên máy tính.
- Khách chưa đăng nhập có thể khám phá thông tin nền tảng và việc làm công khai trước khi tạo tài khoản.

## Product Purpose

HR Connect giúp ứng viên tìm việc phù hợp, ứng tuyển bằng CV, theo dõi tiến trình tuyển dụng, phản hồi lịch phỏng vấn và quản lý hồ sơ trong một không gian thống nhất. Thành công của luồng Candidate là người dùng luôn biết mình đang ở đâu, việc cần làm tiếp theo là gì và trạng thái hồ sơ có ý nghĩa gì.

## Positioning

Hệ thống kết hợp việc làm công khai, đề xuất việc làm dựa trên hồ sơ Candidate và một quy trình ứng tuyển có trạng thái minh bạch từ lúc nộp hồ sơ đến phỏng vấn, offer và đi làm.

## Operating Context

- Khách truy cập landing page và danh sách việc làm công khai.
- Candidate đăng nhập để xem tổng quan, việc làm phù hợp, toàn bộ việc làm, việc đã lưu, đơn ứng tuyển, CV và hồ sơ nghề nghiệp.
- Bộ lọc việc làm phải dùng đúng tham số mà API backend hỗ trợ và lưu trạng thái trên URL.
- Candidate cần đọc trạng thái đơn nhanh từ danh sách, sau đó mở trang chi tiết khi cần hành động.

## Capabilities and Constraints

- Frontend hiện dùng React, TypeScript, Vite, Ant Design, Tailwind CSS và React Query.
- Giao diện web là phạm vi ưu tiên hiện tại; chưa yêu cầu làm ứng dụng mobile riêng.
- Tất cả nội dung dành cho người dùng phải dùng tiếng Việt rõ ràng và nhất quán.
- Header Guest và Candidate có thể dùng chung nền tảng kỹ thuật nhưng phải hiển thị điều hướng phù hợp theo trạng thái đăng nhập.
- API tìm việc hiện hỗ trợ từ khóa, địa điểm, hình thức làm việc, loại dịch vụ, khoảng lương, số năm kinh nghiệm và sắp xếp.

## Brand Commitments

- Giữ tên HR Connect và biểu tượng thương hiệu hiện có.
- Ngôn ngữ thân thiện, trực tiếp, tránh thuật ngữ nội bộ hoặc mã trạng thái kỹ thuật.
- Màu xanh là màu hành động chính; màu trạng thái chỉ dùng theo ngữ nghĩa thành công, cảnh báo, thông tin và kết thúc.

## Evidence on Hand

- Mã nguồn frontend và API hiện có trong repository.
- Dữ liệu việc làm, hồ sơ, đơn ứng tuyển, lịch phỏng vấn và đề xuất việc làm được lấy từ backend; không tạo số liệu hoặc tuyên bố giả trong giao diện.

## Product Principles

1. Việc quan trọng xuất hiện trước, chi tiết phụ mở dần khi người dùng cần.
2. Một trạng thái chỉ có một cách gọi và một hệ màu xuyên suốt các màn hình.
3. Bộ lọc phải dễ hiểu, dễ xóa và phản ánh đúng dữ liệu backend đang truy vấn.
4. Guest được dẫn đến khám phá; Candidate được dẫn đến hành động và theo dõi tiến trình.
5. Giao diện quen thuộc, ổn định và dễ quét quan trọng hơn hiệu ứng trang trí.

## Accessibility & Inclusion

- Điều hướng, bộ lọc và thao tác chính phải dùng được bằng bàn phím.
- Nút biểu tượng cần nhãn truy cập; trạng thái không được truyền đạt chỉ bằng màu sắc.
- Nội dung chính giữ độ tương phản đọc được và kích thước tương tác phù hợp cho web responsive.
