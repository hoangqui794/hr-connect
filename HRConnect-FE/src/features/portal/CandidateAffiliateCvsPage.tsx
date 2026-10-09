import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Skeleton } from 'antd';
import { FilePdfOutlined, RightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { candidateAffiliateCvApi } from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { fileSize } from './mf02Labels';

export const candidateAffiliateCvKeys = {
  all: ['candidate-affiliate-cvs'] as const,
  list: (page: number) => ['candidate-affiliate-cvs', 'list', page] as const,
};

export const CandidateAffiliateCvsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canView = useAuthStore((state) => state.hasPermission('cv.view_own'));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = 10;
  const query = useQuery({
    queryKey: candidateAffiliateCvKeys.list(page),
    queryFn: () => candidateAffiliateCvApi.list(page, pageSize),
    enabled: canView,
    placeholderData: (previous) => previous,
  });
  const items = query.data?.items ?? [];

  return (
    <div>
      <PageHero
        eyebrow="Quyền riêng tư CV"
        title="CV do Affiliate đã nộp"
        description="Kiểm tra những CV Affiliate đã tải thay bạn. Bạn có thể xem nguồn gửi, lịch sử sử dụng và quản lý quyền dùng lại ở trang chi tiết."
      />

      {!canView ? (
        <Alert type="error" showIcon message="Bạn không có quyền xem CV Affiliate đã nộp." />
      ) : query.isLoading ? (
        <Skeleton active paragraph={{ rows: 7 }} />
      ) : query.isError ? (
        <Alert type="error" showIcon message="Không tải được danh sách CV" description={getApiErrorMessage(query.error)} />
      ) : items.length === 0 ? (
        <Surface className="p-10 text-center">
          <SafetyCertificateOutlined className="text-3xl text-teal-700" aria-hidden />
          <p className="m-0 mt-3 font-semibold text-slate-900">Chưa có CV nào do Affiliate tải lên</p>
          <p className="m-0 mt-1 text-sm text-slate-600">Khi một Affiliate giới thiệu bạn, CV và quyền sử dụng sẽ xuất hiện tại đây.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {items.map((cv) => {
            const reuseAllowed = cv.affiliateReuseStatus === 'ALLOWED';
            return (
              <article key={cv.cvId} className="admin-surface flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-2xl text-red-700" aria-hidden>
                    <FilePdfOutlined />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-base font-bold text-slate-900">{cv.title || cv.fileName || 'CV Affiliate'}</h2>
                    <p className="m-0 mt-1 truncate text-xs text-slate-500">{cv.fileName || 'Tệp PDF'} · {fileSize(cv.fileSizeBytes)}</p>
                  </div>
                  <StatusDot tone={reuseAllowed ? 'success' : 'neutral'}>{reuseAllowed ? 'Cho phép dùng lại' : 'Không cho dùng lại'}</StatusDot>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">Affiliate nguồn</dt><dd className="m-0 mt-1 font-medium text-slate-900">{cv.affiliateDisplayName}</dd></div>
                  <div><dt className="text-slate-500">Ngày tải</dt><dd className="m-0 mt-1 font-medium text-slate-900">{dayjs(cv.createdAt).format('DD/MM/YYYY')}</dd></div>
                  <div><dt className="text-slate-500">Lượt nộp</dt><dd className="m-0 mt-1 font-medium text-slate-900">{cv.submissionCount}</dd></div>
                  <div><dt className="text-slate-500">Đã đồng ý</dt><dd className="m-0 mt-1 font-medium text-slate-900">{cv.acceptedSubmissionCount}</dd></div>
                </dl>

                {cv.pendingConsentCount > 0 && (
                  <Alert type="warning" showIcon message={`${cv.pendingConsentCount} yêu cầu đang chờ bạn xác nhận`} />
                )}

                <Button type="link" className="!h-auto self-start !p-0" onClick={() => navigate(`/candidate/affiliate-cvs/${cv.cvId}`)}>
                  Xem chi tiết và quyền sử dụng <RightOutlined />
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {(query.data?.totalPages ?? 0) > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={query.data?.total ?? 0}
            showSizeChanger={false}
            onChange={(nextPage) => setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })}
          />
        </div>
      )}
    </div>
  );
};
