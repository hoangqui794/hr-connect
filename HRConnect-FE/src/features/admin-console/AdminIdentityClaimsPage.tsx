import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Input, Select, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  AdminCandidateDuplicateRiskLevel,
  AdminCandidateDuplicateStatus,
  AdminIdentityClaimListItem,
  AdminIdentityClaimStatus,
} from '@/types/api/mf02';
import { AdminDuplicateCasesPanel } from './AdminDuplicateCasesPanel';
import { formatDateTime } from './adminTheme';
import { PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';

const PAGE_SIZE = 20;
const DEFAULT_STATUS = 'PENDING_ADMIN_REVIEW';

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PENDING_ADMIN_REVIEW: { label: 'Chờ đối chiếu', tone: 'warning' },
  COMPLETED: { label: 'Đã liên kết', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
  EXPIRED: { label: 'Đã hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const statusOptions = Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }));

export const AdminIdentityClaimsPage: React.FC = () => {
  const canReview = useAuthStore((state) => state.hasPermission('candidate.identity.review'));
  const canViewDuplicates = useAuthStore((state) => state.hasPermission('candidate_duplicate.view'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [duplicateRefreshSignal, setDuplicateRefreshSignal] = useState(0);

  const requestedTab = searchParams.get('tab');
  const activeTab: 'claims' | 'duplicates' =
    requestedTab === 'duplicates' && canViewDuplicates
      ? 'duplicates'
      : canReview
        ? 'claims'
        : 'duplicates';

  const status = (searchParams.get('status') ?? DEFAULT_STATUS) as AdminIdentityClaimStatus;
  const search = searchParams.get('q') ?? undefined;
  const page = Number(searchParams.get('page')) || 1;
  const sortBy = (searchParams.get('sortBy') as 'createdAt' | 'verifiedAt' | 'reviewedAt' | null) ?? 'createdAt';
  const sortDirection = (searchParams.get('sortDirection') as 'asc' | 'desc' | null) ?? 'desc';
  const params = { status, search, page, pageSize: PAGE_SIZE, sortBy, sortDirection };

  const dupStatus = (searchParams.get('dupStatus') ?? undefined) as AdminCandidateDuplicateStatus | undefined;
  const dupRisk = (searchParams.get('risk') ?? undefined) as AdminCandidateDuplicateRiskLevel | undefined;
  const dupSearch = searchParams.get('dupQ') ?? undefined;
  const dupPage = Number(searchParams.get('dupPage')) || 1;

  const list = useQuery({
    queryKey: ['admin-candidate-identity-claims', params],
    queryFn: () => adminIdentityClaimApi.list(params),
    enabled: canReview && activeTab === 'claims',
    placeholderData: (previous) => previous,
  });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'dupPage') {
      next.delete('page');
      next.delete('dupPage');
    }
    setSearchParams(next);
  };

  const columns: ColumnsType<AdminIdentityClaimListItem> = [
    {
      title: 'Candidate yêu cầu',
      key: 'requester',
      render: (_, item) => (
        <PersonCell
          name={item.requesterCandidateName || item.requesterDisplayName}
          secondary={`${item.requesterDisplayName} · ${item.requesterPrimaryEmail}`}
        />
      ),
    },
    {
      title: 'Email cần khôi phục',
      dataIndex: 'maskedAssertedEmail',
      width: 210,
      render: (value: string) => <span className="font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Hồ sơ cần liên kết',
      dataIndex: 'targetCandidateName',
      width: 210,
      render: (value: string | null) => value || <span className="text-slate-500">Chưa xác định</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      render: (value: string) => (
        <StatusDot tone={STATUS_META[value]?.tone ?? 'neutral'}>{STATUS_META[value]?.label ?? value}</StatusDot>
      ),
    },
    {
      title: sortBy === 'verifiedAt' ? 'Xác minh lúc' : sortBy === 'reviewedAt' ? 'Xử lý lúc' : 'Tạo lúc',
      key: 'time',
      width: 165,
      render: (_, item) => formatDateTime(sortBy === 'verifiedAt' ? item.verifiedAt : sortBy === 'reviewedAt' ? item.reviewedAt : item.createdAt),
    },
  ];

  if (!canReview && !canViewDuplicates) {
    return <Alert type="error" showIcon message="Bạn không có quyền đối chiếu yêu cầu khôi phục danh tính Candidate." />;
  }

  const data = list.data;
  const tabItems = [
    ...(canReview ? [{ key: 'claims', label: 'Yêu cầu khôi phục email' }] : []),
    ...(canViewDuplicates ? [{ key: 'duplicates', label: 'Hồ sơ nghi trùng' }] : []),
  ];

  return (
    <div className="admin-stagger space-y-5">
      <PageHero
        eyebrow="Vận hành"
        title="Đối chiếu danh tính Candidate"
        description="Kiểm tra yêu cầu khôi phục hồ sơ cũ và xử lý các cặp hồ sơ nghi trùng trước khi hợp nhất dữ liệu CV, lịch sử ứng tuyển."
        actions={
          <Button
            icon={<ReloadOutlined />}
            loading={activeTab === 'claims' && list.isFetching && !list.isLoading}
            onClick={() => {
              if (activeTab === 'duplicates') {
                setDuplicateRefreshSignal((count) => count + 1);
              } else {
                list.refetch();
              }
            }}
          >
            Tải lại
          </Button>
        }
      />

      <Surface>
        {tabItems.length > 1 && (
          <div className="border-b border-slate-200 px-5 pt-2">
            <Tabs
              activeKey={activeTab}
              items={tabItems}
              className="mb-0"
              onChange={(key) => {
                const next = new URLSearchParams(searchParams);
                if (key === 'duplicates') next.set('tab', 'duplicates');
                else next.delete('tab');
                setSearchParams(next);
              }}
            />
          </div>
        )}

        {activeTab === 'duplicates' ? (
          <AdminDuplicateCasesPanel
            status={dupStatus}
            riskLevel={dupRisk}
            search={dupSearch}
            page={dupPage}
            onParamChange={setParam}
            refreshSignal={duplicateRefreshSignal}
          />
        ) : (
          <>
            <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
              <Select
                size="large"
                value={status}
                options={statusOptions}
                className="w-52"
                onChange={(value) => setParam('status', value)}
                aria-label="Lọc theo trạng thái"
              />
              <Input
                allowClear
                size="large"
                defaultValue={search}
                prefix={<SearchOutlined className="text-slate-500" aria-hidden />}
                placeholder="Tên hoặc email... nhấn Enter"
                className="max-w-xs"
                maxLength={100}
                onPressEnter={(event) => setParam('q', event.currentTarget.value.trim() || undefined)}
                onChange={(event) => !event.target.value && search && setParam('q', undefined)}
                aria-label="Tìm yêu cầu danh tính"
              />
              <Select
                size="large"
                value={`${sortBy}:${sortDirection}`}
                className="w-52"
                onChange={(value: string) => {
                  const [nextSortBy, nextDirection] = value.split(':');
                  const next = new URLSearchParams(searchParams);
                  next.set('sortBy', nextSortBy);
                  next.set('sortDirection', nextDirection);
                  next.delete('page');
                  setSearchParams(next);
                }}
                options={[
                  { value: 'createdAt:desc', label: 'Mới tạo gần nhất' },
                  { value: 'createdAt:asc', label: 'Cũ nhất trước' },
                  { value: 'verifiedAt:desc', label: 'Mới xác minh gần nhất' },
                  { value: 'reviewedAt:desc', label: 'Mới xử lý gần nhất' },
                ]}
                aria-label="Sắp xếp yêu cầu"
              />
              {data && <span className="ml-auto text-sm text-slate-600 tabular-nums">{data.total} yêu cầu</span>}
            </div>

            {list.isError ? (
              <div className="p-5">
                <Alert
                  type="error"
                  showIcon
                  message="Không tải được yêu cầu khôi phục danh tính"
                  description={getApiErrorMessage(list.error)}
                />
              </div>
            ) : (
              <Table<AdminIdentityClaimListItem>
                className="admin-soft-table w-full table-auto"
                rowKey="claimId"
                loading={list.isLoading}
                columns={columns}
                dataSource={data?.items ?? []}
                locale={{
                  emptyText:
                    status === DEFAULT_STATUS
                      ? 'Không có yêu cầu nào đang chờ đối chiếu.'
                      : 'Không có yêu cầu phù hợp bộ lọc.',
                }}
                onRow={(item) => ({
                  onClick: () => navigate(`/admin/candidate-identity-claims/${item.claimId}`),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') navigate(`/admin/candidate-identity-claims/${item.claimId}`);
                  },
                  tabIndex: 0,
                  className: 'cursor-pointer',
                  'aria-label': `Mở yêu cầu của ${item.requesterCandidateName}`,
                })}
                pagination={{
                  current: data?.page ?? page,
                  pageSize: PAGE_SIZE,
                  total: data?.total ?? 0,
                  showSizeChanger: false,
                  hideOnSinglePage: true,
                  onChange: (nextPage) => setParam('page', String(nextPage)),
                }}
              />
            )}
          </>
        )}
      </Surface>
    </div>
  );
};

export default AdminIdentityClaimsPage;
