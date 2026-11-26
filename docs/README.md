# Tài liệu dự án HR Connect

Tài liệu được phân tách rõ theo mục đích sử dụng và luôn đối chiếu trực tiếp với mã nguồn thực thi.

| Nhóm tài liệu | Vị trí | Nội dung |
|---|---|---|
| **Kiến trúc tổng thể** | [`architecture.md`](architecture.md) | Phạm vi hệ thống hiện hành, Tech stack thực tế, sơ đồ Clean Architecture (BE + FE + AI v2), 11 Background Workers và quy ước kỹ thuật. |
| **Luồng nghiệp vụ End-to-End** | [`../HRConnect/docs/main-flows.md`](../HRConnect/docs/main-flows.md) | Đặc tả chi tiết từng bước (Endpoint → Validator → Handler → DB → Event) kèm Mermaid Sequence Diagrams cho Auth & MF-01 → MF-05. |
| **Đặc tả sâu Backend theo MF** | [`../HRConnect/docs/`](../HRConnect/docs/) | Quy tắc phí 3 dịch vụ, cẩm nang API, nhật ký kiểm định và đặc tả chuyên sâu `MF01/` → `MF05/`. |
| **AI Service v2** | [`../ai-service-v2/README.md`](../ai-service-v2/README.md) | Pipeline chấm điểm đa nhà cung cấp LLM + Sentence-BERT, hậu kiểm bằng chứng, hàng đợi bền vững và trọng số động. |
| **Frontend** | [`../HRConnect-FE/docs/`](../HRConnect-FE/docs/) | Hợp đồng tích hợp API, cấu trúc màn hình và hướng dẫn giao diện theo vai trò. |
| **Sơ đồ hệ thống** | [`diagrams/`](diagrams/) | Source Mermaid/PlantUML, file draw.io tham khảo và ảnh render dùng trong báo cáo SRS/SDD. |

## Quy ước

- Thư mục và tên file dùng **MF/chức năng**, không dùng tên thành viên.
- Khi thay đổi endpoint, trạng thái nghiệp vụ hoặc cấu hình môi trường, bắt buộc cập nhật đồng bộ `architecture.md`, `HRConnect/docs/main-flows.md` và `README.md` gốc trong cùng nhánh.
