# Candidate UI — mục lục tích hợp theo module

Bộ tài liệu này chia giao diện Candidate theo folder module. Dev hoàn thiện backend của module mình, sau đó đọc file tương ứng để biết chức năng nào đã có thể gắn UI, chức năng nào còn chờ và vị trí frontend cần sửa.

| Module | Tài liệu | Phần giao diện |
|---|---|---|
| MF-01 | [MF01/README.md](./MF01/README.md) | Tìm việc, chi tiết Job, thông báo |
| MF-02 | [MF02/README.md](./MF02/README.md) | Application list, consent, CV, email identity |
| MF-03 | [MF03/README.md](./MF03/README.md) | Tổng quan Candidate, AI/recommendation an toàn |
| MF-04 | [MF04/README.md](./MF04/README.md) | Profile, Application detail, Interview, Offer, Placement |

## Quy ước chung

- Tài liệu mô tả **business và trải nghiệm UI cần đạt**, không đóng băng thiết kế backend. Dev được sửa endpoint/DTO theo cách hợp lý hơn, nhưng phải cập nhật tài liệu, Swagger và type FE trước khi bàn giao.
- Không sửa chéo module. Nếu trang cần dữ liệu của module khác, thống nhất contract thay vì copy logic hoặc query bảng của nhau.
- FE dùng `src/services/api/<module>`, type ở `src/types/api`, TanStack Query cho server state và router tại `src/app/router.tsx`.
- Không dùng mock/localStorage làm nguồn dữ liệu nghiệp vụ sau khi API thật đã có.
- Quyền hành động lấy từ permission hoặc `allowedActions` backend trả; FE không tự suy luận quyền chỉ từ role/status.
- Mỗi trang phải có loading, empty, error, retry và xử lý rõ `403/404/409/429` nếu endpoint có thể trả các mã này.
- Dev bàn giao response mẫu thật, nullable fields, filter/sort, pagination, ownership, concurrency và test liên quan.

## Khi backend thay đổi so với tài liệu

Dev sở hữu module thực hiện cùng lúc:

1. Cập nhật Swagger và response mẫu.
2. Sửa mục “Contract FE cuối cùng” trong file của mình.
3. Cập nhật type và service FE tương ứng.
4. Nối UI, thêm test happy path + empty + lỗi nghiệp vụ quan trọng.
5. Ghi rõ route/trạng thái còn hoãn để dev sau không hiểu nhầm là đã hoàn thành.

Không yêu cầu backend phải giữ nguyên tên trường đề xuất trong tài liệu nếu có thiết kế tốt hơn; yêu cầu bắt buộc là dữ liệu đủ để UI thực hiện đúng business, không lộ dữ liệu nhạy cảm và không bắt FE tự đoán.
