# HR Connect – MF01 Job Management: Phạm vi và checklist local

> File làm việc cục bộ cho BE. Không stage, commit hoặc push GitHub.
>
> Phạm vi duy nhất: **MF01 – tạo, sửa, gửi duyệt, duyệt và quản lý Job**. Không bao gồm FE, submission, AI screening, interview, commission, payout hoặc payment.

## 1. Mục tiêu MF01

MF01 cho phép Client Company tạo và quản lý Job; Internal HR review Job trước khi Job được hoạt động theo Service Type.

Một Job chỉ có **một** địa điểm làm việc:

- `location`: địa chỉ/khu vực làm việc.
- `workingTime`: mô tả lịch làm việc tự do, ví dụ `Thứ 2–Thứ 6, 08:00–17:30`.
- Không dùng bảng `JobLocation` hay đa địa điểm trong phạm vi đề tài gốc.

## 2. Trường Job trong MF01

- Service Type.
- Title, description, benefits.
- Location, working time.
- Employment type, salary, currency, quantity.
- Visibility.
- Requirements và skills.
- Status, status history và lý do duyệt/từ chối.

## 3. Quy tắc nghiệp vụ cần giữ

1. Client chỉ tạo/sửa/quản lý Job thuộc Company của mình.
2. Internal HR review, approve hoặc reject theo permission.
3. Service Type chỉ được đổi khi Job còn `DRAFT` và chưa có Submission/Application.
4. Visibility chỉ hợp lệ khi khớp Service Type.
5. Visibility quyết định ai có thể thấy Job; Service Type quyết định actor nào có thể tham gia. Người dùng phải thỏa cả hai điều kiện.
6. `workingTime` là text, tối đa 2.000 ký tự; không xây hệ thống ca làm việc.
7. Job chỉ có một `location`; không thêm bảng con đa địa điểm.

## 4. Matrix Service Type và Visibility

| Service Type | Visibility hợp lệ | Diễn giải trong MF01 |
|---|---|---|
| `CV_APPLICATION` | `PUBLIC`, `INTERNAL_ONLY` | Job public cho Candidate khi `PUBLIC`. |
| `CV_SOURCING` | `PARTNER_ONLY`, `INTERNAL_ONLY` | Job sourcing không public cho Candidate. |
| `HEADHUNT_COD` | `PARTNER_ONLY`, `INTERNAL_ONLY` | Job headhunt không public cho Candidate. |

MF01 chỉ validate matrix này. Chi tiết ai submit Candidate thuộc MF02.

## 5. Checklist MF01

### Đã hoàn thành / cần giữ

- [x] Benefits trong Job.
- [x] Visibility: `PUBLIC`, `PARTNER_ONLY`, `INTERNAL_ONLY`.
- [x] Job access policy dùng chung cho xem list/detail/manage Job.
- [x] Validation Service Type/Visibility.
- [x] Khóa đổi Service Type sau khi Job có Submission/Application.
- [x] Quay về một `Job.Location`, không dùng `JobLocation` đa địa điểm.

### Cần hoàn thành hoặc kiểm tra lại

- [ ] Xác nhận migration cuối chỉ có `job.working_time` và không còn bảng `job_location`.
- [ ] Kiểm tra Create Job nhận/lưu/trả về `workingTime`.
- [ ] Kiểm tra Update Job cập nhật/trả về `workingTime`.
- [ ] Validate `workingTime` rỗng hoặc tối đa 2.000 ký tự.
- [ ] Kiểm tra Submit Job chỉ cho phép khi các trường bắt buộc của MF01 đã đủ.
- [ ] Manual Swagger test cho Create, Update, Submit, Approve, Reject Job.
- [ ] Test matrix sai: `CV_APPLICATION + PARTNER_ONLY`; `CV_SOURCING + PUBLIC`; `HEADHUNT_COD + PUBLIC` phải bị từ chối.
- [ ] Test quyền: Client chỉ quản lý Job của Company mình; Internal HR có quyền review; actor không phù hợp không thấy Job hạn chế.
- [ ] Kiểm tra Swagger chỉ hiển thị payload một location; không còn `locations`/`JobLocation`.

## 6. Không làm trong MF01

- Không tạo bảng tỉnh/thành hoặc dropdown FE.
- Không thêm nhiều địa điểm cho một Job.
- Không tạo Submission/Application/Candidate workflow.
- Không thêm Qualified, Delivered, Counted hoặc Backup.
- Không triển khai Interview, Offer, Placement.
- Không triển khai package, payment, invoice, commission hoặc payout.
