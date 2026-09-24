import React, { useState, useCallback } from 'react';
import {
  Table, Card, Typography, Space, Tag, Button, Modal,
  Row, Col, Badge, message, Popconfirm, Statistic, Progress,
  Alert, Input,
} from 'antd';
import {
  SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, BankOutlined, UserOutlined,
  DollarOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import {
  getWarranties,
  updateWarrantyStatus as updateStoredWarranty,
  savePayout,
  WarrantyRecord as WarrantyCandidate,
} from '@/services/localStorageService';
import { PayoutStatus } from '@/types/affiliate';

const { Title, Text } = Typography;

const INITIAL_WARRANTY_CANDIDATES: WarrantyCandidate[] = [
  {
    id: 'war-001',
    candidateName: 'Le Hoang Minh',
    candidateEmail: 'minh.le@example.com',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior React Developer (COD)',
    affiliateName: 'David Tran',
    onboardDate: '2026-07-15',
    warrantyEndDate: '2026-09-15',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 25000000,
    status: 'PASSED_PROBATION',
    notes: 'Đã hoàn thành xuất sắc 60 ngày thử việc. Kích hoạt mốc hoa hồng 25.000.000 đ cho CTV David Tran.',
  },
  {
    id: 'war-002',
    candidateName: 'Tran Thi Thu',
    candidateEmail: 'thu.tran@gmail.com',
    companyName: 'VNG Corporation',
    jobTitle: 'Product Manager - Fintech',
    affiliateName: 'Sarah Le',
    onboardDate: '2026-07-20',
    warrantyEndDate: '2026-09-20',
    totalDays: 60,
    daysPassed: 60,
    commissionAmount: 32000000,
    status: 'PASSED_PROBATION',
    notes: 'Khách hàng VNG đánh giá rất cao năng lực ứng viên.',
  },
  {
    id: 'war-003',
    candidateName: 'Le Thanh Dat',
    candidateEmail: 'dat.le@tech.io',
    companyName: 'Blata33 Technology JSC',
    jobTitle: 'Senior Fullstack Engineer',
    affiliateName: 'David Tran',
    onboardDate: '2026-08-10',
    warrantyEndDate: '2026-10-10',
    totalDays: 60,
    daysPassed: 43,
    commissionAmount: 28000000,
    status: 'IN_PROBATION',
    notes: 'Tiến độ thử việc thuận lợi, hòa nhập tốt với team dự án.',
  },
  {
    id: 'war-004',
    candidateName: 'Nguyen Van B',
    candidateEmail: 'vanb.devops@tech.io',
    companyName: 'Techcombank Digital Lab',
    jobTitle: 'DevOps Engineer (AWS/K8s)',
    affiliateName: 'Minh Vu Recruiter',
    onboardDate: '2026-08-25',
    warrantyEndDate: '2026-10-25',
    totalDays: 60,
    daysPassed: 28,
    commissionAmount: 18000000,
    status: 'IN_PROBATION',
    notes: 'Đang trong tháng thử việc đầu tiên.',
  },
  {
    id: 'war-005',
    candidateName: 'Hoang Van Nam',
    candidateEmail: 'nam.hoang@trash.io',
    companyName: 'NexGen AI Solutions Ltd',
    jobTitle: 'AI Engineer',
    affiliateName: 'Spam Affiliate Account',
    onboardDate: '2026-07-01',
    warrantyEndDate: '2026-08-30',
    totalDays: 60,
    daysPassed: 25,
    commissionAmount: 30000000,
    status: 'FAILED_PROBATION',
    notes: 'Ứng viên chủ động xin nghỉ việc giữa chừng do không phù hợp văn hóa. Kích hoạt bảo hành tìm người thay thế.',
  },
];


/**
 * Read combined warranties from localStorage 'hrconnect_warranty_records' and base warranties
 */
function loadAllWarranties(): WarrantyCandidate[] {
  const baseList = getWarranties();
  try {
    const raw = localStorage.getItem('hrconnect_warranty_records');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const converted: WarrantyCandidate[] = parsed.map((item: any) => ({
          id: item.id,
          candidateName: item.candidateName,
          candidateEmail: item.candidateEmail || '',
          companyName: item.companyName || 'Công ty đối tác',
          jobTitle: item.jobTitle || 'Vị trí tuyển dụng',
          affiliateName: item.affiliateEmail || item.affiliateName || 'Cộng tác viên HRConnect',
          onboardDate: item.startDate || new Date().toISOString().slice(0, 10),
          warrantyEndDate: item.warrantyEndDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          totalDays: item.maxDays || 60,
          daysPassed: item.daysWorked !== undefined ? item.daysWorked : (item.status === 'PASSED' ? 60 : 0),
          commissionAmount: item.commissionAmount || 25000000,
          status: item.status === 'PASSED' ? 'PASSED_PROBATION' : item.status === 'FAILED' ? 'FAILED_PROBATION' : 'IN_PROBATION',
          notes: item.notes || (item.status === 'PASSED' ? 'Đã hoàn thành 60 ngày thử việc (PASS).' : 'Đang trong thời gian bảo hành thử việc 60 ngày.'),
          clientDecision: item.clientDecision,
          clientFeedbackDate: item.clientFeedbackDate,
        }));

        const existingIds = new Set(converted.map((c) => c.id));
        const existingNames = new Set(converted.map((c) => c.candidateName.toLowerCase().trim()));

        const mergedBase = baseList
          .filter((b) => !existingIds.has(b.id) && !existingNames.has(b.candidateName.toLowerCase().trim()))
          .map((b) => {
            const matchInParsed = parsed.find(
              (p: any) =>
                p.id === b.id ||
                (p.candidateName && b.candidateName && p.candidateName.toLowerCase().trim() === b.candidateName.toLowerCase().trim())
            );
            if (matchInParsed) {
              return {
                ...b,
                clientDecision: matchInParsed.clientDecision || b.clientDecision,
                clientFeedbackDate: matchInParsed.clientFeedbackDate || b.clientFeedbackDate,
                daysPassed: matchInParsed.daysWorked !== undefined ? matchInParsed.daysWorked : (matchInParsed.status === 'PASSED' ? 60 : b.daysPassed),
                status: matchInParsed.status === 'PASSED' ? 'PASSED_PROBATION' : matchInParsed.status === 'FAILED' ? 'FAILED_PROBATION' : b.status,
              };
            }
            return b;
          });

        return [...converted, ...mergedBase];
      }
    }
  } catch (e) {
    console.error('Failed to load hrconnect_warranty_records:', e);
  }
  return baseList;
}

export const HRWarrantyTrackingPage: React.FC = () => {
  const [candidates, setCandidates] = useState<WarrantyCandidate[]>(loadAllWarranties);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<WarrantyCandidate | null>(null);
  const [failReason, setFailReason] = useState('');

  const refreshList = useCallback(() => {
    setCandidates(loadAllWarranties());
    message.success('Dữ liệu bảo hành đã được làm mới!');
  }, []);

  // Handle Mark Passed Probation
  const handlePassProbation = (target: string | WarrantyCandidate) => {
    const warrantyId = typeof target === 'string' ? target : target.id;
    const record = typeof target === 'string' ? candidates.find((c) => c.id === target) : target;
    const candidateName = record?.candidateName || '';
    const candidateEmail = record?.candidateEmail || '';
    const jobTitle = record?.jobTitle || '';

    // 1. Update hrconnect_warranty_records: { daysWorked: 60, status: 'PASSED' }
    try {
      const raw = localStorage.getItem('hrconnect_warranty_records');
      let wList: any[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) wList = parsed;
      }
      let found = false;
      wList = wList.map((w: any) => {
        const matchId = w.id === warrantyId || (record?.id && w.id === record.id);
        const matchName = candidateName && w.candidateName && w.candidateName.toLowerCase() === candidateName.toLowerCase();
        const matchEmail = candidateEmail && w.candidateEmail && w.candidateEmail.toLowerCase() === candidateEmail.toLowerCase();
        const matchJob = jobTitle && w.jobTitle && w.jobTitle.toLowerCase() === jobTitle.toLowerCase();
        if (matchId || (matchName && matchJob) || matchName) {
          found = true;
          return {
            ...w,
            daysWorked: 60,
            status: 'PASSED',
            notes: 'Đã hoàn thành xuất sắc 60 ngày thử việc (PASSED)',
            updatedAt: new Date().toISOString(),
          };
        }
        return w;
      });
      if (!found && record) {
        wList.push({
          id: warrantyId,
          candidateName: record.candidateName,
          candidateEmail: record.candidateEmail,
          companyName: record.companyName,
          jobTitle: record.jobTitle,
          affiliateName: record.affiliateName,
          daysWorked: 60,
          maxDays: 60,
          status: 'PASSED',
          notes: 'Đã hoàn thành xuất sắc 60 ngày thử việc (PASSED)',
          updatedAt: new Date().toISOString(),
        });
      }
      localStorage.setItem('hrconnect_warranty_records', JSON.stringify(wList));
    } catch (e) {
      console.error(e);
    }

    // 2. Find corresponding commission in hrconnect_commissions (by candidateName, candidateEmail or jobTitle) and sync:
    // probationDays: 60 (hoặc progress: 100), status: 'PAYABLE', statusLabel: 'Sẵn sàng nhận Payout'
    try {
      const comRaw = localStorage.getItem('hrconnect_commissions');
      let comList: any[] = [];
      if (comRaw) {
        const parsed = JSON.parse(comRaw);
        if (Array.isArray(parsed)) {
          comList = parsed;
        }
      }

      let found = false;
      const updatedComList = comList.map((com: any) => {
        const matchCandidate = candidateName && com.candidateName && com.candidateName.toLowerCase() === candidateName.toLowerCase();
        const matchEmail = candidateEmail && com.candidateEmail && com.candidateEmail.toLowerCase() === candidateEmail.toLowerCase();
        const matchJob = jobTitle && com.jobTitle && com.jobTitle.toLowerCase() === jobTitle.toLowerCase();
        const matchApp = record?.id && (com.applicationId === record.id || com.id === record.id);
        if (matchCandidate || matchEmail || matchJob || matchApp) {
          found = true;
          return {
            ...com,
            probationDays: 60,
            probationDaysPassed: 60,
            progress: 100,
            status: 'PAYABLE',
            statusLabel: 'Sẵn sàng nhận Payout',
            updatedAt: new Date().toISOString(),
          };
        }
        return com;
      });

      if (!found && candidateName) {
        updatedComList.unshift({
          id: 'COM-' + Date.now(),
          candidateName,
          candidateEmail,
          jobTitle: record?.jobTitle || '',
          companyName: record?.companyName || '',
          affiliateName: record?.affiliateName || 'David Tran',
          amount: record?.commissionAmount || 25000000,
          commissionRate: 15,
          probationDays: 60,
          probationDaysPassed: 60,
          progress: 100,
          status: 'PAYABLE',
          statusLabel: 'Sẵn sàng nhận Payout',
          createdAt: new Date().toISOString(),
        });
      }
      localStorage.setItem('hrconnect_commissions', JSON.stringify(updatedComList));
    } catch (e) {
      console.error(e);
    }

    // 3. Update stored warranty in hrconnect_warranties
    updateStoredWarranty(warrantyId, 'PASSED_PROBATION');

    // 4. Automatically create / update PAYABLE payout record for Platform Admin
    if (record) {
      savePayout({
        id: `pay-${Date.now()}`,
        candidateName: record.candidateName,
        affiliateName: record.affiliateName,
        affiliateBank: 'Techcombank',
        affiliateBankAccount: '190' + Math.floor(1000000000 + Math.random() * 9000000000),
        jobTitle: record.jobTitle,
        hiredDate: record.onboardDate,
        warrantyEndDate: record.warrantyEndDate,
        commissionAmount: record.commissionAmount || 25000000,
        status: PayoutStatus.PAYABLE,
      });
    }

    // 5. Update local state immediately
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === warrantyId || (candidateName && c.candidateName === candidateName)
          ? {
              ...c,
              status: 'PASSED_PROBATION',
              daysPassed: 60,
              notes: `Đã được xác nhận đạt thử việc (60/60 ngày). Mốc hoa hồng ${(record?.commissionAmount || 25000000).toLocaleString('vi-VN')} đ đã chuyển sang PAYABLE để Admin duyệt giải ngân.`,
            }
          : c
      )
    );

    message.success(
      `Đã xác nhận ${candidateName || warrantyId} ĐẠT THỬ VIỆC (60/60 ngày)! Trạng thái hoa hồng chuyển sang PAYABLE.`
    );
  };

  // Open Fail Modal
  const handleOpenFailModal = (record: WarrantyCandidate) => {
    setSelectedCandidate(record);
    setFailReason('');
    setReasonModalOpen(true);
  };

  // Confirm Fail Probation
  const handleConfirmFail = () => {
    if (!selectedCandidate) return;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === selectedCandidate.id
          ? {
              ...c,
              status: 'FAILED_PROBATION',
              notes: failReason || 'Ứng viên không đạt yêu cầu thử việc theo đánh giá của Client.',
            }
          : c
      )
    );
    message.warning(
      `Đã ghi nhận ứng viên ${selectedCandidate.candidateName} không đạt thử việc. Đã kích hoạt bảo hành tìm kiếm ứng viên thay thế.`
    );
    setReasonModalOpen(false);
  };

  const inProbationCount = candidates.filter((c) => c.status === 'IN_PROBATION').length;
  const passedCount = candidates.filter((c) => c.status === 'PASSED_PROBATION').length;
  const totalCommissionUnlocked = candidates
    .filter((c) => c.status === 'PASSED_PROBATION')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const columns: ColumnsType<WarrantyCandidate> = [
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
        </div>
      ),
    },
    {
      title: 'Doanh nghiệp & CTV giới thiệu',
      key: 'company',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            <BankOutlined style={{ marginRight: 4, color: '#0284c7' }} />
            {record.companyName}
          </div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 2, fontWeight: 500 }}>
            CTV: {record.affiliateName}
          </div>
        </div>
      ),
    },
    {
      title: 'Tiến độ Thử việc (60 ngày)',
      key: 'progress',
      width: 220,
      render: (_, record) => {
        const percent = Math.min(100, Math.round((record.daysPassed / record.totalDays) * 100));
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{record.daysPassed} / {record.totalDays} ngày</span>
              <span style={{ color: '#64748b' }}>{percent}%</span>
            </div>
            <Progress
              percent={percent}
              size="small"
              status={record.status === 'FAILED_PROBATION' ? 'exception' : percent === 100 ? 'success' : 'active'}
              strokeColor={record.status === 'FAILED_PROBATION' ? '#ef4444' : percent === 100 ? '#10b981' : '#0284c7'}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Onboard: {record.onboardDate} → Hết hạn: {record.warrantyEndDate}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Mốc hoa hồng CTV',
      dataIndex: 'commissionAmount',
      key: 'commission',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          {v.toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Trạng thái Bảo hành & Đánh giá Client',
      key: 'status',
      render: (_, record) => {
        return (
          <Space direction="vertical" size={4}>
            {record.clientDecision === 'PASSED' && (
              <div>
                <Tag color="green" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  Doanh nghiệp đã xác nhận PASS (60 ngày)
                </Tag>
              </div>
            )}
            {record.clientDecision === 'FAILED' && (
              <div>
                <Tag color="red" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                  <CloseCircleOutlined style={{ marginRight: 4 }} />
                  Doanh nghiệp báo FAIL - Cần xử lý bảo hành
                </Tag>
              </div>
            )}
            {record.status === 'PASSED_PROBATION' ? (
              <Badge status="success" text={<span style={{ fontWeight: 700, color: '#16a34a' }}>Đạt thử việc (Mở khóa Payout)</span>} />
            ) : record.status === 'IN_PROBATION' ? (
              <Badge status="processing" text={<span style={{ fontWeight: 700, color: '#0284c7' }}>Đang thử việc</span>} />
            ) : (
              <Badge status="error" text={<span style={{ fontWeight: 700, color: '#dc2626' }}>Thử việc không đạt</span>} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Thao tác HR',
      key: 'actions',
      render: (_, record) => (
        record.status === 'IN_PROBATION' ? (
          <Space size="small">
            <Popconfirm
              title="Xác nhận Đạt Thử Việc"
              description={`Xác nhận ứng viên ${record.candidateName} đã hoàn thành tốt giai đoạn thử việc để giải ngân hoa hồng?`}
              onConfirm={() => handlePassProbation(record)}
              okText="Đạt thử việc"
              cancelText="Hủy"
              okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{
                  borderRadius: 6,
                  fontSize: 12,
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  borderColor: '#16a34a',
                  fontWeight: 600,
                }}
              >
                Đạt thử việc
              </Button>
            </Popconfirm>

            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleOpenFailModal(record)}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Không đạt
            </Button>
          </Space>
        ) : (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {record.status === 'PASSED_PROBATION' ? '✓ Đã kích hoạt Milestone' : '✗ Đã kích hoạt BH thay thế'}
          </span>
        )
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            <SafetyCertificateOutlined style={{ color: '#059669', marginRight: 10 }} />
            Theo dõi Bảo hành 60 ngày & Milestone Hoa hồng (Internal HR)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Cổng cập nhật trạng thái thử việc của ứng viên để kích hoạt mốc hoa hồng (Milestone Payout) cho Platform & CTV, hoặc kích hoạt cam kết bảo hành tìm ứng viên thay thế cho Doanh nghiệp.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={refreshList} style={{ borderRadius: 8 }}>
          Làm mới dữ liệu
        </Button>
      </div>

      {/* Role Boundary Explanation Alert */}
      <Alert
        type="info"
        showIcon
        message={<strong>Quy tắc nghiệp vụ Internal HR (Lisa Pham)</strong>}
        description="Internal HR chịu trách nhiệm thẩm định chất lượng nhân sự trong giai đoạn thử việc 60 ngày. HR không sở hữu ví hoa hồng cá nhân như Headhunter/CTV tự do. Khi HR xác nhận 'Đạt thử việc', khoản hoa hồng sẽ tự động chuyển sang trạng thái PAYABLE trên trang Quản trị Tài chính (/admin/payouts) để Platform Admin thực thi giải ngân."
        style={{ marginBottom: 20, borderRadius: 10 }}
      />

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#eff6ff' }}>
            <Statistic
              title="Ứng viên đang trong thử việc"
              value={inProbationCount}
              valueStyle={{ color: '#0284c7', fontWeight: 800, fontSize: 28 }}
              prefix={<ClockCircleOutlined style={{ color: '#0284c7' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f0fdf4' }}>
            <Statistic
              title="Đã đạt thử việc (Passed)"
              value={passedCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 28 }}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Tổng hoa hồng đã kích hoạt giải ngân"
              value={totalCommissionUnlocked}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#059669', fontWeight: 800, fontSize: 18 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          dataSource={candidates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      {/* Fail Probation Modal */}
      <Modal
        open={reasonModalOpen}
        onCancel={() => setReasonModalOpen(false)}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#dc2626' }} />
            <span>Ghi nhận thử việc không đạt (Kích hoạt bảo hành)</span>
          </Space>
        }
        onOk={handleConfirmFail}
        okText="Xác nhận Không đạt"
        cancelText="Hủy"
        okButtonProps={{ danger: true, style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        {selectedCandidate && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="warning"
              showIcon
              message="Chính sách bảo hành HRConnect 60 ngày"
              description="Khi ghi nhận ứng viên không đạt thử việc, hệ thống sẽ tự động thông báo tới Doanh nghiệp và kích hoạt yêu cầu cung cấp ứng viên thay thế miễn phí cho vị trí này."
              style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <div style={{ marginBottom: 6, fontWeight: 600 }}>Lý do không đạt / Biên bản đánh giá:</div>
            <Input.TextArea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Nhập lý do chi tiết từ phía Doanh nghiệp (Năng lực, chuyên cần, văn hóa...)"
              rows={4}
              style={{ borderRadius: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HRWarrantyTrackingPage;
