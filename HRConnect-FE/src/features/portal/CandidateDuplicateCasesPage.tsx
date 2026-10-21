import React, { useState } from 'react';
import { Alert, Button, Empty, Pagination, Select, Skeleton, Tag } from 'antd';
import { ArrowLeftOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { candidateDuplicateApi } from '@/services/api/mf02/candidateDuplicateApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { CandidateDuplicateStatus } from '@/types/api/mf02/candidateDuplicate';
import type { Tone } from '@/features/admin-console/ui';
import { StatusDot } from '@/features/admin-console/ui';
import { CandidatePageHeader, CandidateSurface } from './candidate/CandidateUi';

export const candidateDuplicateKeys = {
  all: ['candidate-duplicate-cases'] as const,
  list: (status: string, page: number) => ['candidate-duplicate-cases', 'list', status, page] as const,
  detail: (caseId: string) => ['candidate-duplicate-cases', 'detail', caseId] as const,
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Đang chờ đối chiếu', tone: 'info' },
  AWAITING_CANDIDATE: { label: 'Cần bạn xác minh', tone: 'warning' },
  UNDER_REVIEW: { label: 'Admin đang đối chiếu', tone: 'warning' },
  BLOCKED_FINANCE: { label: 'Đang kiểm tra quyền lợi', tone: 'warning' },
  MERGED: { label: 'Đã hợp nhất hồ sơ', tone: 'success' },
  DISMISSED: { label: 'Đã xác nhận không trùng', tone: 'neutral' },
};

const EVIDENCE: Record<string, string> = {
  VERIFIED_EMAIL: 'Email cũ đã được xác minh',
  MATCHING_CV_AND_NAME: 'Tên và CV có dấu hiệu trùng khớp',
  OTHER_REVIEW_SIGNAL: 'Có thông tin cần Admin đối chiếu',
};

const statusMeta = (status: CandidateDuplicateStatus) => STATUS[status] ?? { label: 'Đang được xử lý', tone: 'neutral' as Tone };

export const CandidateDuplicateCasesPage: React.FC = () => {
  const navigate = useNavigate();
  const canManage = useAuthStore((state) => state.hasPermission('candidate.identity.manage_own'));
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: candidateDuplicateKeys.list(status, page),
    queryFn: () => candidateDuplicateApi.listMine({ status: status === 'ALL' ? undefined : status, page, pageSize: 10 }),
    enabled: canManage,
  });

  if (!canManage) return <Alert type="error" showIcon message="Bạn không có quyền xem hồ sơ đối chiếu." />;

  return (
    <div className="candidate-page space-y-5">
      <CandidatePageHeader
        eyebrow="Bảo vệ danh tính"
        title="Hồ sơ đang được đối chiếu"
        description="Theo dõi các trường hợp hệ thống phát hiện nhiều hồ sơ có thể cùng thuộc về bạn. HR Connect chỉ hiển thị thông tin an toàn của chính bạn."
        actions={<Button icon={<LinkOutlined />} onClick={() => navigate('/candidate/settings/email-identities')}>Xác minh email cũ</Button>}
      />

      <CandidateSurface className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-900">Các trường hợp của bạn</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">Bạn sẽ nhận thông báo khi Admin hoàn tất đối chiếu.</p>
          </div>
          <Select
            aria-label="Lọc trạng thái đối chiếu"
            value={status}
            className="min-w-52"
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'AWAITING_CANDIDATE', label: 'Cần tôi xác minh' },
              { value: 'UNDER_REVIEW', label: 'Admin đang đối chiếu' },
              { value: 'MERGED', label: 'Đã hợp nhất' },
              { value: 'DISMISSED', label: 'Không trùng' },
              { value: 'BLOCKED_FINANCE', label: 'Kiểm tra quyền lợi' },
            ]}
          />
        </div>

        {query.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : query.isError ? (
          <Alert type="error" showIcon message="Không tải được hồ sơ đối chiếu" description={getApiErrorMessage(query.error)} />
        ) : !query.data?.items.length ? (
          <Empty description="Bạn chưa có hồ sơ nào cần đối chiếu." />
        ) : (
          <div className="space-y-3">
            {query.data.items.map((item) => {
              const meta = statusMeta(item.status);
              return (
                <button
                  key={item.duplicateCaseId}
                  type="button"
                  onClick={() => navigate(`/candidate/settings/duplicate-cases/${item.duplicateCaseId}`)}
                  className="w-full cursor-pointer rounded-2xl border border-solid border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="m-0 text-base font-bold text-slate-900">{item.title}</h3>
                      <p className="m-0 mt-1 text-sm leading-6 text-slate-600">{item.guidance}</p>
                    </div>
                    <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
                  </div>
                  {item.job && <p className="m-0 mt-3 text-sm font-medium text-slate-700">{item.job.title} · {item.job.companyName}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.evidenceTypes.map((value) => <Tag key={value}>{EVIDENCE[value] ?? 'Thông tin cần đối chiếu'}</Tag>)}
                    <span className="ml-auto text-xs text-slate-500">Cập nhật {dayjs(item.updatedAt).format('HH:mm DD/MM/YYYY')}</span>
                  </div>
                </button>
              );
            })}
            {query.data.totalPages > 1 && (
              <div className="flex justify-end pt-2"><Pagination current={page} pageSize={10} total={query.data.totalCount} showSizeChanger={false} onChange={setPage} /></div>
            )}
          </div>
        )}
      </CandidateSurface>

      <Alert type="info" showIcon icon={<SafetyCertificateOutlined />} message="Không cần gửi CCCD" description="Hệ thống sử dụng email đã xác minh, lịch sử CV và dữ liệu nghiệp vụ để đối chiếu. Không gửi giấy tờ tùy thân qua ghi chú hoặc khiếu nại." />
    </div>
  );
};

export const CandidateDuplicateCaseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { caseId = '' } = useParams<{ caseId: string }>();
  const canManage = useAuthStore((state) => state.hasPermission('candidate.identity.manage_own'));
  const query = useQuery({
    queryKey: candidateDuplicateKeys.detail(caseId),
    queryFn: () => candidateDuplicateApi.getMine(caseId),
    enabled: canManage && Boolean(caseId),
  });

  if (!canManage) return <Alert type="error" showIcon message="Bạn không có quyền xem hồ sơ đối chiếu." />;
  if (query.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (query.isError || !query.data) return <Alert type="error" showIcon message="Không tải được hồ sơ đối chiếu" description={getApiErrorMessage(query.error)} action={<Button onClick={() => navigate('/candidate/settings/duplicate-cases')}>Về danh sách</Button>} />;

  const item = query.data;
  const meta = statusMeta(item.status);
  return (
    <div className="candidate-page space-y-5">
      <CandidatePageHeader
        eyebrow="Chi tiết đối chiếu"
        title={item.title}
        description={item.guidance}
        actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/candidate/settings/duplicate-cases')}>Danh sách</Button>}
      />
      <CandidateSurface className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-slate-100 pb-4">
          <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
          <span className="text-xs text-slate-500">Cập nhật {dayjs(item.updatedAt).format('HH:mm DD/MM/YYYY')}</span>
        </div>
        {item.job && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tin tuyển dụng liên quan</div>
            <div className="mt-1 font-bold text-slate-900">{item.job.title}</div>
            <div className="text-sm text-slate-600">{item.job.companyName}</div>
          </div>
        )}
        <div className="mt-5">
          <h2 className="m-0 text-sm font-bold text-slate-900">Thông tin đã được ghi nhận</h2>
          <div className="mt-3 flex flex-wrap gap-2">{item.evidenceTypes.map((value) => <Tag key={value} color="blue">{EVIDENCE[value] ?? 'Thông tin cần đối chiếu'}</Tag>)}</div>
        </div>
        {item.actionRequired && <Alert className="mt-5" type="warning" showIcon message="Bạn cần xác minh email cũ" description="Sau khi xác minh thành công, Admin mới có đủ căn cứ để tiếp tục đối chiếu." action={<Button type="primary" onClick={() => navigate('/candidate/settings/email-identities')}>Xác minh ngay</Button>} />}
        {item.resolution && <Alert className="mt-5" type={item.status === 'MERGED' ? 'success' : 'info'} showIcon message="Kết quả đối chiếu" description={item.status === 'MERGED' ? 'Dữ liệu hợp lệ đã được giữ trong hồ sơ chính của bạn.' : 'Admin đã hoàn tất đối chiếu và xác nhận các hồ sơ độc lập.'} />}
      </CandidateSurface>
    </div>
  );
};

export default CandidateDuplicateCasesPage;
