# Phản hồi của HR khi test hệ thống (SHIRE Platform) – 28/10/2026

> Bản gốc HR gửi, có ghi chú trạng thái xử lý của nhóm dưới từng mục. Ảnh nằm trong thư mục `images/`.

> **Trạng thái xử lý (cập nhật 29/10/2026):** ✅ đã sửa · ⏳ cần báo người phụ trách · ❓ cần nhóm chốt · ⬜ chưa làm.

## **HỒ SƠ DOANH NGHIỆP (sẽ hiện CÔNG TY trên trang chủ)**

## **TỔNG QUAN:**

![][image1]

Chào tên công ty,  
Xem ứng viên \=\> Xem Hồ Sơ Ứng Viên

Việc cần làm \=\> Việc Cần Làm  
Cập nhập tình hình việc làm   
Chữ cái đầu tiên viết hoa 

> ✅ **ĐÃ SỬA (commit `08c17a96`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** Tổng quan Client viết hoa chữ cái đầu: nút "Xem Hồ Sơ Ứng Viên", tiêu đề "Việc Cần Làm", "Phễu Ứng Viên", "Phỏng Vấn Sắp Tới", "Tin Đang Tuyển".

![][image2]

**Tin đang tuyển**   
Có 3 dịch vụ: viết tắt lưu lại dịch vụ để dễ chọn filter  
Headhunt \- HH  
CV Application: AP  
CV Sourcing: SS

Headhunt \- Cần 1 người \=\> Cần 1 người  
CV Application: Cần 10 người  
CV Sourcing: Cần 20 người

> ✅ **ĐÃ SỬA (commit `ce98798c`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** thống nhất viết tắt **HH / AP / SS** (HH = Tuyển dụng theo kết quả, AP = Nhận hồ sơ ứng tuyển, SS = Tìm hồ sơ phù hợp). Hiện ở danh sách tin, bộ lọc và cột hồ sơ ứng viên, thẻ chọn dịch vụ khi đăng tin. Chốt dùng **AP** (2 chữ) thay cho [APP] trong ví dụ.

**NOTE:** 1 khách hàng có thể tạo 1 job cho 3 dịch vụ khác nhau. Chỉ cần chọn đúng dịch vụ thanh toán đúng số tiền thanh toán cho từng dịch vụ là được

Ví dụ: vị trí Chuyên viên Content Marketing  
Khách chọn đã chọn 3 dịch vụ, và 1 cv có thể apply 3 vị trí này nhưng sẽ viết lịch sử apply từng job cho đúng và apply từ nhiều headhunter/nhân sự khác nhau. 

Ví dụ: \[HH\] \- Chuyên viên Content Marketing   
          \[APP\] \- Chuyên viên Content Marketing   
          \[SS\] \- Chuyên viên Content Marketing 

> ❓ **Cần nhóm chốt (MF-01, Mi):** hiện Client tạo được 3 tin riêng cho 3 dịch vụ và 1 CV nộp được vào cả 3 (kiểm tra trùng tính theo từng tin). Đề xuất thêm nút "Nhân bản tin sang dịch vụ khác" và tự gắn tiền tố [HH]/[AP]/[SS] vào tiêu đề.

## TIN TUYỂN DỤNG:

                                                                                    ![][image3]  
**NOTE:**

1. **Gói Dùng thử:** Ghi chú cho khách hàng đầu tiền đăng ký sử dụng Gói dùng thử miễn phí trong 30 ngày. Bỏ chu kỳ tái sử dụng 2 tháng, Bỏ câu “Tối đa 50 hồ sơ” \=\> Không giới hạn hồ sơ.

Thêm **Quyền Lợi chính** cho từng gói

| GÓI DỊCH VỤ | THỜI GIAN | GIÁ GỐC | CHIẾT KHẤU | GIÁ TÁI KÝ | QUYỀN LỢI CHÍNH |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Dùng Thử | 30 ngày | Miễn Phí | 0% | 1,500,000 VNĐ | \- Dùng thử miễn phí 30 ngày \- Không giới hạn hồ sơ UV \- AI gợi ý ứng viên phù hợp |
| Gói Tiêu Chuẩn | 90 ngày | 1,500,000 VNĐ | 10% | 1,500,000 VNĐ | \- Không giới hạn hồ sơ UV \- AI gợi ý ứng viên phù hợp \- Tái ký tặng thêm 30 ngày sử dụng |

> ❓ **Cần nhóm + GVHD chốt:** đổi gói đăng tin (bỏ chu kỳ 2 tháng, bỏ giới hạn 50 hồ sơ, giá/thời hạn mới) là thay đổi phạm vi trong phiếu đăng ký → phải ghi vào BM03. Các con số sẽ đặt trong cấu hình gói, không ghi cứng.

Có 3 dịch vụ: viết tắt lưu lại dịch vụ để dễ chọn filter  
Headhunt \- HH  
CV Application: AP  
CV Sourcing: SS

NOTE: 1 khách hàng có thể tạo 1 job cho 3 dịch vụ khác nhau. Chỉ cần chọn đúng dịch vụ thanh toán đúng số tiền thanh toán cho từng dịch vụ là được

Ví dụ: vị trí Chuyên viên Content Marketing  
Khách chọn đã chọn 3 dịch vụ, và 1 cv có thể apply 3 vị trí này nhưng sẽ viết lịch sử apply từng job cho đúng và apply từ nhiều headhunter/nhân sự khác nhau. 

![][image4]

Phần khách hàng chọn mua dịch vụ SOURCING, dịch vụ đăng tin tuyển phải  tiến hành thanh toán \=\> kế toán or admin xem thanh toán chưa và duyệt sau đó làm hợp đồng ký số điện tử. Lưu hợp đồng.  
Duyệt thông tin thanh toán này  

> ❓ **Cần nhóm chốt (MF-01 Mi + MF-05 Quí):** luồng hiện tại là ký thỏa thuận dịch vụ (OTP) **trước**, rồi đặt cọc; chỉ Admin được ghi nhận tiền. Cần xác nhận HR muốn đổi thứ tự (thanh toán → duyệt → ký hợp đồng) hay chỉ cần bước Admin duyệt chứng từ thanh toán (đã có).
![][image5]

## 

## Tùy khách hàng chọn dịch vụ HH COD, APPLICATION, SOURCING, thì thay thế các thế thành 1 mẫu nhất định, kế cả tiếng việt hay tiếng anh để dễ nhìn (Góp ý như vậy nếu được hơn là khách chọn ngôn ngữ Tiếng anh thì để 

Tuyển dụng theo kết quả \=\> HH COD  
Nhận hồ sơ ứng tuyển : CV APPLICATION  
Tìm hồ sơ phù hợp \-\> Đăng tin tuyển \=\> CV SOURCING

> ✅ **ĐÃ SỬA (commit `ce98798c`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** 3 dịch vụ dùng chung một bộ tên ở mọi màn: HH · Tuyển dụng theo kết quả (Headhunt COD), AP · Nhận hồ sơ ứng tuyển (CV Application), SS · Tìm hồ sơ phù hợp (CV Sourcing).

PHẦN TIN TUYỂN \=\> MÔ TẢ CÔNG VIỆC \=\> Ghi chú lương nên cách xuống dòng  
Thời gian làm việc: Cách xuống dòng

> ✅ **ĐÃ SỬA (commit `08c17a96`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main` + `bd78bfcc` + `425a39d6`):** ô Ghi chú lương và Thời gian làm việc nhập được nhiều dòng, xuống dòng được giữ nguyên khi hiển thị cho ứng viên; mức lương chọn theo khoảng (Thỏa thuận, Dưới 10 triệu … Trên 50 triệu, hoặc Tự nhập), có dòng xem trước "Ứng viên sẽ thấy".

![][image6]

## 

## **Phần yêu cầu, ưu tiên phải cách ra và ghi theo kiểu keyword search** 

Keyword must have: (phải có)   
KW1: Kế Toán Trưởng OR Chief Accountant  OR Head of Accounting  
KW2: Lữ hành, vận tải, thương mại và dịch vụ  
KW3:  
Keyword shouthave (nên có/ưu tiên)

> ❓ **Cần nhóm chốt (MF-03, Quí):** đề xuất mỗi yêu cầu MUST_HAVE/SHOULD_HAVE có thêm trường "từ đồng nghĩa" (OR) để AI chấm đúng, thay vì tách mỗi từ đồng nghĩa thành một yêu cầu riêng như hiện tại.

![][image7]

## 

## PHỎNG VẤN & OFFER:

Chưa có mục gửi email tại đây, nếu gửi ở bên ngoài từ gmail công ty thì phần XÁC NHẬN PHẢN HỒI CỦA ỨNG VIÊN sẽ phải lấy thông tin từ đâu.  
Nếu có phần gửi email thì phần phản hồi của ứng viên mới có hiệu lực.

> ⏳ **Cần báo Sơn (MF-04), chưa ai làm:** hiện ứng viên **chưa có tài khoản** đã nhận email mời phỏng vấn; ứng viên **có tài khoản** chỉ nhận thông báo trong app. Đề xuất luôn gửi email kèm nút "Xác nhận tham gia" và hiện cho Client "Đã gửi email lúc…".

## PHẦN BẢO HÀNH:

Phía khách hàng hàng Client chỉ thấy phần phí dịch vụ, không thấy phần hoa hồng của ứng viên và ngược lại. 

![][image8]  
Nếu theo chủ trương tất cả minh bạch để vẫn được nhưng 2 bên không nên nhìn thấy mức phí dịch vụ và hoa hồng chi trả chỉ cho thấy mỗi phân quyền của từng bên KH và CTV

> ✅ **ĐÃ SỬA (29/10/2026, commit `230e1b72`, đã đẩy lên `dev` và `main` – merge `5e847889`):** Client chỉ thấy phí dịch vụ, không còn thấy hoa hồng CTV (API `/warranties` không trả hoa hồng cho Client). CTV chỉ thấy hoa hồng của mình, không còn thấy mức phí dịch vụ của Client (API `/commissions` ẩn `baseAmount`). Internal HR/Admin vẫn thấy cả hai.

> ✅ **ĐÃ SỬA (commit `605cf27a`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** màn Chi tiết tiếp nhận việc hiện trạng thái bằng tiếng Việt (không còn IN_WARRANTY, ACTIVE, PAID) và bỏ khối "Thời gian thử việc / Tiến độ thử việc" (nhóm đã chốt 17/10 không làm thử việc).

Danh sách bảo hành ứng viên:

![][image9]  
Thêm 1 cột HOÀN PHÍ, khi bảo hành xong mà ko kiếm được người như thỏa thuận PHẢI HOÀN PHÍ như ban đầu ký kết hợp đồng nếu có (Thường sẽ hoàn lại 25% mức phí đã thanh toán trước đó).

> ❓ **Cần chốt (MF-05, Quí):** chưa có tính năng hoàn phí. Nếu làm: suất thay thế hết hạn mà chưa lấp → tạo phiếu hoàn phí và thêm cột "Hoàn phí"; tỷ lệ (25%) lấy từ thỏa thuận dịch vụ hoặc cấu hình, không ghi cứng.

Trong mục BẢO HÀNH này chỉ lọc thông tin Client sử dụng dịch vụ HEADHUNT  
Tổng công nợ phí dịch vụ \=\> Liệt kê tất cả phí dịch vụ khách hàng đã dùng để đánh giá dịch vụ của công ty và kh.  

> ✅ **ĐÃ SỬA (commit `0c487215` + `0ebd92b9`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** trang Bảo hành chỉ còn phí Headhunt (không lẫn cọc/quyết toán CV Sourcing); tiêu đề và mô tả suất thay thế dùng tên mới, bỏ con số "30 ngày" ghi cứng. ⬜ **Chưa làm:** trang "Tổng công nợ" riêng liệt kê phí của cả 3 dịch vụ.
![][image10]

## PHỎNG VẤN & OFFER

![][image11]

Ghi kết quả phỏng vấn: Nên bắt buộc trả lời lý do/ đánh giá

> ⏳ **Cần báo Sơn (MF-04), chưa ai làm:** bắt buộc nhập nhận xét khi ghi kết quả phỏng vấn (cả form lẫn kiểm tra ở backend).

![][image12]

CANH GIỮA DANH MỤC ỨNG VIÊN, TIN TUYỂN, VÒNG, THỜI GIAN, TRẠNG THÁI

> ✅ **ĐÃ SỬA (commit `08c17a96`, ĐANG TRÊN `dev`, chờ CI xanh rồi đưa lên `main`):** bảng Phỏng vấn / Offer / Đi làm căn giữa các cột Vòng, Thời gian, Ngày, Trạng thái (dùng chung cho Client và Internal HR). ✅ Đã sửa kèm (commit `01999f3f`, đã lên `dev` và `main`): trang Tiến độ tuyển dụng không còn bị sập khi chuyển sang tab Phỏng vấn / Offer.

![][image13]

[image1]: images/image1.png

[image2]: images/image2.png

[image3]: images/image3.png

[image4]: images/image4.png

[image5]: images/image5.png

[image6]: images/image6.png

[image7]: images/image7.png

[image8]: images/image8.png

[image9]: images/image9.png

[image10]: images/image10.png

[image11]: images/image11.png

[image12]: images/image12.png

[image13]: images/image13.png