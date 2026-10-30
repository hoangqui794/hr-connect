# Hướng dẫn test FE MF-01 → MF-05

Cập nhật: 30/10/2026

Tài liệu này liệt kê các ca test giao diện cho 5 luồng chính của HR Connect, theo 3 dịch vụ: Tuyển dụng theo kết quả (HH), Nhận hồ sơ ứng tuyển (AP) và Tìm hồ sơ phù hợp (SS). Chạy theo thứ tự MF-01 → MF-05 vì luồng sau dùng dữ liệu của luồng trước; mỗi ca ghi kết quả ở cột cuối (Đạt / Lỗi / Bỏ qua).

## Chuẩn bị

Test trên bản deploy https://hr-connect-iota.vercel.app hoặc local (FE chạy `npm run dev` ở cổng 5173). MF-03 cần dịch vụ AI đang chạy, nếu không hồ sơ sẽ ở trạng thái chấm điểm thất bại.

| Vai trò | Tài khoản demo | Dùng cho |
| --- | --- | --- |
| Platform Admin | admin@gmail.com | Duyệt công ty, Affiliate, ghi nhận tiền, cài đặt, hoa hồng, chi trả |
| Internal HR | internalhr@gmail.com, internalhr2@gmail.com | Duyệt tin, sàng lọc HH/SS, giao CV, xác minh báo nghỉ |
| Client | client@gmail.com (và client2 → client5) | Đăng tin, sàng lọc AP, phỏng vấn, offer, thanh toán |
| Affiliate | affiliate@gmail.com, affiliate2@gmail.com | Giới thiệu ứng viên, theo dõi hoa hồng |
| Candidate | candidate@gmail.com, candidate2@gmail.com | Ứng tuyển, xác nhận giới thiệu, nhận offer |

Mật khẩu demo lấy từ nhóm, không ghi vào tài liệu này. Mỗi vai trò nên mở bằng một trình duyệt hoặc cửa sổ ẩn danh riêng, vì cùng một trình duyệt chỉ giữ được một phiên đăng nhập.

Quy ước khi test:

- Đặt tên tin test có tiền tố `[TEST-<ngày>]` để dễ tìm và dọn.
- Mỗi ca chụp ảnh màn hình kết quả; ca lỗi ghi thêm bước tái hiện và nội dung thông báo lỗi.
- Cột Kết quả ghi Đạt, Lỗi hoặc Bỏ qua (kèm lý do).
- Tài khoản Affiliate đăng nhập từ trước 30/10/2026 cần đăng xuất và đăng nhập lại, vì mã vai trò đã đổi thành AFFILIATE.

Thanh toán VNPay (sandbox, chỉ để test): trên trang VNPay chọn Thẻ nội địa → NCB, số thẻ 9704198526191432198, tên NGUYEN VAN A, ngày phát hành 07/15, OTP 123456. Nút VNPay chỉ hiện khi backend đã có VNPAY_TMN_CODE, VNPAY_HASH_SECRET và VNPAY_RETURN_URL.

## MF-01 Đăng tin và duyệt tin

Tin đi từ Nháp → Chờ duyệt → Đang tuyển (hoặc Bị từ chối). Tin AP chỉ công bố sau khi gói đăng tin được thanh toán; tin SS có cọc chỉ công bố sau khi Admin ghi nhận cọc. Điều kiện: công ty của Client đã được Admin xác minh.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 01-01 | Client | /client/jobs/create | Tạo tin AP: bước 2 tìm và chọn mẫu JD → điền đủ 4 bước → chọn gói đăng tin → Gửi duyệt | Tin ở trạng thái Chờ duyệt trong /client/jobs. Mẫu JD không tự điền lương, địa điểm | |
| 01-02 | Client | /client/jobs/create | Bỏ trống trường bắt buộc hoặc không có yêu cầu Bắt buộc (MUST_HAVE) → bấm Tiếp | Báo lỗi ngay dưới trường, không qua bước. Điền lại thì lỗi tự mất | |
| 01-03 | Client | /client/jobs/create | Nhập lương tối thiểu lớn hơn lương tối đa; số năm kinh nghiệm âm | Báo lỗi, không gửi được | |
| 01-04 | Client | /client/jobs | Lưu nháp → mở lại → sửa → gửi duyệt | Dữ liệu nháp còn đủ, gửi duyệt được | |
| 01-05 | Internal HR | /hr/jobs | Mở tin Chờ duyệt → Từ chối, bỏ trống lý do → rồi chọn mã lý do | Thiếu lý do bị chặn. Có lý do: tin Bị từ chối, Client thấy lý do và có thông báo | |
| 01-06 | Client | /client/jobs/:id/edit | Sửa tin bị từ chối → gửi lại | Tin quay về Chờ duyệt; lịch sử trạng thái ghi đủ người, lý do, thời điểm | |
| 01-07 | Internal HR | /hr/jobs | Duyệt tin AP | Tin chuyển Chờ thanh toán. Client chỉ thấy Hướng dẫn thanh toán, không có nút tự xác nhận đã trả. HR không có nút ghi nhận tiền | |
| 01-08 | Admin | /admin/finance (Phí đăng tin) | Ghi nhận thanh toán, bỏ trống mã tham chiếu → rồi nhập mã | Trống mã bị chặn. Có mã: tin Đang tuyển, hiện ở trang việc làm công khai, bộ đếm cập nhật | |
| 01-09 | Client | /client/jobs/create | Gói miễn phí: đã có 1 tin miễn phí đang mở → gửi duyệt tin miễn phí thứ 2 | Bị chặn, thông báo nêu giới hạn số tin miễn phí và chu kỳ | |
| 01-10 | Admin | /admin/settings › AP · Gói đăng tin | Sửa tên, giá, số ngày, số hồ sơ tối đa (hoặc Không giới hạn) của gói Tiêu chuẩn → Lưu | Lưu thành công. Client tạo tin mới thấy số mới; tin đã gửi duyệt giữ số cũ. Gói miễn phí không sửa được giá | |
| 01-11 | Admin | /admin/settings › AP · Gói đăng tin | Tắt công tắc Đang bán của một gói | Client không còn chọn được gói đó khi tạo tin mới | |
| 01-12 | Client → Internal HR | /client/jobs/create → /hr/jobs | Tạo tin HH kèm đề xuất hệ số phí và số ngày bảo hành → HR chốt điều khoản → duyệt | Ô điều khoản của HR điền sẵn đúng đề xuất. Duyệt xong tin Đang tuyển, Affiliate thấy tin | |
| 01-13 | Client | /client/agreements | Mở hợp đồng dịch vụ của tin HH hoặc SS → gửi mã OTP về email → nhập sai mã → nhập đúng mã | Mã sai bị báo lỗi. Mã đúng: hợp đồng Đã ký, xem lại được nội dung | |
| 01-14 | Client → Internal HR → Admin | /client/jobs/create → /hr/jobs → /admin/finance | Tạo tin SS cần tuyển 2 người, mua 3 CV → HR duyệt → Admin ghi nhận cọc | Sau duyệt: thẻ tin hiện Chờ đặt cọc và 3 CV. Sau ghi nhận cọc: tin Đang tuyển | |
| 01-15 | Client | /client/jobs | Tạm dừng → mở lại → đóng tin (đóng bắt buộc lý do) | Trạng thái đổi đúng; tin tạm dừng không nhận hồ sơ; đóng thiếu lý do bị chặn | |
| 01-16 | Khách, Candidate, Affiliate | Trang chủ, /candidate/jobs, /affiliate/jobs | Xem danh sách việc làm của từng vai trò; mở thẳng URL tin không được xem | Khách và Candidate chỉ thấy tin AP; Affiliate chỉ thấy tin HH và SS. URL không được xem bị chặn | |
| 01-17 | Internal HR | /hr/job-templates | Tạo, sửa, ẩn một mẫu JD (mẫu phải có ít nhất 1 yêu cầu Bắt buộc) | Client không còn tìm thấy mẫu đã ẩn; tin tạo từ mẫu trước đó không đổi | |
| 01-18 | Client | /client/company | Đổi logo công ty bằng ảnh 8–10 MB, rồi thử file trên 10 MB | Ảnh ≤ 10 MB lưu được và hiển thị ở tin; trên 10 MB báo lỗi ngay | |

## MF-02 Nộp hồ sơ và giới thiệu ứng viên

Hai đường vào: ứng viên tự nộp tin AP, hoặc Affiliate giới thiệu vào tin HH/SS và ứng viên xác nhận qua email (hiệu lực 48 giờ). Trùng = cùng ứng viên + cùng tin; lượt giới thiệu hợp lệ đầu tiên được ghi nhận. Chuẩn bị: 1 tin AP và 1 tin HH đang tuyển từ MF-01, 1 email thật chưa có tài khoản.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 02-01 | Candidate | /candidate/jobs/:jobId | Ứng tuyển tin AP bằng file PDF tải lên | Nộp thành công; hồ sơ hiện ở /candidate/applications trạng thái Đã nộp | |
| 02-02 | Candidate | /candidate/jobs/:jobId | Ứng tuyển tin AP khác bằng CV có sẵn trong kho | Nộp thành công, không phải tải lại file | |
| 02-03 | Candidate | /candidate/cv-builder | Tạo CV theo mẫu → xem PDF → ứng tuyển bằng CV đó | PDF hiển thị đúng nội dung; nộp được | |
| 02-04 | Candidate | /candidate/cv-builder/:cvId | Sửa CV đã dùng để nộp | CV có bản mới; hồ sơ đã nộp vẫn giữ file cũ | |
| 02-05 | Candidate | /candidate/jobs/:jobId | Ứng tuyển lại cùng tin; ứng tuyển tin đang tạm dừng | Cả hai bị chặn với thông báo rõ | |
| 02-06 | Candidate | /candidate/jobs | Tìm tin HH hoặc SS | Không thấy; không có nút ứng tuyển cho các dịch vụ này | |
| 02-07 | Affiliate | /affiliate/jobs/:jobId | Mở chi tiết tin HH và tin SS | Vẫn nằm trong giao diện Affiliate; có hoa hồng ước tính | |
| 02-08 | Affiliate → Candidate | /affiliate/submit-candidate → /candidate/submission-consents/:id | Giới thiệu candidate2 vào tin HH → candidate2 đăng nhập, Đồng ý | Lượt giới thiệu được ghi nhận; Affiliate nhận thông báo; hồ sơ hiện ở /affiliate/submissions | |
| 02-09 | Affiliate → Khách | /affiliate/submit-candidate → link trong email | Giới thiệu một email thật chưa có tài khoản → mở link trong email → Đồng ý | Email tới, nội dung nói cộng tác viên (Affiliate) giới thiệu; trang xác nhận công khai mở được; đồng ý xong tạo hồ sơ | |
| 02-10 | Khách | Link email đã dùng | Mở lại link xác nhận đã bấm | Báo đã xử lý, không tạo hồ sơ lần hai | |
| 02-11 | Candidate | /candidate/submission-consents/:id | Từ chối một lượt giới thiệu | Lượt đó bị từ chối, Affiliate được báo, không có hồ sơ | |
| 02-12 | Affiliate | /affiliate/submissions/:id | Gửi lại email xác nhận 2 lần liên tiếp trong 2 phút | Lần 2 bị chặn, báo thời gian chờ | |
| 02-13 | affiliate2 | /affiliate/submit-candidate | Khi lượt của affiliate đang chờ xác nhận, nộp cùng ứng viên vào cùng tin | Bị chặn | |
| 02-14 | affiliate2 | /affiliate/submit-candidate | Sau khi ứng viên đã đồng ý với affiliate, nộp trùng ứng viên đó vào cùng tin | Báo trùng; ghi nhận vẫn thuộc affiliate đầu tiên | |
| 02-15 | Affiliate | /affiliate/submit-candidate | Nhập email của ứng viên A và số điện thoại của ứng viên B | Bị từ chối | |
| 02-16 | Affiliate | /affiliate/candidates | Giới thiệu ứng viên cũ từ kho vào một tin khác | Không tính là trùng; tiến độ hiển thị tiếng Việt | |
| 02-17 | affiliate2 → Admin | /affiliate/disputes → /admin/disputes | Khiếu nại lượt bị chặn trùng → Admin chấp nhận một khiếu nại, từ chối một khiếu nại | Affiliate không thấy tên Affiliate bên kia; mỗi quyết định có thông báo | |
| 02-18 | Internal HR, Client | Chi tiết hồ sơ › Lịch sử | Xem lịch sử hồ sơ được giới thiệu | HR thấy tên Affiliate giới thiệu; Client không thấy tên Affiliate | |

## MF-03 AI và sàng lọc

Mọi hồ sơ được AI chấm điểm theo yêu cầu Bắt buộc và Ưu tiên. Internal HR sàng lọc tin HH và SS; Client tự sàng lọc tin AP. Client tin HH chỉ thấy hồ sơ HR đã chọn và CV đã che thông tin liên hệ.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 03-01 | Internal HR | /hr/screening | Mở hồ sơ HH vừa nộp, chờ AI chấm xong | Có điểm, mức phù hợp đúng màu, kết quả từng yêu cầu kèm trích dẫn từ CV | |
| 03-02 | Internal HR | /hr/screening | Tắt dịch vụ AI → nộp hồ sơ mới → bật lại → bấm Chấm lại | Khi AI tắt: hồ sơ báo chấm thất bại rõ ràng, pipeline không bị kẹt. Chấm lại xong có điểm | |
| 03-03 | Internal HR | /hr/screening | Mở hồ sơ HH đã nộp | Hồ sơ tự chuyển Đang sàng lọc | |
| 03-04 | Internal HR | /hr/screening | Chọn gửi Client | Hộp xác nhận nói đúng theo dịch vụ; chi tiết cập nhật ngay không cần tải lại | |
| 03-05 | Internal HR | /hr/screening | Đưa một hồ sơ vào Dự phòng | Trạng thái Dự phòng | |
| 03-06 | Internal HR | /hr/screening | Loại hồ sơ, bỏ trống mã lý do → rồi chọn mã | Thiếu mã bị chặn; có mã thì hồ sơ Bị loại | |
| 03-07 | Internal HR | /hr/screening, /hr/dashboard | Mở hồ sơ của tin AP | HR không có nút sàng lọc; dashboard HR không đếm hồ sơ AP | |
| 03-08 | Client | /client/candidates | Tin AP: xem điểm AI, chọn một hồ sơ đi phỏng vấn, loại một hồ sơ kèm lý do | Nhãn Đã chọn phỏng vấn; hồ sơ bị loại có lý do | |
| 03-09 | Client | /client/candidates | Tin HH: xem danh sách hồ sơ | Chỉ thấy hồ sơ HR đã gửi Client; không có email, số điện thoại, địa chỉ | |
| 03-10 | Client | /client/candidates | Tin HH: bấm Xem CV (đã che liên hệ) | PDF có chữ [đã ẩn] thay thông tin liên hệ; CV gốc vẫn khóa | |
| 03-11 | Internal HR | /hr/screening | Tin SS: chọn đạt chuẩn → giao CV cho Client | Trang nhắc số CV chưa giao; giao xong số đã giao tăng | |
| 03-12 | Internal HR | /hr/screening | Tin SS: giao vượt số CV Client đã mua | Bị chặn; CV dư vào Dự phòng | |
| 03-13 | Client | /client/jobs/:id/sourcing | Chấp nhận một CV được giao | Drawer và nhãn danh sách cập nhật ngay | |
| 03-14 | Client | /client/jobs/:id/sourcing | Từ chối CV: bỏ trống lý do → chọn mã lý do; thêm một lần chọn lý do Khác | Thiếu lý do bị chặn. Lý do Khác chuyển HR xác minh | |
| 03-15 | Internal HR | /hr/screening | Xác minh lý do Khác: một lần bác bỏ, một lần chấp nhận → thay CV bằng CV dự phòng | Bác bỏ = tính như đã chấp nhận. Chấp nhận: CV cũ Đã thay, CV mới có hạn xem xét mới | |
| 03-16 | Internal HR | Drawer hồ sơ | Thu nhỏ cửa sổ về 800px và 375px | Drawer không tràn màn hình, nút bấm được | |

## MF-04 Phỏng vấn, offer và đi làm

Chỉ Client lên lịch, ghi kết quả, gửi offer và xác nhận đi làm; Internal HR chỉ xem và đối soát placement tin HH. Điều kiện: hồ sơ đã được chọn ở MF-03.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 04-01 | Client → Candidate | /client/interviews-offers | Lên lịch phỏng vấn cho hồ sơ đã chọn | Hồ sơ chuyển Phỏng vấn. Candidate có thông báo trong chuông ngay và email có nút xác nhận | |
| 04-02 | Candidate | Email phỏng vấn, /candidate/applications/:id | Bấm xác nhận tham gia trong email | Client thấy ứng viên đã xác nhận | |
| 04-03 | Client | /client/interviews-offers | Dời lịch; sau đó tạo thêm lịch thứ hai khi lịch đầu chưa xong | Dời được, Candidate thấy giờ mới, có lịch sử. Lịch thứ hai bị chặn (mỗi hồ sơ một lịch đang chờ) | |
| 04-04 | Client | /client/interviews-offers | Hủy lịch kèm lý do; ghi vắng mặt ở một lịch khác | Trạng thái Đã hủy và Vắng mặt hiển thị đúng | |
| 04-05 | Client | /client/interviews-offers | Ghi kết quả Đạt, bỏ trống nhận xét → rồi nhập nhận xét | Thiếu nhận xét bị chặn. Có nhận xét: hồ sơ Chờ offer | |
| 04-06 | Client | /client/interviews-offers | Ghi kết quả Không đạt | Hồ sơ Trượt phỏng vấn, kết thúc | |
| 04-07 | Client | /client/interviews-offers | Ghi Dự bị cho 2 hồ sơ → chọn 1, không chọn 1 | Hồ sơ được chọn Chờ offer; hồ sơ còn lại Dự bị không được chọn | |
| 04-08 | Client | /client/interviews-offers | Tạo offer nháp → sửa → gửi | Nháp sửa được; gửi xong Candidate có thông báo | |
| 04-09 | Client | /client/interviews-offers | Tin HH: tạo offer lương NET hoặc theo năm; tạo offer thiếu lương | Cả hai bị chặn: tin HH bắt buộc lương gross theo tháng | |
| 04-10 | Client | /client/interviews-offers | Rút offer đã gửi: bỏ trống lý do → nhập lý do | Thiếu lý do bị chặn. Có lý do: offer Đã rút, hồ sơ về Chờ offer | |
| 04-11 | Candidate | /candidate/applications/:id | Từ chối một offer | Hồ sơ Từ chối offer, kết thúc | |
| 04-12 | Candidate → Client | /candidate/applications/:id | Chấp nhận offer → Client thử rút offer đó | Offer Đã chấp nhận; Client không rút được | |
| 04-13 | Client | /client/interviews-offers | Xác nhận ngày bắt đầu dự kiến | Ngày hiển thị cho Client và Candidate | |
| 04-14 | Client | /client/interviews-offers | Xác nhận đi làm với ngày trong tương lai, ngày trước ngày nhận offer, rồi ngày hợp lệ | Hai ngày sai bị chặn. Ngày hợp lệ: hồ sơ Đã đi làm, chuyển sang MF-05 | |
| 04-15 | Client | /client/interviews-offers | Đánh dấu Không nhận việc kèm lý do cho một hồ sơ đã nhận offer | Hồ sơ kết thúc; không phát sinh phí (kiểm ở 05-02) | |
| 04-16 | Candidate | /candidate/applications/:id | Rút một hồ sơ chưa đi làm | Hồ sơ Đã rút; Client thấy trạng thái mới | |
| 04-17 | Internal HR | /hr/interviews, /hr/offers | Mở lịch phỏng vấn và offer | Chỉ xem; không có nút lên lịch, ghi kết quả hay tạo offer | |
| 04-18 | Internal HR | /hr/placement-reconciliations | Đối soát placement HH vừa xác nhận đi làm: một lần xác nhận, một lần đánh dấu sai lệch | Xác nhận thì phí được tính; sai lệch thì phí bị giữ | |

## MF-05 Phí, bảo hành và hoa hồng

Tin HH: xác nhận đi làm tạo phí dịch vụ (hệ số × lương gross tháng), bảo hành 30 ngày và hoa hồng Đang bảo hành. Không có thử việc. Hoa hồng được hưởng sau khi qua bảo hành và chỉ chi khi Client đã trả phí. Mọi con số (hệ số, số ngày, hạn trả) do Admin cài đặt. Dùng placement từ 04-14.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 05-01 | Client | /client/billing | Mở trang Thanh toán sau khi xác nhận đi làm tin HH | Có khoản phí = hệ số × lương gross tháng, có hạn thanh toán; Client nhận thông báo | |
| 05-02 | Client | /client/billing | Kiểm tra hồ sơ Không nhận việc (04-15) | Không có phí, không có hoa hồng | |
| 05-03 | Client, Internal HR | /client/warranty, /hr/warranty-tracking | Mở trang Bảo hành | Placement hiện Đang bảo hành, đếm ngược số ngày còn lại; menu HR nằm ở nhóm Theo dõi | |
| 05-04 | Affiliate | /affiliate/commissions | Xem hoa hồng của placement HH | Hoa hồng Đang bảo hành. Hồ sơ ứng viên tự nộp (AP) không có hoa hồng | |
| 05-05 | Admin | /admin/payouts | Duyệt chi hoa hồng khi Client chưa trả phí | Bị chặn, thông báo nêu lý do | |
| 05-06 | Admin → Client | /admin/finance | Ghi nhận Client đã trả phí dịch vụ kèm mã tham chiếu | Có thông báo thành công; /client/billing đổi thành Đã thanh toán | |
| 05-07 | Client → Internal HR | /client/warranty → /hr/warranty-tracking | Client báo ứng viên nghỉ trong bảo hành → HR Bác bỏ | Khi báo: bảo hành Đã báo nghỉ, hoa hồng Tạm giữ. Sau bác bỏ: về Đang bảo hành | |
| 05-08 | Client → Internal HR | /client/warranty → /hr/warranty-tracking | Báo nghỉ lần nữa → HR Xác nhận | Bảo hành hết hiệu lực, hoa hồng bị hủy, Client có 1 suất thay thế miễn phí | |
| 05-09 | Client | /client/warranty | Xem suất thay thế trước và sau khi phí gốc được trả | Chưa trả phí: Chờ thanh toán. Đã trả: Mở, có hạn sử dụng | |
| 05-10 | Client | /client/interviews-offers | Tuyển người thay thế vào suất đang Mở → xác nhận đi làm; thử dùng lại suất đó lần hai | Không tạo phí mới; suất Đã dùng. Lần hai bị chặn | |
| 05-11 | Affiliate | /affiliate/commissions | Tin SS: sau khi Client chấp nhận CV (03-13) | Có hoa hồng cho từng CV được tính | |
| 05-12 | Admin | /admin/payouts | Duyệt hoa hồng liên quan một khiếu nại đang mở | Bị chặn vì đang tranh chấp | |
| 05-13 | Admin | /admin/payouts | Điều chỉnh số tiền hoa hồng kèm lý do; hủy một hoa hồng kèm lý do | Thiếu lý do bị chặn; có lý do thì lưu và có nhật ký ở /admin/audit-trail | |
| 05-14 | Admin → Affiliate | /admin/payouts → /affiliate/ledger | Ghi chi trả Thất bại → ghi chi lại Thành công kèm mã giao dịch | Khoản thất bại được giữ để chi lại; Affiliate thấy lịch sử chi đủ 2 lần | |
| 05-15 | Admin | /admin/affiliates | Khóa affiliate2 | Hoa hồng chưa hưởng chuyển Tạm giữ; hoa hồng đã hưởng vẫn chi được. Nhớ mở khóa sau khi test | |
| 05-16 | Affiliate | /affiliate/performance | Xem đánh giá hiệu suất sau các ca trên | Chỉ số thay đổi theo kết quả giới thiệu | |
| 05-17 | Admin | /admin/reports | Xem báo cáo doanh thu | Có đủ 3 dịch vụ HH, AP, SS; số khớp với các khoản đã ghi nhận | |

### Thanh toán trên trang Công nợ (bổ sung 30/10/2026)

Client thanh toán từng khoản qua VNPay, khoản phí tự chuyển Đã thanh toán, không cần Admin ghi nhận. Chuyển khoản vẫn còn làm cách dự phòng.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 05-18 | Client | /client/billing | Bấm Thanh toán ở khoản Cọc CV Sourcing, xem phần cách tính | Hiện Số CV đặt mua × Đơn giá mỗi CV = Tổng giá trị gói, Tỷ lệ đặt cọc, rồi Số tiền cần thanh toán khớp | |
| 05-19 | Client | /client/billing | Bấm Thanh toán ở khoản Phí Headhunt | Hiện Lương gross tháng và Hệ số phí; số tiền = lương × hệ số | |
| 05-20 | Client | /client/billing → VNPay → /client/billing/vnpay-return | Thanh toán qua VNPay khoản Cọc CV Sourcing bằng thẻ NCB test | Trang kết quả báo Thanh toán thành công kèm mã giao dịch; khoản phí Đã thanh toán · VNPAY-…; tin SS chuyển Đang tuyển | |
| 05-21 | Client | /client/billing → VNPay | Thanh toán qua VNPay phí gói đăng tin AP | Khoản phí Đã thanh toán; tin AP được công bố | |
| 05-22 | Client | Trang VNPay | Bấm Hủy giao dịch trên trang VNPay | Trang kết quả báo Bạn đã hủy thanh toán; khoản phí vẫn Chờ thanh toán, bấm Thanh toán lại được | |
| 05-23 | Client | /client/billing | Mở Thanh toán, xem mục Hoặc chuyển khoản, bấm sao chép số tài khoản và nội dung chuyển khoản | Có ngân hàng, số tài khoản, chủ tài khoản, nội dung; sao chép báo thành công; không có nút tự xác nhận đã trả | |
| 05-24 | Admin | /admin/finance › Công nợ phí | Ghi nhận đã thu một phí dịch vụ HH hoặc cọc SS (trước 30/10 lỗi 500) | Lưu thành công, Client nhận thông báo, /client/billing đổi Đã thanh toán | |
| 05-25 | Client, Internal HR | /client/warranty, /hr/screening | Báo ứng viên nghỉ trong bảo hành; HR giao CV Sourcing (cả hai từng lỗi 500) | Thao tác thành công và người nhận có thông báo | |

## Kiểm tra chung

Các ca này chạy xen kẽ trong lúc test 5 luồng trên.

| Mã | Vai trò | Màn hình | Bước test | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| CH-01 | Mọi vai trò | Menu tài khoản | Đăng xuất | Về thẳng trang /login; bấm Back không vào lại được trang cần đăng nhập | |
| CH-02 | Client, Affiliate, Candidate | Gõ URL trực tiếp | Client mở /hr/jobs và /admin/settings; Affiliate mở /client/jobs; Candidate mở hồ sơ của người khác | Tất cả bị chặn hoặc chuyển về trang của đúng vai trò | |
| CH-03 | Mọi vai trò | Chuông thông báo | Sau mỗi bước chính, kiểm tra chuông của người nhận → bấm thông báo | Số trên chuông tăng không cần tải lại; bấm vào đi đúng trang | |
| CH-04 | Mọi vai trò | Tiêu đề các trang Client và HR | Rê chuột vào biểu tượng (i) cạnh tiêu đề | Hiện chú thích của trang | |
| CH-05 | Mọi vai trò | Toàn trang | Tìm chữ Recruiter trên các màn hình, email và thông báo | Không còn chữ Recruiter; người giới thiệu luôn gọi là Affiliate / Cộng tác viên | |
| CH-06 | Admin | /admin/settings | Đổi một cài đặt (ví dụ số tin miễn phí mở cùng lúc) → test lại 01-09 → trả giá trị cũ | Có hiệu lực ngay, không cần deploy | |
| CH-07 | Admin | /admin/audit-trail | Lọc nhật ký theo các thao tác đã làm | Có bản ghi cho duyệt tin, ghi nhận tiền, sửa gói, khiếu nại, đổi hoa hồng | |
| CH-08 | Mọi vai trò | Trang chủ, tìm việc, drawer hồ sơ, /client/billing | Thu cửa sổ về 375px và 800px | Không tràn ngang, chữ đọc được, nút bấm được | |
| CH-09 | Mọi vai trò | Bản deploy | Mở một tab cũ đã mở trước lần deploy mới → chuyển sang trang khác | Trang tự tải lại một lần, không hiện lỗi tải module | |

## Ca không test được trên giao diện

Các ca phụ thuộc thời gian không chờ được trong một buổi test. Ghi Bỏ qua và dựa vào unit test, hoặc tạo dữ liệu từ hôm trước rồi kiểm lại.

| Tình huống | Vì sao | Cách xử lý |
| --- | --- | --- |
| Lời mời giới thiệu hết hạn 48 giờ | Phải chờ 48 giờ | Admin tạm giảm thời hạn trong cài đặt, test xong trả lại |
| Qua 30 ngày bảo hành → hoa hồng được hưởng | Phải chờ 30 ngày | Bỏ qua, dựa vào unit test của WarrantyProgressWorker |
| Phí đến hạn và quá hạn | Phải chờ hạn thanh toán | Bỏ qua, hoặc kiểm trên dữ liệu tạo từ trước |
| Offer hết hạn, CV SS tự chấp nhận sau hạn xem xét | Phải chờ hạn | Bỏ qua, dựa vào unit test OfferExpiryWorker và SourcingAutoAcceptWorker |
| Suất thay thế hết hạn | Phải chờ hạn dùng suất | Bỏ qua |

Các phần chưa có code, không tính là lỗi: chặn tuyển quá số lượng cần tuyển (tin HH cần 2 người mới tuyển 1 thì tin vẫn Đang tuyển), hoàn phí, từ đồng nghĩa cho từ khóa AI. Sau buổi test: đóng các tin `[TEST-<ngày>]`, trả lại cài đặt đã đổi và mở khóa affiliate2.
