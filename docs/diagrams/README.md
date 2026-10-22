# Sơ đồ hệ thống HR Connect

Thư mục này lưu toàn bộ sơ đồ chính thức dùng trong SRS, SDD, Design Brief và Review 2.

## Cấu trúc

```text
diagrams/
├── context/            # Context diagram: actor và hệ thống bên ngoài
├── architecture/       # System overview, component và deployment
├── erd/                # Conceptual data model và logical ERD
├── state-machines/     # Vòng đời của các thực thể chính
├── workflows/          # Activity diagram của các main workflow
├── sequences/          # Sequence diagram khi cần mô tả tương tác API
└── use-cases/          # Use-case diagram và mapping actor - chức năng
```

Mỗi nhóm sơ đồ có hai thư mục:

- `source/`: file Mermaid (`.mmd`), PlantUML (`.puml`) và có thể giữ thêm `.drawio` để chỉnh sửa tham khảo.
- `rendered/`: ảnh `.svg` ưu tiên dùng trong tài liệu; chỉ dùng `.png` khi công cụ soạn thảo không hỗ trợ SVG.

## Quy tắc bắt buộc

1. Mỗi sơ đồ chính thức phải có source Mermaid hoặc PlantUML trong repository.
2. Hình trong Report phải được render từ đúng source đang commit, không chụp màn hình công cụ vẽ.
3. File `.drawio` chỉ là bản hỗ trợ chỉnh sửa, không thay thế source `.mmd` hoặc `.puml`.
4. Source và ảnh render phải dùng cùng tên gốc.
5. Khi sửa source phải render lại ảnh và commit cả hai file trong cùng commit.
6. Trước khi gắn tag `review-2`, kiểm tra diagram khớp Registration, SRS, SDD, database script và code.

Ví dụ:

```text
workflows/source/wf-mf02-affiliate-submission.puml
workflows/rendered/wf-mf02-affiliate-submission.svg
```

## Quy ước đặt tên

Tên file dùng chữ thường, dấu gạch ngang và bắt đầu bằng loại sơ đồ hoặc workflow ID:

```text
ctx-hr-connect-system.mmd
arch-system-overview.puml
erd-logical-overview.mmd
sm-application-lifecycle.puml
wf-mf02-affiliate-submission.puml
seq-ai-cv-scoring.puml
uc-candidate-portal.puml
```

## Gợi ý công cụ

- Mermaid phù hợp với context diagram, flowchart đơn giản và ERD.
- PlantUML phù hợp với activity diagram có swimlane, state machine, sequence và component diagram.
- Ưu tiên SVG để chữ và đường nối rõ khi xuất PDF.

## Checklist trước khi đưa vào Report

- [ ] Có file source `.mmd` hoặc `.puml`.
- [ ] Có file SVG/PNG cùng tên trong `rendered/`.
- [ ] Hình được render từ source mới nhất.
- [ ] Tên actor, entity, state và workflow thống nhất với SRS/SDD.
- [ ] ERD khớp database script.
- [ ] Mỗi main workflow có activity diagram và owner.
- [ ] Không chứa secret, token hoặc dữ liệu cá nhân thật.
