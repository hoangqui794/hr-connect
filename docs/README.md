# Tài liệu dự án HR Connect

Tài liệu được chia theo nơi sử dụng để tránh lẫn giữa Backend và Frontend.

| Nhóm tài liệu | Vị trí | Nội dung |
|---|---|---|
| Kế hoạch kỹ thuật | [`plans/`](plans/) | Kế hoạch triển khai, phân tích tác động và bằng chứng GitNexus. |
| Triển khai | [`deployment/`](deployment/) | CI/CD, môi trường production và dịch vụ lưu trữ. |
| Backend | [`../HRConnect/docs/`](../HRConnect/docs/) | Nghiệp vụ, kiến trúc, database và tài liệu triển khai API theo MF. |
| Frontend | [`../HRConnect-FE/docs/`](../HRConnect-FE/docs/) | Hợp đồng tích hợp API, hướng dẫn màn hình và tài liệu bàn giao cho FE. |

## Quy ước

- Thư mục và tên file dùng **MF/chức năng**, không dùng tên thành viên.
- Tài liệu mô tả cách FE gọi API phải nằm trong `HRConnect-FE/docs`.
- Tài liệu mô tả business rule, database hoặc backend implementation phải nằm trong `HRConnect/docs`.
- Kế hoạch có phạm vi toàn repository giữ tại `docs/plans`.
