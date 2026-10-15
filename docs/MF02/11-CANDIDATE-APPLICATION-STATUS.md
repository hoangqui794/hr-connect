# Trạng thái Application hiển thị cho Candidate

Ba màn hình Candidate phải dùng cùng một hợp đồng trạng thái công khai:

- Danh sách đơn: `GET /api/v1/candidates/applications`
- Chi tiết đơn: `GET /api/v1/candidates/applications/{applicationId}`
- Lịch sử dùng CV Affiliate: `GET /api/v1/candidates/me/affiliate-cvs/{cvId}/usages`

## Trường FE được phép dùng

- Danh sách và chi tiết: `displayGroup`, `displayLabel`.
- Lịch sử CV: `applicationDisplayGroup`, `applicationDisplayLabel`; hai trường là `null` khi Submission chưa tạo Application.
- Không đọc hoặc tự suy luận `status`, `currentStage`, `statusReason`, `applicationStatus` hay `applicationCurrentStage`.

Các nhóm hợp lệ: `SUBMITTED`, `IN_REVIEW`, `INTERVIEW`, `OFFER`, `HIRED`, `NOT_SELECTED`, `WITHDRAWN`.

FE hiển thị badge bằng `displayLabel`; dùng `displayGroup` cho màu, bộ lọc và điều hướng. `OFFER` chỉ xuất hiện sau khi thư mời thật sự đã được gửi.

## Bộ lọc danh sách

Query `status` của API danh sách nhận **nhóm công khai** ở trên. Không gửi mã workflow nội bộ như `SCREENING`, `BACKUP` hoặc `OFFER_PENDING`.

## Lưu ý phát hành

Đây là thay đổi response có chủ đích. BE và FE phải phát hành cùng phiên bản để không còn giao diện đọc trường `status` cũ.
