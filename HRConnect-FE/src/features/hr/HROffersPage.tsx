import React, { useState, useCallback } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, message, Popconfirm, Statistic, Descriptions,
} from 'antd';
import {
  SolutionOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, DollarOutlined, BankOutlined,
  FileDoneOutlined, EyeOutlined, SendOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useApplicationStore } from '@/stores/applicationStore';
import { saveWarranty, savePayout } from '@/services/localStorageService';
import { PayoutStatus } from '@/types/affiliate';

const { Title, Text } = Typography;

interface OfferRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  offeredSalary: number;
  probationSalaryRate: number;
  offerSentDate: string;
  expectedStartDate: string;
  affiliateName: string;
  affiliateEmail?: string;
  status: 'PENDING_OFFER' | 'OFFER_ACCEPTED' | 'NEGOTIATING' | 'ONBOARDED' | 'OFFER_REJECTED';
  notes?: string;
  /** Source application ID (for syncing back to applicationStore) */
  applicationId?: string;
}

const SEED_OFFERS: OfferRecord[] = [
  {
    id: 'off-001',
    candidateName: 'Do Thi Mai',
    candidateEmail: 'mai.do@headhunt.vn',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'Frontend Engineer (React)',
    offeredSalary: 28000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-18',
    expectedStartDate: '2026-10-01',
    affiliateName: 'David Tran',
    status: 'OFFER_ACCEPTED',
    notes: 'Ứng viên đã ký chấp thuận Offer Letter. Chuẩn bị Onboarding.',
  },
  {
    id: 'off-002',
    candidateName: 'Phan Thanh Tung',
    candidateEmail: 'tung.phan@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Backend Java Lead',
    offeredSalary: 45000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-20',
    expectedStartDate: '2026-10-05',
    affiliateName: 'Sarah Le',
    status: 'NEGOTIATING',
    notes: 'Ứng viên đang đề xuất điều chỉnh chế độ bảo hiểm và ngày phép năm.',
  },
  {
    id: 'off-003',
    candidateName: 'Le Thanh Dat',
    candidateEmail: 'dat.le@tech.io',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior Fullstack Engineer',
    offeredSalary: 35000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-01',
    expectedStartDate: '2026-09-15',
    affiliateName: 'David Tran',
    status: 'ONBOARDED',
    notes: 'Đã đi làm chính thức từ ngày 15/09/2026. Đang trong kỳ bảo hành 60 ngày.',
  },
  {
    id: 'off-004',
    candidateName: 'Nguyen Thi C',
    candidateEmail: 'thic.nguyen@outlook.com',
    companyName: 'NexGen AI Solutions Ltd',
    jobTitle: 'Product Designer (UI/UX)',
    offeredSalary: 22000000,
    probationSalaryRate: 85,
    offerSentDate: '2026-09-10',
    expectedStartDate: '2026-09-25',
    affiliateName: 'Minh Vu Recruiter',
    status: 'OFFER_REJECTED',
    notes: 'Ứng viên nhận offer từ công ty khác với đãi ngộ cao hơn.',
  },
];

/**
 * Build the offer list by merging seed data with any INTERVIEW_PASSED / OFFER_PENDING
 * candidates from the shared applicationStore and localStorage 'hrconnect_candidate_applications'.
 */
function buildMergedOffers(seedOffers: OfferRecord[]): OfferRecord[] {
  let allApps = [...(useApplicationStore.getState().applications || [])];

  try {
    const raw = localStorage.getItem('hrconnect_candidate_applications');
    if (raw) {
      const parsed = JSON.parse(raw);
      const apps = Array.isArray(parsed) ? parsed : parsed.state?.applications;
      if (Array.isArray(apps)) {
        apps.forEach((a: any) => {
          if (!allApps.some((x) => x.id === a.id || (x.email === a.email && x.jobTitle === a.jobTitle))) {
            allApps.push(a);
          }
        });
      }
    }
  } catch {
    // noop
  }

  // Pre-seed passed candidates (e.g., Nguyễn Văn B, Nguyễn Hồng Phương) if not already in store
  const seedPassedCandidates: any[] = [
    {
      id: 'app-seed-passed-01',
      fullName: 'Nguyễn Văn B',
      email: 'nguyenvanb@tech.com',
      jobTitle: 'Senior Backend Engineer (Java/Cloud)',
      company: 'TechCorp Việt Nam',
      affiliateName: 'David Trần',
      affiliateEmail: 'david.tran@headhunter.vn',
      status: 'INTERVIEW_PASSED',
      aiScore: 94,
      salaryExpectation: 45000000,
      source: 'AFFILIATE',
    },
    {
      id: 'app-seed-passed-02',
      fullName: 'Nguyễn Hồng Phương',
      email: 'hongphuong.nguyen@gmail.com',
      jobTitle: 'Product Manager (Fintech)',
      company: 'TechCorp Việt Nam',
      affiliateName: 'Sarah Lê',
      affiliateEmail: 'sarah.le@toprecruiter.com',
      status: 'INTERVIEW_PASSED',
      aiScore: 91,
      salaryExpectation: 38000000,
      source: 'AFFILIATE',
    },
  ];

  seedPassedCandidates.forEach((cand) => {
    if (!allApps.some((a) => a.email.toLowerCase() === cand.email.toLowerCase())) {
      allApps.unshift(cand);
    }
  });

  const passedApps = allApps.filter(
    (a) =>
      a.status === 'INTERVIEW_PASSED' ||
      (a.status as any) === 'OFFER_PENDING' ||
      a.status === 'OFFERED' ||
      a.status === 'ONBOARDED'
  );

  const existingEmails = new Set(seedOffers.map((o) => o.candidateEmail.toLowerCase()));

  const dynamicOffers: OfferRecord[] = passedApps
    .filter((a) => !existingEmails.has(a.email.toLowerCase()))
    .map((a) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      const startDate = tomorrow.toISOString().slice(0, 10);

      let status: OfferRecord['status'] = 'PENDING_OFFER';
      if (a.status === 'OFFERED')    status = 'OFFER_ACCEPTED';
      if (a.status === 'ONBOARDED') status = 'ONBOARDED';

      return {
        id: a.id.startsWith('off-') ? a.id : 'off-app-' + a.id,
        candidateName: a.fullName,
        candidateEmail: a.email,
        companyName: a.company,
        jobTitle: a.jobTitle,
        offeredSalary: a.salaryExpectation || 30000000,
        probationSalaryRate: 85,
        offerSentDate: new Date().toISOString().slice(0, 10),
        expectedStartDate: startDate,
        affiliateName: a.affiliateName || 'HRConnect (Tự nộp)',
        affiliateEmail: a.affiliateEmail,
        status,
        notes: `Ứng viên đạt phỏng vấn (điểm AI ${a.aiScore || 90}/100). Nguồn: ${
          a.source === 'AFFILIATE' ? 'CTV ' + (a.affiliateName || 'đối tác') : 'Tự ứng tuyển'
        }.`,
        applicationId: a.id,
      };
    });

  // Passed & offer-pending candidates are put at the beginning of the table
  return [...dynamicOffers, ...seedOffers];
}

export const HROffersPage: React.FC = () => {
  const [offers, setOffers] = useState<OfferRecord[]>(() =>
    buildMergedOffers(SEED_OFFERS)
  );
  const [selectedOffer, setSelectedOffer] = useState<OfferRecord | null>(null);
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const { updateApplicationStatus } = useApplicationStore();

  /** Re-read the applicationStore to pick up freshly passed candidates */
  const handleReload = useCallback(() => {
    setOffers(buildMergedOffers(SEED_OFFERS));
    message.success('Đã làm mới danh sách Offer!');
  }, []);

  /** Promote a PENDING_OFFER application to OFFER_ACCEPTED */
  const handleSendOffer = (record: OfferRecord) => {
    setOffers((prev) =>
      prev.map((o) =>
        o.id === record.id ? { ...o, status: 'OFFER_ACCEPTED', offerSentDate: new Date().toISOString().slice(0, 10) } : o
      )
    );
    // Sync back to applicationStore
    if (record.applicationId) {
      updateApplicationStatus(record.applicationId, 'OFFERED', {
        offerSalary: String(record.offeredSalary),
        offerDate: new Date().toISOString().slice(0, 10),
      });
    }
    message.success(`Đã gửi Offer cho ${record.candidateName}! Chờ ứng viên phản hồi.`);
  };

  /** Confirm Onboarding and push record to 60-day warranty tracking */
  const handleConfirmOnboard = (target: string | OfferRecord) => {
    const record = typeof target === 'string'
      ? offers.find((o) => o.id === target || o.applicationId === target)
      : target;

    if (!record) return;

    setOffers((prev) =>
      prev.map((o) => (o.id === record.id ? { ...o, status: 'ONBOARDED' } : o))
    );

    // 1. Sync to shared application store
    if (record.applicationId) {
      updateApplicationStatus(record.applicationId, 'ONBOARDED', {
        onboardDate: record.expectedStartDate,
      });
    } else {
      const sharedApps = useApplicationStore.getState().applications;
      const match = sharedApps.find(
        (a) =>
          a.email.toLowerCase() === record.candidateEmail.toLowerCase() &&
          (a.jobTitle === record.jobTitle || a.company === record.companyName)
      );
      if (match) {
        updateApplicationStatus(match.id, 'ONBOARDED', { onboardDate: record.expectedStartDate });
      } else {
        useApplicationStore.getState().addApplication({
          fullName: record.candidateName,
          email: record.candidateEmail,
          jobId: 'job-off-' + record.id,
          jobTitle: record.jobTitle,
          company: record.companyName,
          source: 'DIRECT',
          status: 'ONBOARDED',
          aiScore: 90,
        });
      }
    }

    // 2. Push into hrconnect_warranty_records:
    // { id: 'WAR-' + Date.now(), candidateName, candidateEmail, jobTitle, companyName, affiliateEmail, daysWorked: 0, maxDays: 60, status: 'PROBATION' }
    const newWarrantyRecord = {
      id: 'WAR-' + Date.now(),
      candidateName: record.candidateName,
      candidateEmail: record.candidateEmail,
      jobTitle: record.jobTitle,
      companyName: record.companyName,
      affiliateEmail: record.affiliateEmail || 'affiliate@demo.com',
      daysWorked: 0,
      maxDays: 60,
      status: 'PROBATION',
      startDate: record.expectedStartDate || new Date().toISOString().slice(0, 10),
      commissionAmount: Math.round(record.offeredSalary * 0.8),
    };

    try {
      const existingRaw = localStorage.getItem('hrconnect_warranty_records');
      let warList: any[] = [];
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) warList = parsed;
      }
      warList.unshift(newWarrantyRecord);
      localStorage.setItem('hrconnect_warranty_records', JSON.stringify(warList));
    } catch (e) {
      console.error('Failed to save to hrconnect_warranty_records:', e);
    }

    // 3. Initialize commission record in hrconnect_commissions if needed
    try {
      const comRaw = localStorage.getItem('hrconnect_commissions');
      let comList: any[] = [];
      if (comRaw) {
        const parsed = JSON.parse(comRaw);
        if (Array.isArray(parsed)) comList = parsed;
      }
      const existingCom = comList.find((c: any) => c.candidateEmail === record.candidateEmail || c.candidateName === record.candidateName);
      if (!existingCom) {
        comList.unshift({
          id: 'COM-' + Date.now(),
          applicationId: record.applicationId || record.id,
          candidateName: record.candidateName,
          candidateEmail: record.candidateEmail,
          jobTitle: record.jobTitle,
          companyName: record.companyName,
          affiliateName: record.affiliateName || 'David Tran',
          affiliateEmail: record.affiliateEmail || 'david.tran@headhunter.vn',
          amount: Math.round(record.offeredSalary * 0.8),
          commissionRate: 15,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('hrconnect_commissions', JSON.stringify(comList));
      }
    } catch (e) {
      console.error('Failed to sync commission:', e);
    }

    // 4. Also write to hrconnect_warranties for compatibility
    saveWarranty({
      id: newWarrantyRecord.id,
      candidateName: record.candidateName,
      candidateEmail: record.candidateEmail,
      companyName: record.companyName,
      jobTitle: record.jobTitle,
      affiliateName: record.affiliateName || 'Cộng tác viên HRConnect',
      onboardDate: record.expectedStartDate || new Date().toISOString().slice(0, 10),
      warrantyEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      totalDays: 60,
      daysPassed: 0,
      commissionAmount: Math.round(record.offeredSalary * 0.8),
      status: 'IN_PROBATION',
      notes: `Đã onboard thành công. Đang trong kỳ theo dõi bảo hành 60 ngày thử việc tại ${record.companyName}.`,
    });

    message.success(
      `Đã xác nhận ${record.candidateName} chính thức Onboarding! Bản ghi bảo hành 60 ngày đã được tạo vào hrconnect_warranty_records.`
    );
  };

  const handleMarkOnboarded = handleConfirmOnboard;

  const pendingOfferCount = offers.filter((o) => o.status === 'PENDING_OFFER').length;
  const acceptedOffers = offers.filter((o) => o.status === 'OFFER_ACCEPTED' || o.status === 'NEGOTIATING');
  const onboardedCount = offers.filter((o) => o.status === 'ONBOARDED').length;

  const statusTag = (s: string) => {
    const map: Record<string, { color: string; text: string; badge: 'default' | 'success' | 'processing' | 'error' | 'warning' }> = {
      PENDING_OFFER:  { color: '#d97706', text: 'Chờ gửi Offer',       badge: 'warning' },
      OFFER_ACCEPTED: { color: '#16a34a', text: 'Đã chấp nhận Offer',  badge: 'success' },
      NEGOTIATING:    { color: '#d97706', text: 'Đang thương lượng',   badge: 'warning' },
      ONBOARDED:      { color: '#0284c7', text: 'Đã đi làm (Onboarded)', badge: 'processing' },
      OFFER_REJECTED: { color: '#dc2626', text: 'Đã từ chối Offer',    badge: 'error' },
    };
    const cfg = map[s] || { color: '#64748b', text: s, badge: 'default' as const };
    return <Badge status={cfg.badge} text={<span style={{ fontWeight: 700, color: cfg.color }}>{cfg.text}</span>} />;
  };

  const columns: ColumnsType<OfferRecord> = [
    {
      title: 'Ứng viên & Vị trí',
      key: 'candidate',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{record.candidateName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.candidateEmail}</div>
          <Tag color="blue" style={{ marginTop: 4, borderRadius: 4, fontSize: 11 }}>
            {record.jobTitle}
          </Tag>
          {record.status === 'PENDING_OFFER' && (
            <Tag color="gold" style={{ marginTop: 4, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
              ★ Mới — Vừa đạt PV
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Doanh nghiệp & CTV',
      key: 'company',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            <BankOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.companyName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            CTV: <strong>{record.affiliateName}</strong>
          </div>
        </div>
      ),
    },
    {
      title: 'Mức lương Offer',
      dataIndex: 'offeredSalary',
      key: 'salary',
      render: (v: number) => (
        <div>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>
            {v.toLocaleString('vi-VN')} đ
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Thử việc 85%: {(v * 0.85).toLocaleString('vi-VN')} đ
          </div>
        </div>
      ),
    },
    {
      title: 'Ngày dự kiến Onboard',
      key: 'onboard',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>
            <ClockCircleOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.expectedStartDate}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Gửi Offer: {record.offerSentDate}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái Offer',
      dataIndex: 'status',
      key: 'status',
      render: statusTag,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedOffer(record); setLetterModalOpen(true); }}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            Thư Offer
          </Button>

          {/* Gửi Offer — only for freshly passed interview candidates */}
          {record.status === 'PENDING_OFFER' && (
            <Popconfirm
              title="Gửi Thư Mời Nhận Việc"
              description={`Xác nhận gửi Offer Letter chính thức cho ${record.candidateName}?`}
              onConfirm={() => handleSendOffer(record)}
              okText="Gửi Offer"
              cancelText="Hủy"
              okButtonProps={{ style: { background: '#d97706', borderColor: '#d97706' } }}
            >
              <Button
                size="small"
                icon={<SendOutlined />}
                style={{ borderRadius: 6, fontSize: 12, borderColor: '#d97706', color: '#d97706', fontWeight: 700 }}
              >
                Gửi Offer
              </Button>
            </Popconfirm>
          )}

          {/* Xác nhận Onboard — only for OFFER_ACCEPTED */}
          {record.status === 'OFFER_ACCEPTED' && (
            <Popconfirm
              title="Xác nhận ứng viên đã Onboard"
              description={`Xác nhận ${record.candidateName} đã đến nhận việc chính thức tại ${record.companyName}?`}
              onConfirm={() => handleMarkOnboarded(record)}
              okText="Đã Onboard"
              cancelText="Hủy"
              okButtonProps={{ style: { background: '#0284c7', borderColor: '#0284c7' } }}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ borderRadius: 6, fontSize: 12, background: '#0284c7', borderColor: '#0284c7' }}
              >
                Xác nhận Onboard
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            <SolutionOutlined style={{ color: '#0284c7', marginRight: 10 }} />
            Quản lý Offer & Onboarding (Placement Pipeline)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Theo dõi tiến trình đàm phán Offer, ghi nhận phản hồi chấp nhận/từ chối và xác nhận Onboarding để kích hoạt chu kỳ bảo hành 60 ngày.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleReload} style={{ borderRadius: 8 }}>
          Làm mới dữ liệu
        </Button>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fffbeb' }}>
            <Statistic
              title="Chờ gửi Offer (mới đạt PV)"
              value={pendingOfferCount}
              valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: 26 }}
              prefix={<Badge count={pendingOfferCount} style={{ backgroundColor: '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fffbeb' }}>
            <Statistic
              title="Offer đang xử lý"
              value={acceptedOffers.length}
              valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: 26 }}
              prefix={<Badge count={acceptedOffers.length} style={{ backgroundColor: '#d97706' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Ứng viên đã Onboarding"
              value={onboardedCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 26 }}
              prefix={<FileDoneOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tỷ lệ chấp thuận Offer"
              value={75}
              suffix="%"
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 26 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Table
          dataSource={offers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="middle"
          rowClassName={(record) =>
            record.status === 'PENDING_OFFER' ? 'ant-table-row-gold' : ''
          }
        />
      </Card>

      {/* Offer Letter Details Modal */}
      <Modal
        open={letterModalOpen}
        onCancel={() => setLetterModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setLetterModalOpen(false)} style={{ borderRadius: 8 }}>
            Đóng
          </Button>,
          selectedOffer?.status === 'PENDING_OFFER' && (
            <Button
              key="sendoffer"
              style={{ borderRadius: 8, borderColor: '#d97706', color: '#d97706' }}
              icon={<SendOutlined />}
              onClick={() => {
                if (selectedOffer) handleSendOffer(selectedOffer);
                setLetterModalOpen(false);
              }}
            >
              Gửi Offer
            </Button>
          ),
          selectedOffer?.status === 'OFFER_ACCEPTED' && (
            <Button
              key="onboard"
              type="primary"
              onClick={() => {
                if (selectedOffer) handleMarkOnboarded(selectedOffer);
                setLetterModalOpen(false);
              }}
              style={{ borderRadius: 8, background: '#0284c7' }}
            >
              Xác nhận Onboarding
            </Button>
          ),
        ]}
        title={
          <Space>
            <SolutionOutlined style={{ color: '#0284c7' }} />
            <span>Thư Mời Nhận Việc (Official Offer Letter)</span>
          </Space>
        }
        width={650}
      >
        {selectedOffer && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Ứng viên" span={2}>
                <strong>{selectedOffer.candidateName}</strong> ({selectedOffer.candidateEmail})
              </Descriptions.Item>
              <Descriptions.Item label="Doanh nghiệp tuyển dụng" span={2}>
                <strong>{selectedOffer.companyName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí tuyển dụng" span={2}>
                {selectedOffer.jobTitle}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương chính thức">
                <span style={{ color: '#059669', fontWeight: 700 }}>
                  {selectedOffer.offeredSalary.toLocaleString('vi-VN')} đ/tháng
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Lương thử việc (85%)">
                {(selectedOffer.offeredSalary * 0.85).toLocaleString('vi-VN')} đ/tháng
              </Descriptions.Item>
              <Descriptions.Item label="Ngày gửi Offer">
                {selectedOffer.offerSentDate}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu làm việc">
                <strong>{selectedOffer.expectedStartDate}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="CTV giới thiệu" span={2}>
                {selectedOffer.affiliateName}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú điều phối" span={2}>
                {selectedOffer.notes || 'Không có ghi chú.'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HROffersPage;
