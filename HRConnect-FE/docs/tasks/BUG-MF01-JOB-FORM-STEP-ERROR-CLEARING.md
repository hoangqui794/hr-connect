# [Tài liệu Yêu cầu Chỉnh sửa] Lỗi Không Xóa Trạng Thái Lỗi (X) và Banner Cảnh Báo Sau Khi Bổ Sung Thông Tin Form Đăng Tin Tuyển Dụng (MF-01)

- **Mã lỗi / Yêu cầu:** `BUG-FE-MF01-STEP-ERROR-PERSISTENCE`
- **Module liên quan:** Client Console — Đăng tin tuyển dụng (MF-01)
- **Tập tin nguồn:** [`HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx`](file:///d:/Ki_9/HRConnect/HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx)
- **Mức độ nghiêm trọng:** High (Ảnh hưởng trực tiếp đến trải nghiệm người dùng / UX gây hiểu nhầm rằng form vẫn bị lỗi dù đã điền đúng)

---

## 1. Mô tả hiện tượng lỗi (Bug Description)

1. **Bước 1:** Người dùng tạo mới tin tuyển dụng, chưa nhập thông tin ở Bước 1 & Bước 2 và nhấn nút **"Gửi duyệt"** (`save(true)`).
2. **Hệ thống phản hồi (Đúng thiết kế ban đầu):**
   - Thanh điều hướng 4 bước (Stepper) hiển thị biểu tượng **(X) màu đỏ** ở Bước 1 (*Chọn dịch vụ*) và Bước 2 (*Mô tả công việc*).
   - Xuất hiện khối cảnh báo màu đỏ (`Alert type="error"`): *"Chưa lưu được tin tuyển dụng"* kèm danh sách các trường còn thiếu (Chọn dịch vụ, Tên vị trí, Hình thức, Địa điểm, Mô tả, Quyền lợi, Yêu cầu bắt buộc,...).
3. **Bước 2 (Phát sinh lỗi):** Người dùng quay lại Bước 1 và Bước 2, nhập đầy đủ toàn bộ các thông tin bắt buộc.
   - Widget bên phải *"Mức độ hoàn thiện"* cập nhật chính xác: **88% (7/8 mục cần khi gửi duyệt)**, tất cả các mục của Bước 1 và 2 đều hiển thị dấu tích xanh.
   - **LỖI:**
     - Biểu tượng **(X) màu đỏ** trên Bước 1 và Bước 2 ở thanh Stepper **vẫn không biến mất**.
     - Khối thông báo màu đỏ *"Chưa lưu được tin tuyển dụng"* ở đầu trang **vẫn hiển thị nguyên vẹn danh sách các trường thiếu**, mặc dù người dùng thực tế đã nhập xong các trường đó.

---

## 2. Phân tích nguyên nhân cốt lõi (Root Cause Analysis)

Vấn đề nằm tại cơ chế quản trị trạng thái lỗi trong [`JobFormPage.tsx`](file:///d:/Ki_9/HRConnect/HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx):

1. **State `stepErrors` và `errorSummary` bị đóng băng (Stale State):**
   - Khai báo tại dòng 470:
     ```typescript
     const [stepErrors, setStepErrors] = useState<Record<number, boolean>>({});
     const [errorSummary, setErrorSummary] = useState<string[]>([]);
     ```
   - Hai state này **chỉ được cập nhật duy nhất một lần** khi người dùng nhấn nút *"Gửi duyệt"* bên trong hàm `save(andSubmit: boolean)` (dòng 720-757):
     ```typescript
     if (andSubmit) {
       const blockers = submitBlockers(formValues, effectiveCode, Boolean(effectiveServiceId));
       if (blockers.length > 0) {
         blockers.forEach((b) => {
           newStepErrors[b.step] = true;
         });
         setStepErrors(newStepErrors);
         ...
         setErrorSummary([
           'Chưa đủ thông tin bắt buộc để gửi duyệt (bạn vẫn có thể chọn "Lưu nháp"):',
           ...blockers.map((b) => b.message),
         ]);
         return;
       }
     }
     ```
2. **Thiếu cơ chế làm mới (Revalidation / Clearing):**
   - Khi người dùng gõ phím hoặc thay đổi các trường trong Form (`form.onValuesChange` hoặc `Form.useWatch`), hệ thống không cập nhật lại `stepErrors` hay `errorSummary`.
   - Cấu hình của Steps (dòng 846-867):
     ```typescript
     const stepsConfig = [
       { title: 'Chọn dịch vụ', status: stepErrors[0] ? ('error' as const) : undefined },
       { title: 'Mô tả công việc', status: stepErrors[1] ? ('error' as const) : undefined },
       ...
     ];
     ```
     Do `stepErrors[0]` và `stepErrors[1]` vẫn giữ giá trị `true`, Stepper tiếp tục hiển thị trạng thái `error` (dấu X đỏ) cho đến khi có một lượt nhấn nút submit mới.

---

## 3. Yêu cầu & Giải pháp đề xuất (Proposed Solutions)

Có 2 phương án xử lý kỹ thuật đề xuất cho đội ngũ Frontend:

### Phương án 1 (Khuyên dùng): Tính toán động (Derived State) dựa trên `checklist` và cờ `hasAttemptedSubmit`

Không duy trì `stepErrors` như một state tĩnh tách rời, mà dẫn xuất (derive) trực tiếp từ `checklist` hiện có:

1. Thêm state cờ đánh dấu người dùng đã từng bấm submit:
   ```typescript
   const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
   ```
2. Khi người dùng bấm submit và bị chặn, set `hasAttemptedSubmit(true)`.
3. Trạng thái lỗi của từng bước được tính tự động:
   * Một bước chỉ bị coi là `error` nếu:
     `hasAttemptedSubmit === true` VÀ `checklist.some(item => item.step === stepIndex && !item.done)`
   * Ví dụ trong `stepsConfig`:
     ```typescript
     const isStepHasError = (stepIdx: number) => {
       if (!hasAttemptedSubmit) return false;
       return checklist.some((item) => item.step === stepIdx && !item.done);
     };

     const stepsConfig = [
       {
         title: 'Chọn dịch vụ',
         status: isStepHasError(0) ? 'error' : undefined,
       },
       {
         title: 'Mô tả công việc',
         status: isStepHasError(1) ? 'error' : undefined,
       },
       ...
     ];
     ```
   * **Ưu điểm:** Khi người dùng điền đủ thông tin Bước 1 & Bước 2, `checklist` tự động nhận biết `item.done === true`, dấu (X) đỏ trên bước đó lập tức biến mất trong thời gian thực (real-time feedback).

### Phương án 2: Tự động lọc `errorSummary` và dọn `stepErrors` khi giá trị Form thay đổi

1. Sử dụng thuộc tính `onValuesChange` của Ant Design `<Form>` hoặc một `useEffect` theo dõi `watched`:
   ```typescript
   useEffect(() => {
     if (errorSummary.length === 0 && Object.keys(stepErrors).length === 0) return;

     const currentBlockers = submitBlockers(form.getFieldsValue(), effectiveCode, Boolean(effectiveServiceId));
     
     // Cập nhật lại stepErrors
     const updatedStepErrors: Record<number, boolean> = {};
     currentBlockers.forEach((b) => {
       updatedStepErrors[b.step] = true;
     });
     setStepErrors(updatedStepErrors);

     // Cập nhật lại banner cảnh báo hoặc xóa nếu đã hết lỗi
     if (currentBlockers.length === 0) {
       setErrorSummary([]);
     } else {
       setErrorSummary([
         'Chưa đủ thông tin bắt buộc để gửi duyệt (bạn vẫn có thể chọn "Lưu nháp"):',
         ...currentBlockers.map((b) => b.message),
       ]);
     }
   }, [watched, effectiveCode, effectiveServiceId]);
   ```
2. Khi người dùng hoàn thiện đầy đủ mọi mục của Bước nào, Bước đó sẽ tự xóa cờ lỗi, và banner tổng thể sẽ tự động loại bỏ dòng nhắc nhở của mục đó.

---

## 4. Tiêu chí nghiệm thu (Acceptance Criteria / Test Cases)

- [ ] **TC-01 (Hiển thị lỗi ban đầu):** Để trống form -> Bấm "Gửi duyệt" -> Hiển thị dấu (X) đỏ ở các bước chưa đạt và hiển thị banner lỗi.
- [ ] **TC-02 (Tự động xóa lỗi từng bước):** 
  - Quay lại Bước 1 chọn dịch vụ -> Dấu (X) đỏ ở Bước 1 biến mất ngay lập tức.
  - Quay lại Bước 2 điền đầy đủ tiêu đề, JD, quyền lợi, yêu cầu bắt buộc -> Dấu (X) đỏ ở Bước 2 biến mất ngay lập tức.
- [ ] **TC-03 (Cập nhật banner cảnh báo):** 
  - Các dòng thông báo tương ứng trong banner màu đỏ tự động biến mất khi người dùng đã điền trường đó.
  - Khi đã điền đủ tất cả các trường bị thiếu, banner màu đỏ tự động đóng/ẩn hoàn toàn.
- [ ] **TC-04 (Lưu nháp không bị chặn):** 
  - Thao tác "Lưu nháp" vẫn hoạt động bình thường kể cả khi đang có lỗi validation submit.
