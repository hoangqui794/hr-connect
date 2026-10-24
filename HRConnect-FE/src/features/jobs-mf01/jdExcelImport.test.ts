import { describe, expect, it } from 'vitest';
import { parseJdWorkbook } from './jdExcelImport';

const general = (overrides: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    'Tên vị trí': 'Lập trình viên .NET',
    'Hình thức': 'Toàn thời gian',
    'Kinh nghiệm từ (năm)': 1,
    'Kinh nghiệm đến (năm)': 3,
    'Số lượng tuyển': 2,
    'Địa điểm': 'Hà Nội',
    'Thời gian làm việc': 'Thứ 2 - Thứ 6',
    'Lương từ': '20.000.000',
    'Lương đến': 30000000,
    'Tiền tệ': 'vnd',
    'Lương thỏa thuận': 'Không',
    'Ghi chú lương': 'Gross',
    'Mô tả công việc': 'Phát triển API',
    'Quyền lợi': 'Bảo hiểm đầy đủ',
    'Kỹ năng': 'C#, SQL; Docker',
    ...overrides,
  };
  return { sheet: 'Thông tin chung', data: [['Trường', 'Giá trị'], ...Object.entries(base).map(([k, v]) => [k, v as never])] };
};
const reqs = (rows: string[][]) => ({ sheet: 'Yêu cầu', data: [['Mức độ', 'Nội dung', 'Nhóm'], ...rows] });

describe('parseJdWorkbook', () => {
  it('maps the template sheets to form data, salary and skills included', () => {
    const r = parseJdWorkbook([general(), reqs([['Bắt buộc', 'Ít nhất 1 năm C#', 'Kinh nghiệm làm việc'], ['Ưu tiên', 'Biết Docker', '']])]);
    expect(r.errors).toEqual([]);
    expect(r.template?.title).toBe('Lập trình viên .NET');
    expect(r.template?.employmentType).toBe('FULL_TIME');
    expect(r.template?.requirements).toEqual([
      { requirementType: 'MUST_HAVE', content: 'Ít nhất 1 năm C#', category: 'EXPERIENCE' },
      { requirementType: 'SHOULD_HAVE', content: 'Biết Docker', category: 'OTHER' },
      { requirementType: 'SHOULD_HAVE', content: 'C#', category: 'SKILL' },
      { requirementType: 'SHOULD_HAVE', content: 'SQL', category: 'SKILL' },
      { requirementType: 'SHOULD_HAVE', content: 'Docker', category: 'SKILL' },
    ]);
    expect(r.terms).toEqual({
      salaryMin: 20000000, salaryMax: 30000000, salaryNegotiable: false, salaryNote: 'Gross',
      currencyCode: 'VND', location: 'Hà Nội', workingTime: 'Thứ 2 - Thứ 6', quantity: 2,
    });
    expect(r.template?.templateId).toBe('');
  });

  it('reports invalid requirement rows with their sheet line number', () => {
    const r = parseJdWorkbook([general(), reqs([['Bắt buộc', 'OK', ''], ['Quan trọng', 'Sai mức độ', ''], ['Ưu tiên', '', 'Nhóm lạ']])]);
    expect(r.template).toBeNull();
    expect(r.errors).toContain('Sheet "Yêu cầu", dòng 3: "Mức độ" phải là "Bắt buộc" hoặc "Ưu tiên".');
    expect(r.errors.some((e) => e.startsWith('Sheet "Yêu cầu", dòng 4: thiếu "Nội dung"'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('Sheet "Yêu cầu", dòng 4: "Nhóm" không hợp lệ'))).toBe(true);
  });

  it('rejects missing title/description, bad numbers and reversed ranges', () => {
    const r = parseJdWorkbook([
      general({ 'Tên vị trí': '', 'Mô tả công việc': '', 'Lương từ': 'abc', 'Kinh nghiệm từ (năm)': 5, 'Kinh nghiệm đến (năm)': 2 }),
      reqs([['Bắt buộc', 'Yêu cầu', '']]),
    ]);
    expect(r.template).toBeNull();
    expect(r.errors).toEqual(expect.arrayContaining([
      'Sheet "Thông tin chung": thiếu "Tên vị trí".',
      'Sheet "Thông tin chung": thiếu "Mô tả công việc".',
      'Sheet "Thông tin chung", ô "Lương từ": "abc" không phải số hợp lệ.',
      '"Kinh nghiệm từ (năm)" không được lớn hơn "Kinh nghiệm đến (năm)".',
    ]));
  });

  it('needs at least one requirement and warns when none is mandatory', () => {
    expect(parseJdWorkbook([general(), reqs([])]).errors).toContain('Sheet "Yêu cầu": cần ít nhất 1 yêu cầu.');
    const r = parseJdWorkbook([general(), reqs([['Ưu tiên', 'Biết tiếng Anh', '']])]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it('parses the downloadable template file without errors', async () => {
    const { default: readXlsxFile } = await import('read-excel-file/node');
    const sheets = await readXlsxFile(`${process.cwd()}/public/templates/HRConnect_JD_Template.xlsx`);
    const r = parseJdWorkbook(sheets);
    expect(r.errors).toEqual([]);
    expect(r.template?.title).toBe('Lập trình viên Backend .NET');
    expect(r.terms.salaryMin).toBe(20000000);
    expect(r.template?.requirements.filter((x) => x.requirementType === 'MUST_HAVE')).toHaveLength(2);
  });

  it('rejects salary ranges where the minimum is above the maximum', () => {
    const r = parseJdWorkbook([general({ 'Lương từ': 40000000 }), reqs([['Bắt buộc', 'Yêu cầu', '']])]);
    expect(r.errors).toContain('"Lương từ" không được lớn hơn "Lương đến".');
  });
});
