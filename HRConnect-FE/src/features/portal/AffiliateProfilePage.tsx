/**
 * @file AffiliateProfilePage.tsx
 * @description Affiliate Partner Profile, Bank Account settings (MF-02 & payout setup), and security.
 * Backed by:
 *  - GET / PUT /api/v1/affiliates/profile/me
 *  - GET / PUT /api/v1/affiliates/profile/me/bank-account
 *  - PUT /api/v1/auth/change-password
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  LockOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  affiliateApi,
  UpdateAffiliateBankAccountInput,
  UpdateAffiliateProfileInput,
} from '@/services/api/mf02Api';
import { authService, ChangePasswordCommand } from '@/services/authService';
import { getApiErrorMessage } from '@/services/apiClient';
import { Surface } from '@/features/admin-console/ui';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { AffiliatePageHeader } from './affiliate/AffiliateUi';

const { Title, Text, Paragraph } = Typography;

const VIETNAM_BANKS = [
  { label: 'Vietcombank (Ngoại thương Việt Nam)', value: 'Vietcombank' },
  { label: 'Techcombank (Kỹ thương Việt Nam)', value: 'Techcombank' },
  { label: 'MB Bank (Quân đội)', value: 'MB Bank' },
  { label: 'ACB (Á Châu)', value: 'ACB' },
  { label: 'VPBank (Việt Nam Thịnh Vượng)', value: 'VPBank' },
  { label: 'BIDV (Đầu tư và Phát triển)', value: 'BIDV' },
  { label: 'VietinBank (Công thương Việt Nam)', value: 'VietinBank' },
  { label: 'TPBank (Tiên Phong)', value: 'TPBank' },
  { label: 'VIB (Quốc tế)', value: 'VIB' },
  { label: 'Sacombank (Sài Gòn Thương Tín)', value: 'Sacombank' },
  { label: 'HDBank (Phát triển TP.HCM)', value: 'HDBank' },
  { label: 'OCB (Phương Đông)', value: 'OCB' },
  { label: 'MSB (Hàng Hải)', value: 'MSB' },
  { label: 'SHB (Sài Gòn - Hà Nội)', value: 'SHB' },
];

export const AffiliateProfilePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');

  // Queries
  const profileQuery = useQuery({
    queryKey: ['aff-profile-detail'],
    queryFn: () => affiliateApi.profile(),
  });

  const bankQuery = useQuery({
    queryKey: ['aff-bank-account'],
    queryFn: () => affiliateApi.getBankAccount(),
  });

  // Forms
  const [profileForm] = Form.useForm<UpdateAffiliateProfileInput>();
  const [bankForm] = Form.useForm<UpdateAffiliateBankAccountInput>();
  const [passwordForm] = Form.useForm<ChangePasswordCommand>();
  const [changingPassword, setChangingPassword] = useState(false);

  // Sync profile form values
  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      profileForm.setFieldsValue({
        displayName: p.displayName ?? '',
        contactPerson: (p as any).contactPerson ?? '',
        phone: p.phone ?? '',
        address: p.address ?? '',
        taxInformation: (p as any).taxInformation ?? '',
      });
    }
  }, [profileQuery.data, profileForm]);

  // Sync bank form values
  useEffect(() => {
    if (bankQuery.data) {
      const b = bankQuery.data;
      bankForm.setFieldsValue({
        bankName: b.bankName ?? '',
        bankAccountNumber: b.bankAccountNumber ?? '',
        bankAccountHolder: b.bankAccountHolder ?? '',
        bankBranch: b.bankBranch ?? '',
      });
    }
  }, [bankQuery.data, bankForm]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (values: UpdateAffiliateProfileInput) => affiliateApi.updateProfile(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Cập nhật hồ sơ đối tác thành công!');
      queryClient.invalidateQueries({ queryKey: ['aff-profile-detail'] });
      queryClient.invalidateQueries({ queryKey: ['aff-profile'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể cập nhật hồ sơ đối tác!')),
  });

  const updateBankMutation = useMutation({
    mutationFn: (values: UpdateAffiliateBankAccountInput) => affiliateApi.updateBankAccount(values),
    onSuccess: (res) => {
      message.success(res?.message || 'Cập nhật tài khoản ngân hàng thành công!');
      queryClient.invalidateQueries({ queryKey: ['aff-bank-account'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể cập nhật tài khoản ngân hàng!')),
  });

  const handleChangePassword = async (values: ChangePasswordCommand) => {
    try {
      setChangingPassword(true);
      const res = await authService.changePassword(values);
      message.success(res?.message || 'Đổi mật khẩu thành công!');
      passwordForm.resetFields();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Đổi mật khẩu thất bại! Vui lòng kiểm tra lại mật khẩu hiện tại.'));
    } finally {
      setChangingPassword(false);
    }
  };

  const p = profileQuery.data;
  const b = bankQuery.data;
  const bankHolderWatched = Form.useWatch('bankAccountHolder', bankForm) || b?.bankAccountHolder || '';
  const bankNumberWatched = Form.useWatch('bankAccountNumber', bankForm) || b?.bankAccountNumber || '';
  const bankNameWatched = Form.useWatch('bankName', bankForm) || b?.bankName || '';
  const bankBranchWatched = Form.useWatch('bankBranch', bankForm) || b?.bankBranch || '';

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <UserOutlined />
          Thông tin cá nhân
        </span>
      ),
      children: (
        <div className="space-y-6 pt-2">
          {profileQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : profileQuery.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(profileQuery.error)} />
          ) : (
            <Row gutter={[32, 24]}>
              <Col xs={24} md={8} className="flex flex-col items-center">
                <Surface padded className="w-full flex flex-col items-center text-center">
                  <AvatarUpload size={96} />
                  <div className="mt-4">
                    <div className="font-bold text-lg text-slate-900">{p?.displayName || 'Đối tác'}</div>
                    <div className="text-sm text-slate-500">{p?.email}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                    <Tag color={p?.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {{ ACTIVE: 'Đang hoạt động', PENDING: 'Chờ duyệt', REJECTED: 'Chưa được chấp thuận', SUSPENDED: 'Tạm ngưng' }[p?.status ?? 'PENDING'] ?? 'Đang cập nhật'}
                    </Tag>
                    {p?.affiliateType && (
                      <Tag color="blue">
                        {p.affiliateType === 'STANDARD' ? 'Cộng tác viên tiêu chuẩn' : p.affiliateType}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-0 border-t border-solid border-slate-100 w-full text-xs text-slate-400 space-y-1">
                    <div>Ngày tham gia: {dayjs(p?.createdAt).format('DD/MM/YYYY')}</div>
                    {p?.verifiedAt && <div>Đã xác thực: {dayjs(p.verifiedAt).format('DD/MM/YYYY')}</div>}
                  </div>
                </Surface>
              </Col>

              <Col xs={24} md={16}>
                <Surface padded>
                  <Title level={5} className="!mb-4 text-slate-800">
                    Thông tin liên hệ
                  </Title>
                  <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={(vals) => updateProfileMutation.mutate(vals)}
                    disabled={updateProfileMutation.isPending}
                    requiredMark={false}
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="displayName"
                          label="Tên hiển thị"
                          rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                        >
                          <Input placeholder="Ví dụ: Nguyễn Văn A hoặc Tuyển dụng ABC" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="contactPerson" label="Người liên hệ chính">
                          <Input placeholder="Họ và tên người phụ trách" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="phone"
                          label="Số điện thoại liên hệ"
                          rules={[{ pattern: /^[0-9+-\s]{8,15}$/, message: 'Số điện thoại không hợp lệ!' }]}
                        >
                          <Input prefix={<PhoneOutlined className="text-slate-400" />} placeholder="0901234567" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="taxInformation" label="Mã số thuế (không bắt buộc)">
                          <Input placeholder="Dùng khi cần xuất chứng từ khấu trừ" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item name="address" label="Địa chỉ liên lạc">
                      <Input placeholder="Địa chỉ văn phòng hoặc nơi cư trú" />
                    </Form.Item>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        htmlType="submit"
                        loading={updateProfileMutation.isPending}
                        className="!rounded-lg"
                      >
                        Lưu thông tin hồ sơ
                      </Button>
                    </div>
                  </Form>
                </Surface>
              </Col>
            </Row>
          )}
        </div>
      ),
    },
    {
      key: 'bank',
      label: (
        <span className="flex items-center gap-2">
          <BankOutlined />
          Nhận tiền hoa hồng
        </span>
      ),
      children: (
        <div className="space-y-6 pt-2">
          <Row gutter={[32, 24]}>
            {/* Fintech Payment Summary Card */}
            <Col xs={24} lg={10}>
              <div className="sticky top-24 space-y-4">
                <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-0 border-b border-solid border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-solid border-emerald-100 font-bold text-base">
                        <BankOutlined />
                      </span>
                      <div>
                        <div className="text-[11px] uppercase font-semibold text-slate-400">Ngân hàng thụ hưởng</div>
                        <div className="text-sm font-bold text-slate-900 leading-tight">
                          {bankNameWatched || 'Chưa cập nhật'}
                        </div>
                      </div>
                    </div>
                    {bankNumberWatched ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-solid border-emerald-200/60">
                        ✓ Đã lưu tài khoản
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-solid border-amber-200/60">
                        Chưa thiết lập tài khoản
                      </span>
                    )}
                  </div>

                  {/* 2-column info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Số tài khoản</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-slate-900 tracking-wider">
                          {bankNumberWatched || 'Chưa cập nhật'}
                        </span>
                        {bankNumberWatched && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bankNumberWatched);
                              message.success('Đã sao chép số tài khoản');
                            }}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-solid border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-400 bg-white transition-colors cursor-pointer"
                            title="Sao chép số tài khoản"
                            aria-label="Sao chép số tài khoản"
                          >
                            <CopyOutlined className="text-xs" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Chủ tài khoản</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700 uppercase truncate">
                        {bankHolderWatched ? String(bankHolderWatched).toUpperCase() : 'Chưa cập nhật'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Chi nhánh</div>
                      <div className="mt-1 text-sm text-slate-600 truncate">
                        {bankBranchWatched || 'Chưa cập nhật'}
                      </div>
                    </div>
                  </div>

                  {/* Security callout */}
                  <div className="mt-5 bg-blue-50/60 border border-solid border-blue-100 text-blue-800 text-xs rounded-lg p-3 leading-relaxed flex items-start gap-2.5">
                    <SafetyCertificateOutlined className="mt-0.5 text-blue-600 shrink-0 text-sm" />
                    <div>
                      HR Connect chuyển hoa hồng định kỳ vào tài khoản này sau khi tuyển dụng hoàn tất. Vui lòng đảm bảo thông tin chính xác và trùng khớp với CCCD/CMND.
                    </div>
                  </div>
                </div>
              </div>
            </Col>

            {/* Bank Form */}
            <Col xs={24} lg={14}>
              <Surface padded>
                <Title level={5} className="!mb-1 text-slate-800">
                  Thông tin tài khoản ngân hàng
                </Title>
                <Text type="secondary" className="block mb-5 text-xs">
                  Tài khoản phải thuộc tên của bạn hoặc đơn vị đã đăng ký với HR Connect.
                </Text>

                {bankQuery.isLoading ? (
                  <Skeleton active paragraph={{ rows: 5 }} />
                ) : (
                  <Form
                    form={bankForm}
                    layout="vertical"
                    onFinish={(vals) => updateBankMutation.mutate(vals)}
                    disabled={updateBankMutation.isPending}
                    requiredMark={false}
                  >
                    <Form.Item
                      name="bankName"
                      label="Ngân hàng thụ hưởng"
                      rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập tên ngân hàng!' }]}
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder="Chọn ngân hàng hoặc nhập tên"
                        options={VIETNAM_BANKS}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      name="bankAccountNumber"
                      label="Số tài khoản ngân hàng"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số tài khoản!' },
                        { pattern: /^[0-9A-Za-z-]{6,25}$/, message: 'Số tài khoản không hợp lệ!' },
                      ]}
                    >
                      <Input
                        prefix={<IdcardOutlined className="text-slate-400" />}
                        placeholder="Ví dụ: 0011001234567"
                      />
                    </Form.Item>

                    <Form.Item
                      name="bankAccountHolder"
                      label="Tên chủ tài khoản (Viết in hoa không dấu)"
                      rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản!' }]}
                    >
                      <Input
                        prefix={<UserOutlined className="text-slate-400" />}
                        placeholder="Ví dụ: NGUYEN VAN A"
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          bankForm.setFieldsValue({ bankAccountHolder: val });
                        }}
                      />
                    </Form.Item>

                    <Form.Item name="bankBranch" label="Chi nhánh ngân hàng (Tùy chọn)">
                      <Input placeholder="Ví dụ: Chi nhánh Ba Đình, Hà Nội" />
                    </Form.Item>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        htmlType="submit"
                        loading={updateBankMutation.isPending}
                        className="!rounded-lg"
                      >
                        Lưu thông tin ngân hàng
                      </Button>
                    </div>
                  </Form>
                )}
              </Surface>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'security',
      label: (
        <span className="flex items-center gap-2">
          <LockOutlined />
          Mật khẩu & bảo mật
        </span>
      ),
      children: (
        <div className="max-w-xl pt-2">
          <Surface padded>
            <Title level={5} className="!mb-1 text-slate-800">
              Đổi mật khẩu tài khoản
            </Title>
            <Text type="secondary" className="block mb-5 text-xs">
              Mật khẩu mới phải có ít nhất 8 ký tự để đảm bảo an toàn cho tài khoản và thông tin hoa hồng của bạn.
            </Text>

            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
              disabled={changingPassword}
              requiredMark={false}
            >
              <Form.Item
                name="currentPassword"
                label="Mật khẩu hiện tại"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="Mật khẩu mới"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự!' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Tối thiểu 8 ký tự"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu mới"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu mới!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </Form.Item>

              <div className="flex justify-end pt-2">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={changingPassword}
                  className="!rounded-lg"
                >
                  Cập nhật mật khẩu
                </Button>
              </div>
            </Form>
          </Surface>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AffiliatePageHeader
        title="Hồ sơ & cài đặt"
        description="Cập nhật thông tin liên hệ, tài khoản nhận hoa hồng và mật khẩu đăng nhập của bạn."
      />

      <Card bordered={false} className="rounded-2xl shadow-sm border border-slate-200">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          className="admin-console-tabs"
        />
      </Card>
    </div>
  );
};

export default AffiliateProfilePage;
