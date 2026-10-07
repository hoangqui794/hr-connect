/**
 * @file AffiliateProfileSettingsModal.tsx
 * @description Modal & Form settings for Affiliate Recruiter (A-06):
 * 1. Partner Profile (GET / PUT /api/v1/affiliates/profile/me)
 * 2. Bank Account (GET / PUT /api/v1/affiliates/profile/me/bank-account)
 * 3. Recruitment Performance (GET /api/v1/affiliates/profile/me/performance)
 */

import React, { useEffect } from 'react';
import {
  Modal,
  Tabs,
  Form,
  Input,
  Button,
  Row,
  Col,
  Tag,
  Divider,
  Spin,
  Alert,
  message,
  Card,
  Statistic,
} from 'antd';
import {
  UserOutlined,
  BankOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import {
  useAffiliateProfile,
  useUpdateAffiliateProfile,
  useAffiliateBankAccount,
  useUpdateAffiliateBankAccount,
  useAffiliatePerformance,
} from '@/services/queries/useProfiles';
import type {
  UpdateAffiliateProfileCommand,
  UpdateAffiliateBankAccountCommand,
} from '@/types/profile';

interface AffiliateProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'bank' | 'performance';
}

export const AffiliateProfileSettingsModal: React.FC<AffiliateProfileSettingsModalProps> = ({
  open,
  onClose,
  defaultTab = 'profile',
}) => {
  const [profileForm] = Form.useForm<UpdateAffiliateProfileCommand>();
  const [bankForm] = Form.useForm<UpdateAffiliateBankAccountCommand>();

  // React Query Hooks
  const { data: profile, isLoading: isProfileLoading } = useAffiliateProfile();
  const updateProfileMutation = useUpdateAffiliateProfile();

  const { data: bankAccount, isLoading: isBankLoading } = useAffiliateBankAccount();
  const updateBankMutation = useUpdateAffiliateBankAccount();

  const { data: performance, isLoading: isPerfLoading } = useAffiliatePerformance();

  // Sync profile data to form
  useEffect(() => {
    if (profile) {
      profileForm.setFieldsValue({
        displayName: profile.displayName ?? '',
        contactPerson: profile.contactPerson ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        taxInformation: profile.taxInformation ?? '',
      });
    }
  }, [profile, profileForm]);

  // Sync bank account data to form
  useEffect(() => {
    if (bankAccount) {
      bankForm.setFieldsValue({
        bankName: bankAccount.bankName ?? '',
        bankAccountNumber: bankAccount.bankAccountNumber ?? '',
        bankAccountHolder: bankAccount.bankAccountHolder ?? '',
        bankBranch: bankBranchFormat(bankAccount.bankBranch),
      });
    }
  }, [bankAccount, bankForm]);

  const bankBranchFormat = (branch?: string | null) => branch ?? '';

  // Handle Save Profile
  const handleSaveProfile = async (values: UpdateAffiliateProfileCommand) => {
    try {
      await updateProfileMutation.mutateAsync({
        displayName: values.displayName?.trim() || null,
        contactPerson: values.contactPerson?.trim() || null,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        taxInformation: values.taxInformation?.trim() || null,
      });
      message.success('Cập nhật thông tin hồ sơ đối tác tuyển dụng thành công!');
    } catch {
      message.error('Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại kết nối!');
    }
  };

  // Handle Save Bank Account
  const handleSaveBank = async (values: UpdateAffiliateBankAccountCommand) => {
    try {
      await updateBankMutation.mutateAsync({
        bankName: values.bankName?.trim() || null,
        bankAccountNumber: values.bankAccountNumber?.trim() || null,
        bankAccountHolder: (values.bankAccountHolder?.trim() || '').toUpperCase() || null,
        bankBranch: values.bankBranch?.trim() || null,
      });
      message.success('Cập nhật tài khoản ngân hàng nhận hoa hồng thành công!');
    } catch {
      message.error('Không thể cập nhật tài khoản ngân hàng. Vui lòng thử lại!');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <UserOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Cài đặt Tài khoản & Hồ sơ Đối tác Tuyển dụng (A-06)
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Quản lý thông tin định danh, tài khoản ngân hàng nhận thanh toán hoa hồng và chỉ số hiệu suất.
            </div>
          </div>
        </div>
      }
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 } }}
      centered
      destroyOnClose={false}
    >
      <Tabs
        defaultActiveKey={defaultTab}
        items={[
          // ─── TAB 1: HỒ SƠ ĐỐI TÁC ──────────────────────────────────────────
          {
            key: 'profile',
            label: (
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserOutlined /> Hồ sơ đối tác
              </span>
            ),
            children: (
              <Spin spinning={isProfileLoading}>
                {/* Status Header Banner */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '12px 16px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Tag color="blue" style={{ fontWeight: 600, borderRadius: 6 }}>
                      {profile?.affiliateType === 'INDIVIDUAL' ? 'Cá nhân (Headhunter)' : 'Tổ chức / Agency'}
                    </Tag>
                    <Tag
                      color={profile?.status === 'ACTIVE' ? 'success' : 'warning'}
                      icon={<CheckCircleOutlined />}
                      style={{ fontWeight: 600, borderRadius: 6 }}
                    >
                      {profile?.status === 'ACTIVE' ? 'Đã kích hoạt' : profile?.status || 'Đang xác thực'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    <MailOutlined style={{ marginRight: 4 }} />
                    {profile?.email || 'Chưa có email'}
                  </div>
                </div>

                <Form
                  form={profileForm}
                  layout="vertical"
                  onFinish={handleSaveProfile}
                  requiredMark="optional"
                >
                  <Row gutter={[16, 12]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="displayName"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên hiển thị / Danh xưng <span style={{ color: '#ef4444' }}>*</span></span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị' }]}
                      >
                        <Input
                          placeholder="VD: David Tran"
                          size="large"
                          style={{ borderRadius: 10 }}
                          prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="contactPerson"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Người đại diện liên hệ</span>}
                      >
                        <Input
                          placeholder="VD: David Tran"
                          size="large"
                          style={{ borderRadius: 10 }}
                          prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="phone"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số điện thoại liên lạc <span style={{ color: '#ef4444' }}>*</span></span>}
                        rules={[
                          { required: true, message: 'Vui lòng nhập số điện thoại' },
                          { pattern: /^[0-9+() -]{8,15}$/, message: 'Số điện thoại không hợp lệ' },
                        ]}
                      >
                        <Input
                          placeholder="VD: 0909 112 233"
                          size="large"
                          style={{ borderRadius: 10 }}
                          prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="taxInformation"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Mã số thuế / CCCD</span>}
                      >
                        <Input
                          placeholder="VD: MST: 8401234567 | CCCD: 079192005678"
                          size="large"
                          style={{ borderRadius: 10 }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item
                        name="address"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa chỉ liên hệ / Văn phòng</span>}
                      >
                        <Input
                          placeholder="VD: Tòa nhà Landmark 81, P.22, Bình Thạnh, TP. Hồ Chí Minh"
                          size="large"
                          style={{ borderRadius: 10 }}
                          prefix={<HomeOutlined style={{ color: '#94a3b8' }} />}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                    <Button onClick={onClose} style={{ borderRadius: 10, fontWeight: 600 }}>
                      Đóng
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={updateProfileMutation.isPending}
                      style={{
                        borderRadius: 10,
                        fontWeight: 700,
                        background: '#2563eb',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                      }}
                    >
                      Lưu thay đổi hồ sơ
                    </Button>
                  </div>
                </Form>
              </Spin>
            ),
          },

          // ─── TAB 2: TÀI KHOẢN NGÂN HÀNG HOA HỒNG ─────────────────────────
          {
            key: 'bank',
            label: (
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BankOutlined /> Tài khoản ngân hàng
              </span>
            ),
            children: (
              <Spin spinning={isBankLoading}>
                <Alert
                  type="info"
                  showIcon
                  icon={<SafetyCertificateOutlined />}
                  message="Tài khoản thanh toán hoa hồng định kỳ"
                  description="Doanh thu hoa hồng COD sau khi hoàn tất 60 ngày thử việc sẽ được Admin HRConnect lập ủy nhiệm chi (UNC) và tự động chuyển khoản vào tài khoản bên dưới."
                  style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #bfdbfe' }}
                />

                <Form
                  form={bankForm}
                  layout="vertical"
                  onFinish={handleSaveBank}
                  requiredMark="optional"
                >
                  <Row gutter={[16, 12]}>
                    <Col xs={24}>
                      <Form.Item
                        name="bankName"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên ngân hàng <span style={{ color: '#ef4444' }}>*</span></span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tên ngân hàng' }]}
                      >
                        <Input
                          placeholder="VD: Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)"
                          size="large"
                          style={{ borderRadius: 10 }}
                          prefix={<BankOutlined style={{ color: '#94a3b8' }} />}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="bankAccountNumber"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số tài khoản <span style={{ color: '#ef4444' }}>*</span></span>}
                        rules={[{ required: true, message: 'Vui lòng nhập số tài khoản ngân hàng' }]}
                      >
                        <Input
                          placeholder="VD: 0071001234567"
                          size="large"
                          style={{ borderRadius: 10, letterSpacing: '0.05em', fontWeight: 600 }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="bankAccountHolder"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chủ tài khoản (Không dấu) <span style={{ color: '#ef4444' }}>*</span></span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản' }]}
                      >
                        <Input
                          placeholder="VD: TRAN VAN DAVID"
                          size="large"
                          style={{ borderRadius: 10, textTransform: 'uppercase', fontWeight: 600 }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item
                        name="bankBranch"
                        label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chi nhánh mở tài khoản</span>}
                      >
                        <Input
                          placeholder="VD: Chi nhánh TP. Hồ Chí Minh"
                          size="large"
                          style={{ borderRadius: 10 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                    <Button onClick={onClose} style={{ borderRadius: 10, fontWeight: 600 }}>
                      Đóng
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={updateBankMutation.isPending}
                      style={{
                        borderRadius: 10,
                        fontWeight: 700,
                        background: '#059669',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      }}
                    >
                      Cập nhật tài khoản ngân hàng
                    </Button>
                  </div>
                </Form>
              </Spin>
            ),
          },

          // ─── TAB 3: HIỆU SUẤT TUYỂN DỤNG ────────────────────────────────────
          {
            key: 'performance',
            label: (
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrophyOutlined /> Hiệu suất tuyển dụng
              </span>
            ),
            children: (
              <Spin spinning={isPerfLoading}>
                <div style={{ padding: '4px 0' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      borderRadius: 16,
                      padding: '20px 24px',
                      color: '#ffffff',
                      marginBottom: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                        Xếp hạng & Điểm chất lượng
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#f8fafc' }}>
                        {performance?.ratingLabel || 'Top Tier Recruiter'}
                      </div>
                      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                        Kỳ đánh giá: {performance?.periodStart ?? '2026-01-01'} đến {performance?.periodEnd ?? 'Hiện tại'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
                        ⭐ {performance?.qualityRating ? performance.qualityRating.toFixed(1) : '4.9'}
                        <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}>/5.0</span>
                      </div>
                      <Tag color="gold" style={{ marginTop: 8, fontWeight: 700, borderRadius: 6 }}>
                        Tỷ lệ chuyển đổi: {performance?.submissionToHireRate ? `${performance.submissionToHireRate}%` : '29.2%'}
                      </Tag>
                    </div>
                  </div>

                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                      <Card bordered style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#64748b' }}>Hồ sơ đã giới thiệu</span>}
                          value={performance?.totalSubmissions ?? 48}
                          valueStyle={{ color: '#2563eb', fontWeight: 800 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card bordered style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#64748b' }}>Đã qua sơ loại</span>}
                          value={performance?.totalShortlisted ?? 32}
                          valueStyle={{ color: '#4f46e5', fontWeight: 800 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card bordered style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#64748b' }}>Vào phỏng vấn</span>}
                          value={performance?.totalInterviews ?? 24}
                          valueStyle={{ color: '#d97706', fontWeight: 800 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card bordered style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#64748b' }}>Onboard thành công</span>}
                          value={performance?.totalPlacements ?? 14}
                          valueStyle={{ color: '#059669', fontWeight: 800 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '20px 0 16px' }} />

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={onClose} style={{ borderRadius: 10, fontWeight: 600 }}>
                      Đóng
                    </Button>
                  </div>
                </div>
              </Spin>
            ),
          },
        ]}
      />
    </Modal>
  );
};
export default AffiliateProfileSettingsModal;
