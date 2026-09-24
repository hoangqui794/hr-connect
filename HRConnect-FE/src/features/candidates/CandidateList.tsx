import React, { useState, useMemo } from 'react';
import {
  Input, Select, Table, Tag, Typography, Space, Card, Row, Col,
  Avatar, Button, Tooltip, Badge,
} from 'antd';
import { SearchOutlined, DownloadOutlined, UserAddOutlined } from '@ant-design/icons';
import { useLargeCandidateSet } from '@/services/queries/useCandidates';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { AppStatusBadge } from '@/components/common/StatusBadge';
import { ScoreTier, ApplicationStatus, CVMode } from '@/types/candidate';
import { useApplicationStore, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/stores/applicationStore';
import type { Candidate } from '@/types/candidate';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const PAGE_SIZE = 50;

export const CandidateList: React.FC = () => {
  const { data: allCandidates, isLoading } = useLargeCandidateSet(500);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<ScoreTier | ''>('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);

  // Shared store: convert CandidateApplicationRecord → Candidate shape
  const sharedApps = useApplicationStore((s) => s.applications);
  const sharedCandidates = useMemo<Candidate[]>(
    () =>
      sharedApps.map((a) => ({
        id: a.id,
        name: a.fullName,
        email: a.email,
        phone: a.phone || '',
        location: 'Việt Nam',
        currentTitle: `Ứng tuyển: ${a.jobTitle}`,
        currentCompany: a.company,
        cvMode: CVMode.FILE_UPLOAD,
        highlightCard: {
          currentSalary: 0,
          expectedSalary: 0,
          currency: 'VND',
          yearsOfExperience: 0,
          primaryLanguage: 'Tiếng Việt',
          languageLevel: 'B2' as unknown as import('@/types/candidate').LanguageLevel,
          availabilityDate: a.applyDate,
          noticePeriod: 30,
          headline: `Ứng viên nộp qua ${a.source === 'AFFILIATE' ? `CTV ${a.affiliateName}` : 'Trực tiếp'}`,
        },
        skills: [],
        industries: [],
        applicationStatus: ApplicationStatus.APPLIED,
        aiScore: a.aiScore,
        scoreTier: a.aiScore >= 80 ? ScoreTier.TOP_FIT : a.aiScore >= 70 ? ScoreTier.STRONG : ScoreTier.MODERATE,
        createdAt: a.applyDate,
        updatedAt: a.applyDate,
      })),
    [sharedApps]
  );

  const filtered = useMemo(() => {
    // Merge shared-store candidates first, then mock data, de-dup by id
    const base = [...sharedCandidates, ...(allCandidates ?? [])];
    const seen = new Set<string>();
    const deduped = base.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    return deduped.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.currentTitle.toLowerCase().includes(search.toLowerCase()) ||
        c.currentCompany.toLowerCase().includes(search.toLowerCase()) ||
        c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
      const matchTier = !tierFilter || c.scoreTier === tierFilter;
      const matchStatus = !statusFilter || c.applicationStatus === statusFilter;
      return matchSearch && matchTier && matchStatus;
    });
  }, [sharedCandidates, allCandidates, search, tierFilter, statusFilter]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const columns: ColumnsType<Candidate> = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      width: 250,
      minWidth: 230,
      fixed: 'left',
      render: (_, record) => {
        const headline = record.highlightCard?.headline || '';
        const isFromAffiliate = headline.includes('CTV');
        const isDirect = headline.includes('Trực tiếp');
        return (
          <Space size={10}>
            <Avatar
              size={36}
              style={{
                background: `hsl(${(record.name.charCodeAt(0) * 17) % 360}, 60%, 50%)`,
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {record.name.slice(0, 2).toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', lineHeight: 1.3 }}>
                {record.name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{record.location}</div>
              {isFromAffiliate && (
                <Tag color="orange" style={{ borderRadius: 4, fontSize: 10, marginTop: 3, padding: '0 6px', fontWeight: 600 }}>
                  {headline.replace('Ứng viên nộp qua ', '')}
                </Tag>
              )}
              {isDirect && (
                <Tag color="blue" style={{ borderRadius: 4, fontSize: 10, marginTop: 3, padding: '0 6px', fontWeight: 600 }}>
                  Ứng tuyển trực tiếp
                </Tag>
              )}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Vị trí hiện tại',
      key: 'role',
      width: 200,
      minWidth: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{record.currentTitle}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.currentCompany}</div>
        </div>
      ),
    },
    {
      title: 'Kinh nghiệm',
      key: 'yoe',
      width: 100,
      minWidth: 90,
      align: 'center',
      sorter: (a, b) => a.highlightCard.yearsOfExperience - b.highlightCard.yearsOfExperience,
      render: (_, record) => (
        <div style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
          {record.highlightCard.yearsOfExperience}
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 2 }}>năm</span>
        </div>
      ),
    },
    {
      title: 'Mức lương kỳ vọng',
      key: 'salary',
      width: 170,
      minWidth: 160,
      sorter: (a, b) => a.highlightCard.expectedSalary - b.highlightCard.expectedSalary,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#10b981', fontSize: 13 }}>
            {record.highlightCard.expectedSalary.toLocaleString('vi-VN')} đ/tháng
          </div>
        </div>
      ),
    },
    {
      title: 'Điểm phù hợp AI',
      key: 'score',
      width: 170,
      minWidth: 160,
      sorter: (a, b) => (a.aiScore ?? 0) - (b.aiScore ?? 0),
      render: (_, record) =>
        record.aiScore !== undefined ? (
          <ScoreTierTag score={record.aiScore} showScore />
        ) : (
          <Tag style={{ borderRadius: 6, color: '#94a3b8', fontSize: 11 }}>Chưa sàng lọc</Tag>
        ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 170,
      minWidth: 160,
      render: (_, record) =>
        record.applicationStatus ? (
          <AppStatusBadge status={record.applicationStatus} />
        ) : null,
    },
    {
      title: 'Kỹ năng',
      key: 'skills',
      width: 200,
      minWidth: 180,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {record.skills.slice(0, 3).map((s) => (
            <Tag key={s} style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>{s}</Tag>
          ))}
          {record.skills.length > 3 && (
            <Tooltip title={record.skills.slice(3).join(', ')}>
              <Tag style={{ borderRadius: 6, fontSize: 11, cursor: 'pointer', margin: 0 }}>
                +{record.skills.length - 3}
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian nhận việc',
      key: 'available',
      width: 120,
      minWidth: 110,
      render: (_, record) => (
        <div style={{ fontSize: 12, color: '#475569' }}>
          {new Date(record.highlightCard.availabilityDate).toLocaleDateString('vi-VN')}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>Candidate Pool</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {isLoading ? 'Loading...' : `${filtered.length.toLocaleString()} candidates`}
              {allCandidates && ` of ${allCandidates.length.toLocaleString()} total`}
            </Text>
          </div>
          <Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>Export CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by name, title, company, or skill..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              placeholder="Filter by AI tier"
              value={tierFilter || undefined}
              onChange={(v: ScoreTier | undefined) => { setTierFilter(v ?? ''); setPage(1); }}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: ScoreTier.TOP_FIT, label: '🔴 Top Fit (≥80%)' },
                { value: ScoreTier.STRONG, label: '🟢 Strong (70-79%)' },
                { value: ScoreTier.MODERATE, label: '🟡 Moderate (60-69%)' },
                { value: ScoreTier.WEAK, label: '⚪ Weak (<60%)' },
              ]}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Select
              placeholder="Filter by status"
              value={statusFilter || undefined}
              onChange={(v: ApplicationStatus | undefined) => { setStatusFilter(v ?? ''); setPage(1); }}
              allowClear
              style={{ width: '100%' }}
              options={Object.values(ApplicationStatus).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Table
          columns={columns}
          dataSource={paginated}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total.toLocaleString()} candidates`,
          }}
          size="middle"
        />
      </Card>
    </div>
  );
};
