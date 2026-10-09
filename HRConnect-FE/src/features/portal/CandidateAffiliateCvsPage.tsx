import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Pagination, Popconfirm, Skeleton } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, FilePdfOutlined, RightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { candidateAffiliateCvApi } from '@/services/api/mf02Api';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { fileSize, submissionStatus } from './mf02Labels';
import { candidateKeys, useOpenSignedUrl } from './CandidatePages';

export const candidateAffiliateCvKeys = {
  all: ['candidate-affiliate-cvs'] as const,
  list: (page: number) => ['candidate-affiliate-cvs', 'list', page] as const,
  detail: (cvId: string) => ['candidate-affiliate-cvs', 'detail', cvId] as const,
  usages: (cvId: string, page: number) => ['candidate-affiliate-cvs', 'usages', cvId, page] as const,
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

export const CandidateAffiliateCvDetailPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSigned = useOpenSignedUrl();
  const { cvId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = 10;
  const canView = useAuthStore((state) => state.hasPermission('cv.view_own'));
  const canManageReuse = useAuthStore((state) => state.hasPermission('cv.affiliate_reuse.manage_own'));
  const canAdopt = useAuthStore((state) => state.hasPermission('cv.create'));

  const detail = useQuery({
    queryKey: candidateAffiliateCvKeys.detail(cvId),
    queryFn: () => candidateAffiliateCvApi.detail(cvId),
    enabled: Boolean(cvId) && canView,
  });
  const usages = useQuery({
    queryKey: candidateAffiliateCvKeys.usages(cvId, page),
    queryFn: () => candidateAffiliateCvApi.usages(cvId, page, pageSize),
    enabled: Boolean(cvId) && canView,
    placeholderData: (previous) => previous,
  });

  const updateReuse = useMutation({
    mutationFn: (allowed: boolean) => {
      if (!detail.data) throw new Error('Chưa tải được dữ liệu CV.');
      return candidateAffiliateCvApi.updateReuse(cvId, allowed, detail.data.reuseConcurrencyToken);
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(candidateAffiliateCvKeys.detail(cvId), (current: typeof detail.data) =>
        current
          ? {
              ...current,
              affiliateReuseStatus: result.data.affiliateReuseStatus,
              reuseConcurrencyToken: result.data.reuseConcurrencyToken,
              reuseChangedAt: result.data.reuseChangedAt,
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: candidateAffiliateCvKeys.all });
      message.success(result.message);
    },
    onError: async (error) => {
      const apiError = getApiError(error, 'Chưa cập nhật được quyền dùng lại CV.');
      if (apiError.status === 409) await detail.refetch();
      message.error(apiError.status === 409 ? `${apiError.message} Dữ liệu đã được tải lại.` : apiError.message);
    },
  });

  const adopt = useMutation({
    mutationFn: () => candidateAffiliateCvApi.adopt(cvId, detail.data?.title),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      message.success(result.data.alreadyAdopted ? 'CV này đã có trong kho cá nhân của bạn.' : result.message);
      navigate('/candidate/cvs');
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa thể nhận CV vào kho cá nhân.')),
  });

  if (!canView) return <Alert type="error" showIcon message="Bạn không có quyền xem CV Affiliate đã nộp." />;
  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (detail.isError || !detail.data) {
    return (
      <Surface className="p-6">
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết CV"
          description={getApiErrorMessage(detail.error)}
          action={<Button onClick={() => navigate('/candidate/affiliate-cvs')}>Về danh sách</Button>}
        />
      </Surface>
    );
  }

  const cv = detail.data;
  const reuseAllowed = cv.affiliateReuseStatus === 'ALLOWED';
  return (
    <div className="space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/candidate/affiliate-cvs')}>
        Danh sách CV Affiliate
      </Button>
      <PageHero
        eyebrow="Quyền riêng tư CV"
        title={cv.title || cv.fileName || 'CV Affiliate'}
        description={`Được tải lên bởi ${cv.affiliateDisplayName} · ${dayjs(cv.createdAt).format('DD/MM/YYYY')}`}
        actions={<StatusDot tone={reuseAllowed ? 'success' : 'neutral'}>{reuseAllowed ? 'Cho phép dùng lại' : 'Đã thu hồi dùng lại'}</StatusDot>}
      />

      <Surface className="p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <dl className="grid flex-1 grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Tên tệp', cv.fileName || '—'],
              ['Dung lượng', fileSize(cv.fileSizeBytes) || '—'],
              ['Trạng thái tài liệu', cv.documentStatus],
              ['Tổng lượt nộp', String(cv.submissionCount)],
              ['Đã đồng ý', String(cv.acceptedSubmissionCount)],
              ['Đang chờ xác nhận', String(cv.pendingConsentCount)],
              ['Đã từ chối', String(cv.declinedSubmissionCount)],
              ['Đã hết hạn', String(cv.expiredSubmissionCount)],
              ['Lần nộp gần nhất', cv.lastSubmittedAt ? dayjs(cv.lastSubmittedAt).format('DD/MM/YYYY HH:mm') : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="m-0 mt-1 font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex min-w-56 flex-col gap-2">
            <Button icon={<EyeOutlined />} onClick={() => openSigned(() => candidateAffiliateCvApi.downloadUrl(cvId))}>
              Xem CV
            </Button>
            {canManageReuse && (
              <Popconfirm
                title={reuseAllowed ? 'Thu hồi quyền dùng lại CV?' : 'Cho phép Affiliate dùng lại CV?'}
                description={reuseAllowed ? 'Các hồ sơ đã nộp vẫn được giữ nguyên.' : 'Affiliate nguồn có thể dùng CV cho yêu cầu xác nhận mới.'}
                okText={reuseAllowed ? 'Thu hồi' : 'Cho phép'}
                cancelText="Hủy"
                onConfirm={() => updateReuse.mutate(!reuseAllowed)}
              >
                <Button danger={reuseAllowed} loading={updateReuse.isPending}>
                  {reuseAllowed ? 'Thu hồi quyền dùng lại' : 'Cho phép dùng lại'}
                </Button>
              </Popconfirm>
            )}
            {canAdopt && (
              <Button type="primary" loading={adopt.isPending} onClick={() => adopt.mutate()}>
                Lưu vào kho CV cá nhân
              </Button>
            )}
          </div>
        </div>
        <Alert
          className="mt-5"
          type="info"
          showIcon
          message="Quyền dùng lại chỉ áp dụng cho lần giới thiệu mới"
          description="Thu hồi quyền không xóa Submission, Application, Attribution hoặc kết quả chấm điểm đã phát sinh."
        />
      </Surface>

      <Surface>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="m-0 text-base font-bold text-slate-900">CV này đã được dùng ở đâu</h2>
          <p className="m-0 mt-1 text-sm text-slate-500">Lịch sử Job và tiến độ phát sinh từ CV, mới nhất trước.</p>
        </div>
        {usages.isLoading ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 5 }} /></div>
        ) : usages.isError ? (
          <div className="p-5"><Alert type="error" showIcon message="Không tải được lịch sử sử dụng" description={getApiErrorMessage(usages.error)} /></div>
        ) : usages.data?.items.length ? (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {usages.data.items.map((usage) => {
              const status = submissionStatus(usage.submissionStatus);
              return (
                <li key={usage.submissionId} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{usage.jobTitle}</div>
                      <div className="mt-1 text-sm text-slate-600">{usage.companyName} · {usage.affiliateDisplayName}</div>
                      <div className="mt-1 text-xs text-slate-500">Nộp {dayjs(usage.submittedAt).format('DD/MM/YYYY HH:mm')}</div>
                    </div>
                    <StatusDot tone={status.tone}>{status.label}</StatusDot>
                  </div>
                  {(usage.applicationStatus || usage.aiStatus) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      {usage.applicationStatus && <span className="rounded-full bg-slate-100 px-2.5 py-1">Application: {usage.applicationStatus}</span>}
                      {usage.aiStatus && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">AI: {usage.aiStatus}{usage.aiMatchScore != null ? ` · ${usage.aiMatchScore}` : ''}</span>}
                    </div>
                  )}
                  {usage.applicationId && (
                    <Button type="link" className="mt-2 !h-auto !p-0" onClick={() => navigate(`/candidate/applications/${usage.applicationId}`)}>
                      Xem Application
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">CV này chưa có lịch sử sử dụng.</div>
        )}
        {(usages.data?.totalPages ?? 0) > 1 && (
          <div className="flex justify-center border-t border-slate-100 p-4">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={usages.data?.total ?? 0}
              showSizeChanger={false}
              onChange={(nextPage) => setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })}
            />
          </div>
        )}
      </Surface>
    </div>
  );
};
