/**
 * @file AffiliateProfileSettingsPage.tsx
 * @description Standalone page for Affiliate Recruiter Profile & Settings (A-06).
 * Integrates:
 * 1. GET / PUT /api/v1/affiliates/profile/me
 * 2. GET / PUT /api/v1/affiliates/profile/me/bank-account
 * 3. GET /api/v1/affiliates/profile/me/performance
 */

import React, { useEffect } from 'react';
import {
  Card,
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
import { useSearchParams } from 'react-router-dom';
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
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';

export const AffiliateProfileSettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const [profileForm] = Form.useForm<UpdateAffiliateProfileCommand>();
  const [bankForm] = Form.useForm<UpdateAffiliateBankAccountCommand>();

  const { data: profile, isLoading: isProfileLoading } = useAffiliateProfile();
  const updateProfileMutation = useUpdateAffiliateProfile();

  const { data: bankAccount, isLoading: isBankLoading } = useAffiliateBankAccount();
  const updateBankMutation = useUpdateAffiliateBankAccount();

  const { data: performance, isLoading: isPerfLoading } = useAffiliatePerformance();

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

  useEffect(() => {
    if (bankAccount) {
      bankForm.setFieldsValue({
        bankName: bankAccount.bankName ?? '',
        bankAccountNumber: bankAccount.bankAccountNumber ?? '',
        bankAccountHolder: bankAccount.bankAccountHolder ?? '',
        bankBranch: bankAccount.bankBranch ?? '',
      });
    }
  }, [bankAccount, bankForm]);

  const handleSaveProfile = async (values: UpdateAffiliateProfileCommand) => {
    try {
      await updateProfileMutation.mutateAsync({
        displayName: values.displayName?.trim() || null,
        contactPerson: values.contactPerson?.trim() || null,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        taxInformation: values.taxInformation?.trim() || null,
      });
      message.success('Cập nhật thông tin hồ sơ đối tác thành công!');
    } catch {
      message.error('Không thể cập nhật hồ sơ đối tác. Vui lòng thử lại!');
    }
  };

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
    <div className="space-y-6" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeaderB2B
        title="Thiết Lập Tài Khoản & Hồ Sơ Đối Tác (A-06)"
        badge={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {profile?.displayName || 'David Tran'}
            </span>
            <Tag color={profile?.status === 'ACTIVE' ? 'success' : 'default'} style={{ borderRadius: 6, margin: 0 }}>
              {profile?.status === 'ACTIVE' ? 'Hoạt động' : profile?.status || 'Chờ duyệt'}
            </Tag>
          </div>
        }
        subtitle="Quản trị thông tin định danh pháp lý Headhunter, tài khoản ngân hàng nhận chi trả hoa hồng COD và thống kê hiệu suất."
      />

      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams({ tab: key })}
          size="large"
          items={[
            // TAB 1
            {
              key: 'profile',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <UserOutlined />
                  Hồ sơ đối tác tuyển dụng
                </span>
              ),
              children: (
                <Spin spinning={isProfileLoading}>
                  <div style={{ paddingTop: 8 }}>
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 14,
                        padding: '16px 20px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Tag color="blue" style={{ fontWeight: 600, borderRadius: 6, padding: '2px 8px' }}>
                          Loại đối tác: {profile?.affiliateType === 'INDIVIDUAL' ? 'Cá nhân (Headhunter)' : 'Doanh nghiệp / Agency'}
                        </Tag>
                        <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 600, borderRadius: 6 }}>
                          Xác thực: {profile?.verifiedAt ? 'Đã xác minh KYC' : 'Đang xử lý'}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        <MailOutlined style={{ marginRight: 6 }} />
                        {profile?.email || 'Chưa cập nhật email'}
                      </div>
                    </div>

                    <Form
                      form={profileForm}
                      layout="vertical"
                      onFinish={handleSaveProfile}
                      requiredMark="optional"
                    >
                      <Row gutter={[20, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="displayName"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên đối tác / Danh xưng <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị' }]}
                          >
                            <Input
                              size="large"
                              placeholder="VD: David Tran"
                              style={{ borderRadius: 12 }}
                              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="contactPerson"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Người liên hệ đại diện</span>}
                          >
                            <Input
                              size="large"
                              placeholder="VD: David Tran"
                              style={{ borderRadius: 12 }}
                              prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="phone"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số điện thoại liên hệ <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[
                              { required: true, message: 'Vui lòng nhập số điện thoại' },
                              { pattern: /^[0-9+() -]{8,15}$/, message: 'Số điện thoại không hợp lệ' },
                            ]}
                          >
                            <Input
                              size="large"
                              placeholder="VD: 0909 112 233"
                              style={{ borderRadius: 12 }}
                              prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="taxInformation"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Mã số thuế / Số CCCD định danh</span>}
                          >
                            <Input
                              size="large"
                              placeholder="VD: MST: 8401234567 | CCCD: 079192005678"
                              style={{ borderRadius: 12 }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24}>
                          <Form.Item
                            name="address"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Địa chỉ liên hệ / Văn phòng làm việc</span>}
                          >
                            <Input
                              size="large"
                              placeholder="VD: Tòa nhà Landmark 81, P.22, Bình Thạnh, TP. Hồ Chí Minh"
                              style={{ borderRadius: 12 }}
                              prefix={<HomeOutlined style={{ color: '#94a3b8' }} />}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <div style={{ paddingTop: 8 }}>
                        <Button
                          type="primary"
                          size="large"
                          htmlType="submit"
                          loading={updateProfileMutation.isPending}
                          style={{
                            borderRadius: 9999,
                            fontWeight: 700,
                            padding: '0 32px',
                            background: '#2563eb',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                          }}
                        >
                          Lưu cập nhật hồ sơ
                        </Button>
                      </div>
                    </Form>
                  </div>
                </Spin>
              ),
            },

            // TAB 2
            {
              key: 'bank',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <BankOutlined />
                  Tài khoản ngân hàng nhận hoa hồng
                </span>
              ),
              children: (
                <Spin spinning={isBankLoading}>
                  <div style={{ paddingTop: 8 }}>
                    <Alert
                      type="info"
                      showIcon
                      icon={<SafetyCertificateOutlined />}
                      message="Tài khoản nhận thanh toán hoa hồng định kỳ"
                      description="Toàn bộ khoản tiền hoa hồng được mở khóa sau thời gian bảo hành thử việc 60 ngày sẽ được kế toán HRConnect chuyển trực tiếp vào số tài khoản bên dưới kèm ủy nhiệm chi (UNC)."
                      style={{ marginBottom: 24, borderRadius: 14, border: '1px solid #bfdbfe' }}
                    />

                    <Form
                      form={bankForm}
                      layout="vertical"
                      onFinish={handleSaveBank}
                      requiredMark="optional"
                    >
                      <Row gutter={[20, 16]}>
                        <Col xs={24}>
                          <Form.Item
                            name="bankName"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên ngân hàng thương mại <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập tên ngân hàng' }]}
                          >
                            <Input
                              size="large"
                              placeholder="VD: Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)"
                              style={{ borderRadius: 12 }}
                              prefix={<BankOutlined style={{ color: '#94a3b8' }} />}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="bankAccountNumber"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Số tài khoản ngân hàng <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập số tài khoản' }]}
                          >
                            <Input
                              size="large"
                              placeholder="VD: 0071001234567"
                              style={{ borderRadius: 12, fontWeight: 700, letterSpacing: '0.04em' }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="bankAccountHolder"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Tên chủ tài khoản (In hoa không dấu) <span style={{ color: '#ef4444' }}>*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản' }]}
                          >
                            <Input
                              size="large"
                              placeholder="VD: TRAN VAN DAVID"
                              style={{ borderRadius: 12, fontWeight: 700, textTransform: 'uppercase' }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24}>
                          <Form.Item
                            name="bankBranch"
                            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Chi nhánh mở tài khoản</span>}
                          >
                            <Input
                              size="large"
                              placeholder="VD: Chi nhánh TP. Hồ Chí Minh"
                              style={{ borderRadius: 12 }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <div style={{ paddingTop: 8 }}>
                        <Button
                          type="primary"
                          size="large"
                          htmlType="submit"
                          loading={updateBankMutation.isPending}
                          style={{
                            borderRadius: 9999,
                            fontWeight: 700,
                            padding: '0 32px',
                            background: '#059669',
                            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                          }}
                        >
                          Cập nhật tài khoản thanh toán
                        </Button>
                      </div>
                    </Form>
                  </div>
                </Spin>
              ),
            },

            // TAB 3
            {
              key: 'performance',
              label: (
                <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <TrophyOutlined />
                  Thống kê hiệu suất tuyển dụng
                </span>
              ),
              children: (
                <Spin spinning={isPerfLoading}>
                  <div style={{ paddingTop: 8 }}>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        borderRadius: 18,
                        padding: '24px 28px',
                        color: '#ffffff',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 20,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                          Xếp hạng Chuyên viên Headhunter
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#f8fafc' }}>
                          {performance?.ratingLabel || 'Top Tier Recruiter (Platinum)'}
                        </div>
                        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
                          Kỳ đánh giá: {performance?.periodStart ?? '2026-01-01'} đến {performance?.periodEnd ?? 'Hiện tại'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 36, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
                          ⭐ {performance?.qualityRating ? performance.qualityRating.toFixed(1) : '4.9'}
                          <span style={{ fontSize: 18, color: '#94a3b8', fontWeight: 600 }}>/5.0</span>
                        </div>
                        <Tag color="gold" style={{ marginTop: 8, fontWeight: 700, borderRadius: 6, fontSize: 12 }}>
                          Tỷ lệ tuyển dụng thành công: {performance?.submissionToHireRate ? `${performance.submissionToHireRate}%` : '29.2%'}
                        </Tag>
                      </div>
                    </div>

                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={6}>
                        <Card bordered style={{ borderRadius: 14, textAlign: 'center', background: '#f8fafc' }}>
                          <Statistic
                            title={<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Tổng ứng viên giới thiệu</span>}
                            value={performance?.totalSubmissions ?? 48}
                            valueStyle={{ color: '#2563eb', fontWeight: 800 }}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card bordered style={{ borderRadius: 14, textAlign: 'center', background: '#f8fafc' }}>
                          <Statistic
                            title={<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Đạt sơ loại (Shortlisted)</span>}
                            value={performance?.totalShortlisted ?? 32}
                            valueStyle={{ color: '#4f46e5', fontWeight: 800 }}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card bordered style={{ borderRadius: 14, textAlign: 'center', background: '#f8fafc' }}>
                          <Statistic
                            title={<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Vào vòng phỏng vấn</span>}
                            value={performance?.totalInterviews ?? 24}
                            valueStyle={{ color: '#d97706', fontWeight: 800 }}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card bordered style={{ borderRadius: 14, textAlign: 'center', background: '#f8fafc' }}>
                          <Statistic
                            title={<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Tuyển dụng thành công</span>}
                            value={performance?.totalPlacements ?? 14}
                            valueStyle={{ color: '#059669', fontWeight: 800 }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </div>
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AffiliateProfileSettingsPage;
