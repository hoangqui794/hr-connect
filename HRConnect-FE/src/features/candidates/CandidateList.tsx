import React, { useState, useMemo } from 'react';
import {
  Input, Select, Table, Tag, Space, Row, Col,
  Avatar, Button, Tooltip,
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useLargeCandidateSet } from '@/services/queries/useCandidates';
import { ScoreTierTag } from '@/components/common/ScoreTierTag';
import { CandidateHighlightPills } from '@/components/common/CandidateHighlightPills';
import { AntiDuplicationBadge } from '@/components/common/AntiDuplicationBadge';
import { PageHeaderB2B } from '@/components/common/PageHeaderB2B';
import { AppStatusBadge } from '@/components/common/StatusBadge';
import { ScoreTier, ApplicationStatus, CVMode } from '@/types/candidate';
import { useApplicationStore } from '@/stores/applicationStore';
import type { Candidate } from '@/types/candidate';
import type { ColumnsType } from 'antd/es/table';

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
          yearsOfExperience: 3,
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
      title: 'ỨNG VIÊN & THÔNG SỐ HIGHLIGHT',
      key: 'candidate',
      width: 320,
      minWidth: 300,
      fixed: 'left',
      render: (_, record) => {
        const headline = record.highlightCard?.headline || '';
        const isFromAffiliate = headline.includes('CTV');
        const isDirect = headline.includes('Trực tiếp');
        return (
          <div className="space-y-1.5 py-1">
            <div className="flex items-center gap-3">
              <Avatar
                size={38}
                style={{
                  background: `hsl(${(record.name.charCodeAt(0) * 23) % 360}, 60%, 45%)`,
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {record.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-100 hover:text-blue-400 cursor-pointer">
                  {record.name}
                </div>
                <div className="text-xs text-slate-400">
                  {record.location}
                  {isFromAffiliate && (
                    <span className="text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {headline.replace('Ứng viên nộp qua ', '')}
                    </span>
                  )}
                  {isDirect && (
                    <span className="text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Trực tiếp
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Candidate Highlight Data-Pills */}
            <CandidateHighlightPills
              yearsOfExperience={record.highlightCard.yearsOfExperience}
              currentSalary={record.highlightCard.currentSalary}
              expectedSalary={record.highlightCard.expectedSalary}
              language={record.highlightCard.primaryLanguage}
              languageLevel={record.highlightCard.languageLevel as any}
              availabilityDate={record.highlightCard.availabilityDate}
              noticePeriodDays={record.highlightCard.noticePeriod}
            />

            {/* Anti-Duplication Timestamp Badge */}
            <div>
              <AntiDuplicationBadge
                timestamp={record.createdAt}
              />
            </div>
          </div>
        );
      },
    },
    {
      title: 'VỊ TRÍ HIỆN TẠI',
      key: 'role',
      width: 200,
      minWidth: 180,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium text-slate-200">{record.currentTitle}</div>
          <div className="text-xs text-slate-400 mt-0.5">{record.currentCompany}</div>
        </div>
      ),
    },
    {
      title: 'ĐIỂM AI MATCH',
      key: 'score',
      width: 170,
      minWidth: 160,
      sorter: (a, b) => (a.aiScore ?? 0) - (b.aiScore ?? 0),
      render: (_, record) =>
        record.aiScore !== undefined ? (
          <ScoreTierTag score={record.aiScore} showScore />
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Chưa sàng lọc</span>
        ),
    },
    {
      title: 'TRẠNG THÁI',
      key: 'status',
      width: 160,
      minWidth: 150,
      render: (_, record) =>
        record.applicationStatus ? (
          <AppStatusBadge status={record.applicationStatus} />
        ) : null,
    },
    {
      title: 'KỸ NĂNG NỔI BẬT',
      key: 'skills',
      width: 220,
      minWidth: 200,
      render: (_, record) => (
        <div className="flex gap-1.5 flex-wrap">
          {record.skills.slice(0, 3).map((s) => (
            <span key={s} className="b2b-data-pill">{s}</span>
          ))}
          {record.skills.length > 3 && (
            <Tooltip title={record.skills.slice(3).join(', ')}>
              <span className="b2b-data-pill cursor-pointer">
                +{record.skills.length - 3}
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeaderB2B
        title="Kho Dữ Liệu Ứng Viên (Candidate Pool)"
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25">
            {isLoading ? 'Đang tải...' : `${filtered.length.toLocaleString()} Ứng viên`}
          </span>
        }
        subtitle="Hệ cơ sở dữ liệu ứng viên đa nguồn: nộp trực tiếp và từ mạng lưới Affiliate Headhunter có đối soát First-Submission."
        actions={
          <Button
            icon={<DownloadOutlined />}
            className="rounded-xl font-semibold bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-200"
          >
            Xuất dữ liệu CSV
          </Button>
        }
      />

      {/* ─── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="b2b-card p-4">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10}>
            <Input
              prefix={<SearchOutlined className="text-slate-500 mr-1" />}
              placeholder="Tìm theo họ tên, chức danh, công ty hoặc kỹ năng..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              allowClear
              className="bg-slate-950/60 border-slate-800 text-white rounded-xl h-10 placeholder:text-slate-600 hover:border-slate-700"
            />
          </Col>
          <Col xs={12} sm={7}>
            <Select
              placeholder="Lọc theo phân hạng AI Match"
              value={tierFilter || undefined}
              onChange={(v: ScoreTier | undefined) => { setTierFilter(v ?? ''); setPage(1); }}
              allowClear
              className="w-full h-10"
              options={[
                { value: ScoreTier.TOP_FIT, label: '🔴 Top Match (≥80%)' },
                { value: ScoreTier.STRONG, label: '🟢 Phù hợp cao (70-79%)' },
                { value: ScoreTier.MODERATE, label: '🟡 Phù hợp (60-69%)' },
                { value: ScoreTier.WEAK, label: '⚪ Cần cân nhắc (<60%)' },
              ]}
            />
          </Col>
          <Col xs={12} sm={7}>
            <Select
              placeholder="Lọc theo trạng thái hồ sơ"
              value={statusFilter || undefined}
              onChange={(v: ApplicationStatus | undefined) => { setStatusFilter(v ?? ''); setPage(1); }}
              allowClear
              className="w-full h-10"
              options={Object.values(ApplicationStatus).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            />
          </Col>
        </Row>
      </div>

      {/* ─── Candidates Table ─────────────────────────────────────────────── */}
      <div className="b2b-card overflow-hidden">
        <Table
          columns={columns}
          dataSource={paginated}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1200 }}
          className="bg-transparent"
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} trong tổng số ${total.toLocaleString()} hồ sơ`,
          }}
          size="middle"
        />
      </div>
    </div>
  );
};

export default CandidateList;
