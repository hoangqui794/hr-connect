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
import { PageHero, Surface } from '@/features/admin-console/ui';
import { AvatarUpload } from '@/components/common/AvatarUpload';

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
  const bankHolderWatched = Form.useWatch('bankAccountHolder', bankForm) || b?.bankAccountHolder || 'CHỦ TÀI KHOẢN';
  const bankNumberWatched = Form.useWatch('bankAccountNumber', bankForm) || b?.bankAccountNumber || '•••• •••• •••• ••••';
  const bankNameWatched = Form.useWatch('bankName', bankForm) || b?.bankName || 'NGÂN HÀNG';

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <UserOutlined />
          Hồ sơ đối tác
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
                      {p?.status === 'ACTIVE' ? 'Đang hoạt động' : p?.status ?? 'Chờ duyệt'}
                    </Tag>
                    {p?.affiliateType && <Tag color="purple">{p.affiliateType}</Tag>}
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
                    Thông tin hiển thị & Liên hệ
                  </Title>
                  <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={(vals) => updateProfileMutation.mutate(vals)}
                    disabled={updateProfileMutation.isPending}
                    requiredMark="optional"
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="displayName"
                          label="Tên hiển thị (Doanh nghiệp hoặc Cá nhân)"
                          rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                        >
                          <Input placeholder="Ví dụ: Công ty Headhunt ABC hoặc Nguyễn Văn A" />
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
                        <Form.Item name="taxInformation" label="Mã số thuế / MST cá nhân">
                          <Input placeholder="Mã số thuế để xuất chứng từ khấu trừ" />
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
          Tài khoản nhận hoa hồng
        </span>
      ),
      children: (
        <div className="space-y-6 pt-2">
          <Row gutter={[32, 24]}>
            {/* ATM Card Visual */}
            <Col xs={24} lg={10}>
              <div className="sticky top-24">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-violet-900 p-6 text-white shadow-xl aspect-[1.586/1] flex flex-col justify-between border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCardOutlined className="text-2xl text-amber-400" />
                      <span className="font-extrabold text-sm tracking-widest uppercase text-slate-200">
                        HR CONNECT PAYOUT
                      </span>
                    </div>
                    <Tag
                      color={b?.isConfigured ? 'success' : 'warning'}
                      className="m-0 font-semibold uppercase text-[10px]"
                    >
                      {b?.isConfigured ? 'Đã kích hoạt' : 'Chưa cấu hình'}
                    </Tag>
                  </div>

                  {/* Microchip icon simulation */}
                  <div className="w-11 h-8 rounded-md bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border border-amber-600/60 flex items-center justify-center shadow-inner opacity-90 my-auto">
                    <div className="w-9 h-6 border-t border-b border-amber-700/40" />
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-1">
                      {bankNameWatched}
                    </div>
                    <div className="text-xl sm:text-2xl font-mono tracking-widest text-slate-100 font-bold mb-3 drop-shadow">
                      {bankNumberWatched}
                    </div>
                    <div className="flex justify-between items-end text-xs tracking-wider uppercase text-slate-300">
                      <div>
                        <div className="text-[9px] text-slate-400 font-sans">Chủ tài khoản</div>
                        <div className="font-semibold font-mono truncate max-w-[200px]">
                          {String(bankHolderWatched).toUpperCase()}
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 font-sans text-right">
                        VND Payout
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
                  <SafetyCertificateOutlined className="mr-1 text-amber-600" />
                  Hoa hồng từ các ứng viên trúng tuyển sẽ được quyết toán và chuyển khoản trực tiếp vào tài khoản này sau khi hết hạn bảo hành tuyển dụng.
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
                  Vui lòng cung cấp chính xác thông tin ngân hàng nội địa Việt Nam mang tên của bạn hoặc công ty.
                </Text>

                {bankQuery.isLoading ? (
                  <Skeleton active paragraph={{ rows: 5 }} />
                ) : (
                  <Form
                    form={bankForm}
                    layout="vertical"
                    onFinish={(vals) => updateBankMutation.mutate(vals)}
                    disabled={updateBankMutation.isPending}
                    requiredMark="optional"
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
          Bảo mật & Mật khẩu
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
              requiredMark="optional"
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
      <PageHero
        eyebrow="Tài khoản"
        title="Hồ sơ đối tác & Thiết lập hoa hồng"
        description="Quản lý thông tin định danh, tài khoản ngân hàng nhận hoa hồng giới thiệu và bảo mật tài khoản."
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
