# Trang kho Candidate/CV của Affiliate

## Mục tiêu

Affiliate tái sử dụng Candidate/CV đã được Candidate đồng ý cho những Job mới mà không phải upload lại file.

Route FE đề xuất: `/affiliate/candidates` và `/affiliate/candidates/:candidateId`.

## Actor và quyền

- `candidate_library.view_own` để xem kho.
- `candidate_library.download_cv` để xem file.

Kho chỉ trả CV `ACTIVE` do chính Affiliate tải và đã từng được Candidate xác nhận trong Submission `ACCEPTED`.

## API

| API | UI |
|---|---|
| `GET /api/v1/affiliates/candidates?search=&page=&pageSize=&sortBy=&sortDirection=` | Danh sách Candidate |
| `GET /api/v1/affiliates/candidates/{candidateId}` | Chi tiết Candidate và các CV được phép dùng |
| `GET /api/v1/affiliates/candidates/{candidateId}/cvs/{cvId}/download-url` | Xem CV, URL hạn 5 phút |

## Bố cục trang

- Search theo thông tin Candidate được backend cho phép.
- Danh sách Candidate kèm lần submit gần nhất.
- Drawer/detail hiển thị các CV hợp lệ.
- Action **Nộp vào Job khác** mở form chọn Job rồi chuyển sang luồng submit kho.

## Chuyển sang submit

Khi người dùng chọn Candidate và CV, FE giữ:

```ts
{ candidateId, cvId }
```

Sau đó gọi `POST /api/v1/jobs/{jobId}/candidate-submissions` với đúng hai ID này và không gửi file/email/phone/fullName.

## Dữ liệu thay đổi trong lúc dùng

Candidate có thể thu hồi reuse sau khi trang đã tải. Nếu submit trả `409` hoặc `404`, FE reload detail và thông báo CV không còn được phép sử dụng; không tự chuyển sang upload file.

## Checklist

- [ ] Không hiện CV chưa consent, inactive hoặc của Affiliate khác.
- [ ] FE không cho người dùng tự sửa UUID.
- [ ] Download URL không được lưu lâu dài.
- [ ] Reuse bị thu hồi được xử lý bằng reload, không bypass.
