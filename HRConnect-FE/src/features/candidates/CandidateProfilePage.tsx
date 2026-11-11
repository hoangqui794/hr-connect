/**
 * @file CandidateProfilePage.tsx
 * @description Candidate's profile (mockup 03/11) on /candidates/profile/me, its skills and the account avatar.
 *  CVs live in the CV vault. Fields without a control here (birth date, gender, unlisted work modes)
 *  are sent back unchanged when saving.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App as AntApp, AutoComplete, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Skeleton } from 'antd';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { candidateService, type CandidateSkillItemDto } from '@/services/candidateService';
import { mf04Api } from '@/services/api/mf04Api';
import { userApi } from '@/services/api/userApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { getAvatarImageUrl, getInitials, useAuthStore } from '@/stores/authStore';
import type { CandidateProfileData, UpdateCandidateProfileCommand } from '@/types/api/mf04';
import { CandidateAccountFrame } from '@/features/portal/candidate/CandidateAccountFrame';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const CARD = 'rounded-lg border border-solid border-[#E5E7EB] bg-white p-5';
const INPUT = `${FONT} h-[42px] w-full min-w-0 rounded-md border border-solid border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937]`;
const SELECT = `${FONT} h-[42px] w-full [&_.ant-select-selection-item]:!text-[#1F2937] [&_.ant-select-selector]:!rounded-md [&_.ant-select-selector]:!border-[#D1D5DB]`;
const LABEL = 'text-[13px] text-[#374151]';
const H2 = 'm-0 text-[16px] font-bold text-[#1F2937]';

const EDUCATION = ['Đại học', 'Thạc sĩ', 'Tiến sĩ', 'Cao đẳng', 'Khác'];
const LEVELS = [
  { value: 'Intern', label: 'Thực tập sinh' },
  { value: 'Fresher', label: 'Mới tốt nghiệp' },
  { value: 'Junior', label: 'Nhân viên sơ cấp' },
  { value: 'Mid-Level', label: 'Nhân viên' },
  { value: 'Senior', label: 'Chuyên viên cao cấp' },
  { value: 'Lead', label: 'Trưởng nhóm' },
  { value: 'Manager', label: 'Quản lý' },
  { value: 'Director', label: 'Giám đốc' },
];
const WORK_MODES = [
  { value: 'ONSITE', label: 'Tại văn phòng' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'REMOTE', label: 'Từ xa' },
];
const LOCATION_SUGGESTIONS = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Bình Dương', 'Toàn quốc'];
const SKILL_LEVELS = [
  { value: 'BEGINNER', label: 'Mới bắt đầu' },
  { value: 'INTERMEDIATE', label: 'Trung cấp' },
  { value: 'ADVANCED', label: 'Thành thạo' },
  { value: 'EXPERT', label: 'Chuyên gia' },
];
const MAX_LOCATIONS_LENGTH = 255;

interface ProfileForm {
  fullName: string;
  phone: string;
  currentAddress: string;
  highestEducation: string;
  yearsOfExperience: string;
  summary: string;
  currentJobTitle: string;
  currentLevel: string;
  targetRole: string;
  availableFrom: string;
  salaryMin: string;
  salaryMax: string;
  preferredLocations: string[];
  preferredWorkModes: string[];
}

/** The API may send these lists as an array or as comma-separated text. */
const toList = (value?: string[] | string | null) =>
  Array.isArray(value) ? value : (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

/** Salaries are stored in full; VND is edited in millions. */
const salaryUnit = (currency?: string | null) => ((currency ?? 'VND').toUpperCase() === 'VND' ? 1_000_000 : 1);

const toForm = (profile: CandidateProfileData | undefined, accountName?: string): ProfileForm => {
  const unit = salaryUnit(profile?.expectedSalaryCurrency);
  return {
    fullName: profile?.fullName || accountName || '',
    phone: profile?.phone || '',
    currentAddress: profile?.currentAddress || '',
    highestEducation: profile?.highestEducation || '',
    yearsOfExperience: profile?.yearsOfExperience != null ? String(profile.yearsOfExperience) : '',
    summary: profile?.summary || '',
    currentJobTitle: profile?.currentJobTitle || '',
    currentLevel: profile?.currentLevel || '',
    targetRole: profile?.targetRole || '',
    availableFrom: profile?.availableFrom?.slice(0, 10) || '',
    salaryMin: profile?.expectedSalaryMin ? String(profile.expectedSalaryMin / unit) : '',
    salaryMax: profile?.expectedSalaryMax ? String(profile.expectedSalaryMax / unit) : '',
    preferredLocations: toList(profile?.preferredLocations),
    preferredWorkModes: toList(profile?.preferredWorkModes),
  };
};

const validate = (form: ProfileForm) => {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  if (form.fullName.trim().length < 2) errors.fullName = 'Họ và tên phải có tối thiểu 2 ký tự.';
  if (form.phone.trim() && !/^[0-9+() \-.]{8,20}$/.test(form.phone.trim())) errors.phone = 'Số điện thoại không đúng định dạng.';
  const years = Number(form.yearsOfExperience);
  if (form.yearsOfExperience && !(years >= 0 && years <= 50)) errors.yearsOfExperience = 'Số năm kinh nghiệm phải từ 0 đến 50.';
  if (form.salaryMin && form.salaryMax && Number(form.salaryMax) < Number(form.salaryMin)) errors.salaryMax = 'Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.';
  if (form.availableFrom && new Date(`${form.availableFrom}T23:59:59`) < new Date()) errors.availableFrom = 'Ngày có thể nhận việc phải từ hôm nay trở đi.';
  if (form.preferredLocations.join(', ').length > MAX_LOCATIONS_LENGTH) errors.preferredLocations = 'Danh sách địa điểm quá dài.';
  return errors;
};

const skillYears = (years?: number | null) => {
  if (years == null) return '';
  return years > 0 && years < 1 ? `${Math.round(years * 12)} tháng` : `${years} năm`;
};

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <span role="alert" className="text-[12px] text-[#B91C1C]">{message}</span> : null;

const ProfileAvatar: React.FC = () => {
  const { message } = AntApp.useApp();
  const { user, updateUser, syncCurrentUser } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const avatarUrl = getAvatarImageUrl(user?.avatar);
  const initials = getInitials(user?.name || user?.email || 'User');

  useEffect(() => setFailed(false), [avatarUrl]);

  const upload = async (file?: File) => {
    if (!file || busy) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size >= 5 * 1024 * 1024) {
      message.error('Kích thước ảnh tối đa là 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const result = await userApi.uploadAvatar(file);
      message.success(result.message || 'Đã cập nhật ảnh đại diện.');
      if (result.data?.avatarUrl) updateUser({ avatar: result.data.avatarUrl });
      await syncCurrentUser();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải lên ảnh đại diện.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await userApi.deleteAvatar();
      message.success(result.message || 'Đã xóa ảnh đại diện.');
      updateUser({ avatar: initials });
      await syncCurrentUser();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xóa ảnh đại diện.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <span className="flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-sky-50 border border-sky-100 text-[26px] font-bold text-sky-700">
        {avatarUrl && !failed ? <img src={avatarUrl} alt={user?.name || 'Ảnh đại diện'} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : initials}
      </span>
      <button type="button" aria-label="Đổi ảnh đại diện" disabled={busy} onClick={() => input.current?.click()} className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-solid border-white bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm hover:from-sky-400 hover:to-blue-500 disabled:opacity-60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
      </button>
      {avatarUrl && (
        <Popconfirm title="Xóa ảnh đại diện?" okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy" disabled={busy} onConfirm={remove}>
          <button type="button" aria-label="Xóa ảnh đại diện" disabled={busy} className="absolute -bottom-1.5 -left-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-solid border-white bg-white text-[#B91C1C] shadow-sm hover:bg-[#FEF2F2]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </Popconfirm>
      )}
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        aria-label="Chọn ảnh đại diện"
        tabIndex={-1}
        className="absolute h-px w-px opacity-0"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
};


const INDUSTRY_SKILL_SUGGESTIONS: { category: string; skills: string[] }[] = [
  {
    category: 'Kế toán & Tài chính',
    skills: ['Kế toán tổng hợp', 'Kế toán thuế', 'Báo cáo tài chính', 'MISA', 'Excel nâng cao', 'Kiểm toán nội bộ'],
  },
  {
    category: 'Kinh doanh & Bán hàng',
    skills: ['Bán hàng B2B', 'Telesales', 'Chăm sóc khách hàng', 'Đàm phán thương mại', 'CRM', 'Phát triển thị trường'],
  },
  {
    category: 'Marketing & Truyền thông',
    skills: ['Digital Marketing', 'Content Creator', 'SEO / SEM', 'Chạy Ads', 'Thiết kế đồ họa (Canva/Photoshop)', 'Social Media'],
  },
  {
    category: 'Nhân sự & Hành chính',
    skills: ['Tuyển dụng nhân sự', 'C&B (Tiền lương)', 'Hành chính văn phòng', 'Đào tạo nội bộ', 'Quản lý hồ sơ'],
  },
  {
    category: 'Kỹ năng mềm & Ngoại ngữ',
    skills: ['Giao tiếp thuyết phục', 'Làm việc nhóm', 'Quản lý thời gian', 'Tiếng Anh giao tiếp', 'Tiếng Trung', 'Tiếng Nhật'],
  },
];

const SkillsSection: React.FC<{ skills: CandidateSkillItemDto[]; onChanged: () => Promise<unknown> }> = ({ skills, onChanged }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateSkillItemDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<'CATALOG' | 'CUSTOM'>('CATALOG');
  const [searchText, setSearchText] = useState('');

  const catalog = useQuery({
    queryKey: ['skills-catalog'],
    queryFn: async () => {
      const result = await candidateService.getCatalogSkills({ pageSize: 100 });
      return (result?.data?.items || result?.items || result?.data || []) as { skillId: string; skillName: string; category?: string | null }[];
    },
    enabled: open && !editing,
    staleTime: 5 * 60_000,
  });
  const ownedIds = new Set(skills.map((skill) => skill.skillId));
  const ownedNames = new Set(skills.map((skill) => (skill.skillName || '').trim().toLowerCase()));

  const openModal = (skill: CandidateSkillItemDto | null) => {
    setEditing(skill);
    form.resetFields();
    setInputMode('CATALOG');
    setSearchText('');
    form.setFieldsValue({
      skillId: skill?.skillId,
      customSkillName: '',
      proficiencyLevel: skill?.proficiencyLevel?.toUpperCase() || 'INTERMEDIATE',
      yearsOfExperience: skill?.yearsOfExperience ?? 1,
    });
    setOpen(true);
  };

  const run = async (action: () => Promise<unknown>, done: string, fallback: string) => {
    setSaving(true);
    try {
      await action();
      message.success(done);
      setOpen(false);
      await onChanged();
    } catch (error) {
      message.error(getApiErrorMessage(error, fallback));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const values = await form.validateFields();
    const body = {
      proficiencyLevel: values.proficiencyLevel,
      yearsOfExperience: values.yearsOfExperience != null ? Number(values.yearsOfExperience) : undefined,
    };

    if (editing?.skillId) {
      await run(
        () => candidateService.updateSkill(editing.skillId!, body),
        'Đã cập nhật kỹ năng.',
        'Không thể lưu kỹ năng.'
      );
      return;
    }

    if (inputMode === 'CUSTOM' || !values.skillId) {
      const name = (values.customSkillName || searchText || '').trim();
      if (!name) {
        message.warning('Vui lòng nhập tên kỹ năng.');
        return;
      }
      if (ownedNames.has(name.toLowerCase())) {
        message.warning('Kỹ năng này đã có trong hồ sơ của bạn.');
        return;
      }
      await run(
        () => candidateService.addSkill({ skillName: name, ...body }),
        'Đã thêm kỹ năng mới vào hồ sơ.',
        'Không thể lưu kỹ năng.'
      );
    } else {
      await run(
        () => candidateService.addSkill({ skillId: values.skillId, ...body }),
        'Đã thêm kỹ năng vào hồ sơ.',
        'Không thể lưu kỹ năng.'
      );
    }
  };

  const handlePickSuggestion = (skillName: string) => {
    const foundInCatalog = catalog.data?.find(
      (item) => item.skillName.trim().toLowerCase() === skillName.trim().toLowerCase()
    );
    if (foundInCatalog) {
      setInputMode('CATALOG');
      form.setFieldsValue({ skillId: foundInCatalog.skillId, customSkillName: '' });
    } else {
      setInputMode('CUSTOM');
      form.setFieldsValue({ customSkillName: skillName, skillId: undefined });
    }
  };

  return (
    <section aria-labelledby="skills" className={CARD}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id="skills" className={H2}>Kỹ năng</h2>
        <button type="button" onClick={() => openModal(null)} className={`${FONT} h-9 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] hover:bg-[#F9FAFB]`}>Thêm kỹ năng</button>
      </div>
      {skills.length === 0 ? (
        <p className="m-0 border-0 border-t border-solid border-[#F1F5F9] pt-3 text-[#4B5563]">Chưa có kỹ năng nào. Thêm kỹ năng để nhận gợi ý việc làm sát hơn.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {skills.map((skill) => (
            <li key={skill.skillId || skill.skillName} className="flex items-center gap-3 border-0 border-t border-solid border-[#F1F5F9] py-2.5">
              <span className="min-w-0 flex-1 font-medium">{skill.skillName || 'Kỹ năng'}</span>
              <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#374151]">
                {SKILL_LEVELS.find((level) => level.value === skill.proficiencyLevel?.toUpperCase())?.label ?? skill.proficiencyLevel ?? 'Chưa rõ'}
              </span>
              <span className="w-[70px] text-right text-[13px] text-[#6B7280]">{skillYears(skill.yearsOfExperience)}</span>
              <button type="button" aria-label={`Sửa kỹ năng ${skill.skillName ?? ''}`} onClick={() => openModal(skill)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#4B5563] hover:bg-[#F3F4F6]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        title={editing ? `Sửa kỹ năng: ${editing.skillName ?? ''}` : 'Thêm kỹ năng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? 'Lưu' : 'Thêm kỹ năng'}
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
        forceRender
        width={560}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div className="flex items-center justify-between">
            {editing?.skillId ? (
              <Popconfirm title="Xóa kỹ năng này khỏi hồ sơ?" okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy" onConfirm={() => run(() => candidateService.removeSkill(editing.skillId!), 'Đã xóa kỹ năng khỏi hồ sơ.', 'Không thể xóa kỹ năng.')}>
                <button type="button" className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[#B91C1C] hover:underline`}>Xóa kỹ năng</button>
              </Popconfirm>
            ) : <span />}
            <span className="flex gap-2"><CancelBtn /><OkBtn /></span>
          </div>
        )}
      >
        <Form form={form} layout="vertical" className="!mt-4">
          {!editing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Hình thức nhập:</span>
                <Radio.Group
                  size="small"
                  value={inputMode}
                  onChange={(e) => {
                    setInputMode(e.target.value);
                    if (e.target.value === 'CUSTOM' && searchText && !form.getFieldValue('customSkillName')) {
                      form.setFieldsValue({ customSkillName: searchText });
                    }
                  }}
                >
                  <Radio.Button value="CATALOG">Chọn từ danh mục</Radio.Button>
                  <Radio.Button value="CUSTOM">Tự nhập kỹ năng</Radio.Button>
                </Radio.Group>
              </div>

              {inputMode === 'CATALOG' ? (
                <Form.Item
                  name="skillId"
                  label="Chọn kỹ năng từ danh mục hệ thống"
                  extra={
                    <span className="text-xs text-slate-500">
                      Không tìm thấy kỹ năng của bạn?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('CUSTOM');
                          if (searchText) form.setFieldsValue({ customSkillName: searchText });
                        }}
                        className="text-blue-600 hover:underline border-0 bg-transparent p-0 cursor-pointer text-xs font-medium"
                      >
                        Bấm để tự nhập kỹ năng mới
                      </button>
                    </span>
                  }
                  rules={[{ required: inputMode === 'CATALOG', message: 'Vui lòng chọn kỹ năng hoặc bấm tự nhập.' }]}
                >
                  <Select
                    showSearch
                    loading={catalog.isLoading}
                    placeholder="Tìm kiếm kỹ năng (ví dụ: React, .NET, Docker...)"
                    optionFilterProp="label"
                    onSearch={setSearchText}
                    options={(catalog.data ?? [])
                      .filter((skill) => !ownedIds.has(skill.skillId))
                      .map((skill) => ({
                        value: skill.skillId,
                        label: skill.category ? `${skill.skillName} (${skill.category})` : skill.skillName,
                      }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  name="customSkillName"
                  label="Nhập tên kỹ năng (Áp dụng mọi ngành nghề: Kế toán, Sales, Marketing...)"
                  rules={[
                    { required: true, message: 'Vui lòng nhập tên kỹ năng.' },
                    { max: 120, message: 'Tên kỹ năng tối đa 120 ký tự.' },
                  ]}
                >
                  <Input
                    placeholder="Ví dụ: Kế toán thuế, Bán hàng B2B, Tiếng Anh giao tiếp, Photoshop..."
                    className="h-10"
                    maxLength={120}
                  />
                </Form.Item>
              )}

              {/* Gợi ý kỹ năng đa ngành nghề */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-700">Gợi ý kỹ năng đa ngành nghề (Bấm để chọn nhanh):</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {INDUSTRY_SKILL_SUGGESTIONS.map((grp) => (
                    <div key={grp.category} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-500 text-[11px] min-w-[115px]">{grp.category}:</span>
                      {grp.skills.map((sk) => {
                        const isOwned = ownedNames.has(sk.toLowerCase());
                        return (
                          <button
                            key={sk}
                            type="button"
                            disabled={isOwned}
                            onClick={() => handlePickSuggestion(sk)}
                            className={`rounded px-1.5 py-0.5 text-[11px] border cursor-pointer transition-colors ${
                              isOwned
                                ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:text-blue-600'
                            }`}
                          >
                            {sk} {isOwned ? '(Đã có)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Form.Item name="proficiencyLevel" label="Mức độ" rules={[{ required: true, message: 'Vui lòng chọn mức độ.' }]}>
            <Select options={SKILL_LEVELS} />
          </Form.Item>
          <Form.Item name="yearsOfExperience" label="Số năm kinh nghiệm">
            <InputNumber min={0} max={50} step={0.5} className="!w-full" placeholder="Ví dụ: 2" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
};

export const CandidateProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['candidate', 'profile'],
    queryFn: () => mf04Api.getProfile(),
  });

  const [form, setForm] = useState<ProfileForm>(() => toForm(undefined, user?.name));
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [addingLocation, setAddingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');

  const saved = useMemo(() => toForm(profile, user?.name), [profile, user?.name]);
  useEffect(() => {
    if (profile) setForm(saved);
  }, [profile, saved]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const visibility = useMutation({
    mutationFn: (next: 'PUBLIC' | 'PRIVATE') => mf04Api.updateVisibility({ visibility: next }),
    onSuccess: (_, next) => {
      message.success(next === 'PUBLIC' ? 'Hồ sơ đã chuyển sang công khai.' : 'Hồ sơ đã chuyển sang riêng tư.');
      void queryClient.invalidateQueries({ queryKey: ['candidate', 'profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể đổi chế độ hiển thị.')),
  });

  const save = useMutation({
    mutationFn: (command: UpdateCandidateProfileCommand) => mf04Api.updateProfile(command),
    onSuccess: (updated) => {
      message.success('Đã lưu hồ sơ.');
      void queryClient.invalidateQueries({ queryKey: ['candidate', 'profile'] });
      if (updated.fullName) updateUser({ name: updated.fullName });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không lưu được hồ sơ.')),
  });

  const submit = () => {
    const problems = validate(form);
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) {
      message.error('Vui lòng kiểm tra các ô được đánh dấu.');
      return;
    }
    const unit = salaryUnit(profile?.expectedSalaryCurrency);
    const text = (value: string) => value.trim() || null;
    save.mutate({
      fullName: form.fullName.trim(),
      phone: text(form.phone),
      dateOfBirth: profile?.dateOfBirth ?? null,
      gender: profile?.gender ?? null,
      currentAddress: text(form.currentAddress),
      highestEducation: form.highestEducation || null,
      yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : 0,
      summary: text(form.summary),
      currentJobTitle: text(form.currentJobTitle),
      currentLevel: form.currentLevel || null,
      targetRole: text(form.targetRole),
      expectedSalaryMin: form.salaryMin ? Number(form.salaryMin) * unit : null,
      expectedSalaryMax: form.salaryMax ? Number(form.salaryMax) * unit : null,
      expectedSalaryCurrency: profile?.expectedSalaryCurrency || 'VND',
      availableFrom: form.availableFrom || null,
      // The API stores these two as comma-separated text.
      preferredLocations: (form.preferredLocations.join(', ') || null) as unknown as string[] | null,
      preferredWorkModes: (form.preferredWorkModes.join(', ') || null) as unknown as string[] | null,
    });
  };

  const addLocation = (value: string) => {
    const location = value.trim();
    if (location && !form.preferredLocations.includes(location)) set('preferredLocations', [...form.preferredLocations, location]);
    setLocationDraft('');
    setAddingLocation(false);
  };

  if (isLoading) {
    return <CandidateAccountFrame><div className={CARD}><Skeleton active avatar paragraph={{ rows: 6 }} /></div></CandidateAccountFrame>;
  }
  if (isError) {
    return (
      <CandidateAccountFrame>
        <Alert type="error" showIcon message="Không thể tải hồ sơ" description={getApiErrorMessage(error)} action={<button type="button" onClick={() => refetch()} className={`${FONT} cursor-pointer border-0 bg-transparent font-semibold ${LINK}`}>Thử lại</button>} />
      </CandidateAccountFrame>
    );
  }

  const isPublic = (profile?.profileVisibility || 'PRIVATE').toUpperCase() === 'PUBLIC';
  const completion = Math.round(
    ([profile?.fullName, profile?.phone, profile?.currentAddress, profile?.currentJobTitle, profile?.targetRole, profile?.yearsOfExperience, profile?.summary, toList(profile?.preferredLocations).length]
      .filter(Boolean).length / 8) * 100,
  );
  const headline = [
    profile?.currentJobTitle,
    profile?.yearsOfExperience ? `${profile.yearsOfExperience} năm kinh nghiệm` : null,
    toList(profile?.preferredLocations)[0],
  ].filter(Boolean).join(' · ');
  const currency = (profile?.expectedSalaryCurrency || 'VND').toUpperCase();

  return (
    <CandidateAccountFrame>
      <div className="flex flex-col gap-4">
        <section aria-labelledby="me" className={`${CARD} flex flex-wrap items-center gap-[18px]`}>
          <ProfileAvatar />
          <div className="min-w-0 flex-[1_1_260px]">
            <h1 id="me" className="m-0 text-[20px] font-bold text-[#1F2937]">{profile?.fullName || user?.name}</h1>
            {headline && <div className="mt-0.5 text-[#4B5563]">{headline}</div>}
            <div className="mt-2.5 flex items-center gap-2.5">
              <div role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="Mức hoàn thiện hồ sơ" className="h-1.5 max-w-[260px] flex-1 rounded-[3px] bg-[#E5E7EB]">
                <div className="h-1.5 rounded-[3px] bg-[#0369A1]" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-[13px] text-[#374151]">Hồ sơ hoàn thiện {completion}%</span>
            </div>
          </div>
          <div className="flex flex-[1_1_240px] flex-col gap-2.5">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-solid border-[#E5E7EB] px-3 py-2.5">
              <span><b className="block">Công khai hồ sơ</b><span className="text-[12px] text-[#6B7280]">Nhà tuyển dụng tìm thấy bạn</span></span>
              <input type="checkbox" checked={isPublic} disabled={visibility.isPending} onChange={(event) => visibility.mutate(event.target.checked ? 'PUBLIC' : 'PRIVATE')} className="h-5 w-5 shrink-0 cursor-pointer accent-[#0369A1]" />
            </label>
          </div>
        </section>

        <section aria-labelledby="info" className={CARD}>
          <h2 id="info" className={`${H2} mb-[14px]`}>Thông tin cá nhân</h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Họ và tên <span className="text-[#B91C1C]">*</span></span>
              <input type="text" required maxLength={180} value={form.fullName} aria-invalid={Boolean(errors.fullName)} onChange={(event) => set('fullName', event.target.value)} className={INPUT} />
              <FieldError message={errors.fullName} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Email tài khoản</span>
              <input type="email" readOnly value={profile?.email || user?.email || ''} className={`${INPUT} !border-[#E5E7EB] !bg-[#F9FAFB] !text-[#4B5563]`} />
              <span className="text-[12px] text-[#6B7280]">Email đăng nhập cố định. Thêm email khác ở <Link to="/candidate/settings/email-identities" className={LINK}>Cài đặt email đăng nhập</Link>.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Số điện thoại</span>
              <input type="tel" value={form.phone} aria-invalid={Boolean(errors.phone)} onChange={(event) => set('phone', event.target.value)} className={INPUT} />
              <FieldError message={errors.phone} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Địa chỉ hiện tại</span>
              <input type="text" maxLength={500} value={form.currentAddress} onChange={(event) => set('currentAddress', event.target.value)} className={INPUT} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span id="education-label" className={LABEL}>Trình độ học vấn cao nhất</span>
              <Select
                aria-labelledby="education-label"
                allowClear
                placeholder="Chọn trình độ"
                value={form.highestEducation || undefined}
                onChange={(value) => set('highestEducation', value ?? '')}
                options={[...new Set([...EDUCATION, ...(form.highestEducation ? [form.highestEducation] : [])])].map((value) => ({ value, label: value }))}
                className={SELECT}
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Số năm kinh nghiệm</span>
              <input type="number" min={0} max={50} step={0.5} value={form.yearsOfExperience} aria-invalid={Boolean(errors.yearsOfExperience)} onChange={(event) => set('yearsOfExperience', event.target.value)} className={INPUT} />
              <FieldError message={errors.yearsOfExperience} />
            </label>
          </div>
        </section>

        <section aria-labelledby="goal" className={CARD}>
          <h2 id="goal" className={`${H2} mb-[14px]`}>Mục tiêu nghề nghiệp</h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Chức danh hiện tại</span>
              <input type="text" maxLength={150} value={form.currentJobTitle} onChange={(event) => set('currentJobTitle', event.target.value)} className={INPUT} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span id="level-label" className={LABEL}>Cấp bậc</span>
              <Select
                aria-labelledby="level-label"
                allowClear
                placeholder="Chọn cấp bậc"
                value={form.currentLevel || undefined}
                onChange={(value) => set('currentLevel', value ?? '')}
                options={LEVELS.some((level) => level.value === form.currentLevel) || !form.currentLevel ? LEVELS : [...LEVELS, { value: form.currentLevel, label: form.currentLevel }]}
                className={SELECT}
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Vị trí mong muốn</span>
              <input type="text" maxLength={150} value={form.targetRole} onChange={(event) => set('targetRole', event.target.value)} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Ngày có thể nhận việc</span>
              <input type="date" value={form.availableFrom} aria-invalid={Boolean(errors.availableFrom)} onChange={(event) => set('availableFrom', event.target.value)} className={INPUT} />
              <FieldError message={errors.availableFrom} />
            </label>
            <fieldset className="col-span-full m-0 min-w-0 border-0 p-0">
              <legend className={`${LABEL} mb-1.5 px-0.5`}>Mức lương mong muốn ({currency === 'VND' ? 'triệu VND' : currency}/tháng)</legend>
              <div className="flex max-w-[420px] items-center gap-2.5">
                <label className="relative min-w-0 flex-1">
                  <span className="absolute left-[-9999px]">Tối thiểu</span>
                  <input type="number" min={0} value={form.salaryMin} onChange={(event) => set('salaryMin', event.target.value)} className={INPUT} />
                </label>
                <span className="text-[#6B7280]">–</span>
                <label className="relative min-w-0 flex-1">
                  <span className="absolute left-[-9999px]">Tối đa</span>
                  <input type="number" min={0} value={form.salaryMax} aria-invalid={Boolean(errors.salaryMax)} onChange={(event) => set('salaryMax', event.target.value)} className={INPUT} />
                </label>
              </div>
              <FieldError message={errors.salaryMax} />
            </fieldset>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className={`${LABEL} mb-1.5 px-0.5`}>Địa điểm ưu tiên</legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {form.preferredLocations.map((location) => (
                  <span key={location} className="inline-flex items-center gap-1 rounded bg-[#E0F2FE] px-2.5 py-1 text-[13px] text-[#075985]">
                    {location}
                    <button type="button" aria-label={`Bỏ ${location}`} onClick={() => set('preferredLocations', form.preferredLocations.filter((item) => item !== location))} className="-my-1 -mr-1 h-5 w-5 cursor-pointer border-0 bg-transparent p-0 text-[#075985]">×</button>
                  </span>
                ))}
                {addingLocation ? (
                  <AutoComplete
                    autoFocus
                    defaultOpen
                    aria-label="Thêm địa điểm"
                    value={locationDraft}
                    onChange={setLocationDraft}
                    onSelect={addLocation}
                    onBlur={() => addLocation(locationDraft)}
                    onInputKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addLocation(locationDraft);
                      }
                    }}
                    options={LOCATION_SUGGESTIONS.filter((item) => !form.preferredLocations.includes(item)).map((value) => ({ value }))}
                    filterOption={(input, option) => String(option?.value).toLowerCase().includes(input.toLowerCase())}
                    className="w-[170px]"
                    placeholder="Nhập địa điểm"
                  />
                ) : (
                  <button type="button" onClick={() => setAddingLocation(true)} className={`${FONT} cursor-pointer rounded border border-dashed border-[#94A3B8] bg-white px-2.5 py-1 text-[13px] text-[#1F2937] hover:bg-[#F9FAFB]`}>+ Thêm</button>
                )}
              </div>
              <FieldError message={errors.preferredLocations} />
            </fieldset>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className={`${LABEL} mb-1.5 px-0.5`}>Chế độ làm việc</legend>
              <div className="flex flex-wrap gap-[14px]">
                {WORK_MODES.map((mode) => (
                  <label key={mode.value} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.preferredWorkModes.includes(mode.value)}
                      onChange={(event) => set('preferredWorkModes', event.target.checked ? [...form.preferredWorkModes, mode.value] : form.preferredWorkModes.filter((item) => item !== mode.value))}
                      className="mx-[3px] ml-1 my-[3px] h-[18px] w-[18px] cursor-pointer"
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="col-span-full flex flex-col gap-1.5">
              <span className={LABEL}>Giới thiệu bản thân</span>
              <textarea rows={3} maxLength={2000} value={form.summary} onChange={(event) => set('summary', event.target.value)} className={`${FONT} w-full resize-y rounded-md border border-solid border-[#D1D5DB] px-3 py-2.5 text-[14px] text-[#1F2937]`} />
            </label>
          </div>
        </section>

        <SkillsSection skills={profile?.skills ?? []} onChanged={refetch} />

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setForm(saved);
              setErrors({});
            }}
            className={`${FONT} h-11 cursor-pointer rounded-md border border-solid border-[#D1D5DB] bg-white px-[18px] text-[14px] text-[#1F2937] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Hủy thay đổi
          </button>
          <button type="button" disabled={save.isPending} onClick={submit} className={`${FONT} h-11 cursor-pointer rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-[22px] text-[14px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:from-sky-400 hover:to-blue-500 hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`}>
            {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
        </div>
      </div>
    </CandidateAccountFrame>
  );
};

export default CandidateProfilePage;
