# Tài liệu Backend HR Connect

## 1. Kiến trúc và Nghiệp vụ Chung

- [`../../docs/architecture.md`](../../docs/architecture.md): **Đặc tả Kiến trúc Hệ thống Toàn diện** — phạm vi hệ thống, Tech stack, sơ đồ Clean Architecture, 11 Background Workers & quy ước kỹ thuật.
- [`BACKEND-FLOWS-AND-API-GUIDE.md`](BACKEND-FLOWS-AND-API-GUIDE.md): **Bản đồ tổng Backend** — giải thích toàn bộ MF-01 → MF-05, API, trạng thái, dữ liệu và đường đi code cho Developer / QA / AI Agent.
- [`main-flows.md`](main-flows.md): Đặc tả luồng nghiệp vụ chính (MF-01 → MF-05) và các luồng bổ trợ (SF-01 → SF-09).
- [`3. ACTOR — CÁC TÁC NHÂN CỦA HỆ THỐNG.md`](3.%20ACTOR%20%E2%80%94%20C%C3%81C%20T%C3%81C%20NH%C3%82N%20C%E1%BB%A6A%20H%E1%BB%86%20TH%E1%BB%90NG.md): Ma trận Actor và trách nhiệm của 5 vai trò.
- [`QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md): Quy tắc phí dịch vụ, đặt cọc, bảo hành, suất thay thế và hoa hồng của 3 gói dịch vụ (`HEADHUNT_COD`, `CV_SOURCING`, `CV_APPLICATION`).
- [`shared-audit-logging.md`](shared-audit-logging.md): Chuẩn ghi nhật ký hệ thống (`AuditLog`) và truy vết thay đổi.

---

## 2. Đặc tả Chi tiết & Kiểm định theo từng Main Flow

| Phân hệ | Tài liệu Đặc tả (`README.md`) | Báo cáo Kiểm định (`review.md`) | Nội dung cốt lõi |
| :--- | :--- | :--- | :--- |
| **MF-01** | [`MF01/README.md`](MF01/README.md) | [`MF01/review.md`](MF01/review.md) | Quản lý Tin tuyển dụng, Thư viện mẫu JD, Duyệt tin, Hợp đồng dịch vụ (`ServiceAgreement` ký OTP / ký ướt), Phí đăng tin & Đặt cọc. |
| **MF-02** | [`MF02/README.md`](MF02/README.md) | [`MF02/review.md`](MF02/review.md) | Ứng tuyển trực tiếp, Kho CV & CV Builder PDF, Affiliate giới thiệu, Xác nhận Consent, Attribution & Chống trùng danh tính (`CandidateDuplicateCases`). |
| **MF-03** | [`MF03/README.md`](MF03/README.md) | [`MF03/review.md`](MF03/review.md) | Chấm điểm AI bất đồng bộ (`ai-service-v2`), Hậu kiểm bằng chứng, Tiền sàng lọc theo dịch vụ, Giao & Nghiệm thu CV Sourcing, Gợi ý việc làm tự động. |
| **MF-04** | [`MF04/README.md`](MF04/README.md) | [`MF04/review.md`](MF04/review.md) | Company-Owned Hiring Flow: Phỏng vấn đa vòng, Offer phiên bản hóa, Xác nhận đi làm (`Placement`) & Đối soát độc lập của Internal HR (UC-41). |
| **MF-05** | [`MF05/README.md`](MF05/README.md) | [`MF05/review.md`](MF05/review.md) | Công nợ phí dịch vụ, Thanh toán VNPay, Bảo hành 30 ngày, Suất tuyển thay thế (`ReplacementSlot`), Quyết toán Sourcing, Hoa hồng, Khiếu nại (`Dispute`) & Payout. |

---

## 3. Hướng dẫn Kiểm thử & Triển khai

- [`HUONG-DAN-TEST-FE-MF01-MF05.md`](HUONG-DAN-TEST-FE-MF01-MF05.md): Hướng dẫn kiểm thử tích hợp toàn luồng MF-01 → MF-05 trên giao diện.
- [`HUONG-DAN-TEST-MF05-CHO-TESTER.md`](HUONG-DAN-TEST-MF05-CHO-TESTER.md): Kịch bản kiểm thử chuyên sâu cho Tài chính, Bảo hành & Hoa hồng (MF-05).
- [`deploy/`](deploy/): Hướng dẫn triển khai Render, Cloud Server và Cloudflare Tunnel cho AI Service.
- Tài liệu hướng dẫn tích hợp Frontend đặt tại [`../../HRConnect-FE/docs/`](../../HRConnect-FE/docs/).
