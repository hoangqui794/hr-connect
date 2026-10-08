/**
 * @file CandidateAffiliateCvsTab.tsx
 * @description Candidate Affiliate CVs management:
 * - Lists CVs submitted by Affiliate partners on behalf of the candidate.
 * - View job usage history via usages modal.
 * - Download/preview CV via pre-signed downloadUrl.
 * - Toggle reuse permission (PATCH /candidates/me/affiliate-cvs/{cvId}/reuse).
 * - Adopt CV into personal vault (POST /candidates/me/affiliate-cvs/{cvId}/adopt).
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Skeleton,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ShareAltOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  candidateAffiliateCvsApi,
  submissionConsentsApi,
  type CandidateAffiliateCvItem,
  type CandidateAffiliateCvUsageItem,
} from '@/services/api/mf02Api';
import { getApiErrorMessage } from '@/services/apiClient';
import { Surface, StatusDot, type Tone } from '@/features/admin-console/ui';
import { fileSize } from './mf02Labels';
import { candidateKeys, useOpenSignedUrl } from './CandidatePages';

interface Props {
  onOpenConsentModal?: (submissionId: string) => void;
}

export const CandidateAffiliateCvsTab: React.FC<Props> = ({ onOpenConsentModal }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const openSigned = useOpenSignedUrl();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [usagesCv, setUsagesCv] = useState<CandidateAffiliateCvItem | null>(null);
  const [adoptCv, setAdoptCv] = useState<CandidateAffiliateCvItem | null>(null);
  const [adoptForm] = Form.useForm<{ title: string }>();

  // In-flight IDs for switch toggle
  const [togglingReuseId, setTogglingReuseId] = useState<string | null>(null);

  // List affiliate CVs query
  const cvsQuery = useQuery({
    queryKey: ['candidate-affiliate-cvs', page, pageSize],
    queryFn: () => candidateAffiliateCvsApi.list({ page, pageSize }),
  });

  // Usages query when a CV is selected
  const usagesQuery = useQuery({
    queryKey: ['candidate-affiliate-cv-usages', usagesCv?.cvId],
    queryFn: () => (usagesCv ? candidateAffiliateCvsApi.usages(usagesCv.cvId, { page: 1, pageSize: 50 }) : null),
    enabled: Boolean(usagesCv?.cvId),
  });

  // Adopt mutation
  const adoptMutation = useMutation({
    mutationFn: ({ cvId, title }: { cvId: string; title?: string }) =>
      candidateAffiliateCvsApi.adopt(cvId, title),
    onSuccess: (res) => {
      message.success(res.message || 'Đã thêm CV này vào kho CV cá nhân của bạn!');
      setAdoptCv(null);
      adoptForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['candidate-affiliate-cvs'] });
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể nhận CV vào kho cá nhân.')),
  });

  // Toggle reuse mutation
  const handleToggleReuse = async (cv: CandidateAffiliateCvItem, nextAllowed: boolean) => {
    setTogglingReuseId(cv.cvId);
    try {
      const res = await candidateAffiliateCvsApi.updateReuse(
        cv.cvId,
        nextAllowed,
        cv.reuseConcurrencyToken
      );
      message.success(
        res.message ||
          (nextAllowed
            ? 'Đã bật quyền cho phép Affiliate tái sử dụng CV này.'
            : 'Đã thu hồi quyền tái sử dụng CV từ Affiliate.')
      );
      await queryClient.invalidateQueries({ queryKey: ['candidate-affiliate-cvs'] });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể cập nhật quyền tái sử dụng.'));
    } finally {
      setTogglingReuseId(null);
    }
  };

  const cvList = cvsQuery.data?.data?.items ?? [];
  const pagination = cvsQuery.data?.data?.pagination;

  return (
    <div className="space-y-5">
      {/* Informative Header Banner */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="m-0 flex items-center gap-2 text-base font-bold text-slate-900">
              <ShareAltOutlined className="text-teal-600" /> CV do đối tác Affiliate nộp thay
            </h2>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">
              Đây là các bản CV được đối tác Affiliate tải lên khi giới thiệu bạn vào các vị trí tuyển dụng. Bạn có
              toàn quyền kiểm soát quyền tái sử dụng, xem lịch sử công việc đã áp dụng, hoặc nhận bản sao vào kho CV cá
              nhân.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-teal-100 bg-white/80 px-4 py-2 text-center shadow-xs">
              <span className="block text-xs font-medium text-slate-500">Tổng số bản CV</span>
              <span className="text-lg font-bold text-teal-800">{pagination?.totalCount ?? cvList.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main CV List */}
      {cvsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ) : cvsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh sách CV Affiliate"
          description={getApiErrorMessage(cvsQuery.error)}
        />
      ) : cvList.length === 0 ? (
        <Surface className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-600">
            <ShareAltOutlined />
          </div>
          <h3 className="m-0 mt-3 text-base font-semibold text-slate-800">Chưa có CV nào do Affiliate nộp thay</h3>
          <p className="m-0 mt-1 max-w-md text-sm text-slate-500">
            Khi có đối tác giới thiệu bạn vào các công việc trên HR Connect, tài liệu CV do đối tác tải lên sẽ tự động
            xuất hiện tại đây.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {cvList.map((cv) => {
            const isReuseAllowed = cv.affiliateReuseStatus === 'ALLOWED';
            const isToggling = togglingReuseId === cv.cvId;
            const canAdopt = (cv.acceptedSubmissionCount ?? 0) > 0;

            return (
              <article
                key={cv.cvId}
                className="admin-surface transition-shadow hover:shadow-md rounded-2xl border border-slate-200/80 bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: CV Info */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600 shadow-xs"
                      aria-hidden
                    >
                      <FilePdfOutlined />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-slate-900">
                          {cv.title || cv.fileName}
                        </span>
                        {cv.alreadyAdopted ? (
                          <Tag color="cyan" className="!rounded-full !px-2.5">
                            <CheckCircleOutlined /> Đã có trong kho cá nhân
                          </Tag>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{cv.fileName}</span>
                        <span>•</span>
                        <span>{fileSize(cv.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>Nộp lúc {dayjs(cv.createdAt).format('HH:mm DD/MM/YYYY')}</span>
                        {cv.affiliateDisplayName && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <UserOutlined /> Đối tác: {cv.affiliateDisplayName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Stats Pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <HistoryOutlined /> {cv.submissionCount ?? 0} lần sử dụng
                        </span>
                        {cv.pendingConsentCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/60">
                            <ClockCircleOutlined /> {cv.pendingConsentCount} lượt chờ bạn xác nhận
                          </span>
                        )}
                        {cv.acceptedSubmissionCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                            <CheckCircleOutlined /> {cv.acceptedSubmissionCount} lượt đã đồng ý
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:justify-end">
                    {/* Reuse Switch Toggle */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3.5 py-2">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1 justify-end">
                          {isReuseAllowed ? (
                            <UnlockOutlined className="text-teal-600" />
                          ) : (
                            <LockOutlined className="text-slate-400" />
                          )}
                          Tái sử dụng CV
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {isReuseAllowed ? 'Đang cho phép' : 'Đã thu hồi'}
                        </span>
                      </div>
                      <Tooltip
                        title={
                          isReuseAllowed
                            ? 'Bấm để thu hồi quyền: Affiliate sẽ không thể dùng CV này để nộp vào công việc mới.'
                            : 'Bấm để cho phép: Affiliate có thể gửi đề xuất công việc mới bằng CV này.'
                        }
                      >
                        <Switch
                          checked={isReuseAllowed}
                          loading={isToggling}
                          disabled={isToggling}
                          onChange={(checked) => handleToggleReuse(cv, checked)}
                          className={isReuseAllowed ? '!bg-teal-600' : ''}
                        />
                      </Tooltip>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <Tooltip title="Xem nội dung tệp CV">
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => openSigned(() => candidateAffiliateCvsApi.downloadUrl(cv.cvId))}
                        >
                          Xem CV
                        </Button>
                      </Tooltip>

                      <Tooltip title="Xem các vị trí công việc đã dùng CV này">
                        <Button
                          icon={<HistoryOutlined />}
                          onClick={() => setUsagesCv(cv)}
                        >
                          Lịch sử ({cv.submissionCount ?? 0})
                        </Button>
                      </Tooltip>

                      <Tooltip
                        title={
                          canAdopt
                            ? 'Lưu bản sao CV này vào kho CV cá nhân để dùng nộp các việc làm khác'
                            : 'Bạn cần đồng ý ít nhất 1 lượt giới thiệu với CV này trước khi có thể nhận vào kho cá nhân'
                        }
                      >
                        <Button
                          type="primary"
                          ghost
                          icon={<ImportOutlined />}
                          disabled={!canAdopt || cv.alreadyAdopted}
                          onClick={() => {
                            setAdoptCv(cv);
                            adoptForm.setFieldsValue({ title: cv.title || cv.fileName || 'CV nhập từ đối tác' });
                          }}
                        >
                          {cv.alreadyAdopted ? 'Đã nhận' : 'Nhận vào kho CV'}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-end pt-2">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={pagination.totalCount}
                showSizeChanger
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Modal 1: Job Usage History ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <HistoryOutlined className="text-teal-600" />
            Lịch sử công việc của CV: {usagesCv?.title || usagesCv?.fileName}
          </div>
        }
        open={Boolean(usagesCv)}
        onCancel={() => setUsagesCv(null)}
        footer={[
          <Button key="close" onClick={() => setUsagesCv(null)}>
            Đóng
          </Button>,
        ]}
        width={850}
        destroyOnClose
      >
        <div className="py-2">
          {usagesQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : usagesQuery.isError ? (
            <Alert type="error" showIcon message={getApiErrorMessage(usagesQuery.error)} />
          ) : (usagesQuery.data?.data?.items ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có lượt nộp công việc nào sử dụng bản CV này.
            </div>
          ) : (
            <Table<CandidateAffiliateCvUsageItem>
              dataSource={usagesQuery.data?.data?.items ?? []}
              rowKey="submissionId"
              pagination={{ pageSize: 8 }}
              size="middle"
              columns={[
                {
                  title: 'Công việc & Công ty',
                  key: 'job',
                  render: (_, r) => (
                    <div>
                      <div className="font-semibold text-slate-900">{r.jobTitle}</div>
                      <div className="text-xs text-slate-500">{r.companyName}</div>
                    </div>
                  ),
                },
                {
                  title: 'Đối tác',
                  dataIndex: 'affiliateDisplayName',
                  key: 'affiliate',
                  render: (v) => <span className="text-xs font-medium text-slate-700">{v || '—'}</span>,
                },
                {
                  title: 'Ngày nộp',
                  dataIndex: 'submittedAt',
                  key: 'submittedAt',
                  render: (v) => <span className="text-xs text-slate-500">{dayjs(v).format('DD/MM/YYYY')}</span>,
                },
                {
                  title: 'Xác nhận của bạn',
                  key: 'consentStatus',
                  render: (_, r) => {
                    const st = r.consentStatus;
                    if (st === 'PENDING') {
                      return (
                        <div className="space-y-1">
                          <Tag color="orange" className="!rounded-md">
                            <ClockCircleOutlined /> Chờ xác nhận
                          </Tag>
                          {r.consentExpiresAt && (
                            <div className="text-[11px] text-amber-700">
                              Hết hạn: {dayjs(r.consentExpiresAt).format('HH:mm DD/MM')}
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (st === 'CONFIRMED') {
                      return (
                        <Tag color="green" className="!rounded-md">
                          <CheckCircleOutlined /> Đã đồng ý
                        </Tag>
                      );
                    }
                    if (st === 'DECLINED') {
                      return (
                        <Tag color="red" className="!rounded-md">
                          <CloseCircleOutlined /> Đã từ chối
                        </Tag>
                      );
                    }
                    if (st === 'EXPIRED') {
                      return (
                        <Tag color="default" className="!rounded-md">
                          Đã hết hạn
                        </Tag>
                      );
                    }
                    return <Tag>{st}</Tag>;
                  },
                },
                {
                  title: 'Tiến độ tuyển dụng',
                  key: 'appStatus',
                  render: (_, r) => {
                    if (!r.applicationStatus) {
                      return <span className="text-xs text-slate-400">Chưa vào quy trình</span>;
                    }
                    return (
                      <div>
                        <Tag color="blue" className="!rounded-md font-mono text-[11px]">
                          {r.applicationStatus}
                        </Tag>
                        {r.aiMatchScore != null && (
                          <span className="ml-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            AI: {r.aiMatchScore}%
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Thao tác',
                  key: 'action',
                  render: (_, r) => {
                    if (r.consentStatus === 'PENDING') {
                      return (
                        <Button
                          type="primary"
                          size="small"
                          className="!rounded-lg"
                          onClick={() => {
                            setUsagesCv(null);
                            onOpenConsentModal?.(r.submissionId);
                          }}
                        >
                          Xác nhận
                        </Button>
                      );
                    }
                    return <span className="text-xs text-slate-400">—</span>;
                  },
                },
              ]}
            />
          )}
        </div>
      </Modal>

      {/* ── Modal 2: Adopt into Personal Vault ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ImportOutlined className="text-teal-600" />
            Nhận CV vào kho CV cá nhân
          </div>
        }
        open={Boolean(adoptCv)}
        onCancel={() => {
          setAdoptCv(null);
          adoptForm.resetFields();
        }}
        confirmLoading={adoptMutation.isPending}
        onOk={() => {
          adoptForm.validateFields().then((vals) => {
            if (adoptCv) {
              adoptMutation.mutate({ cvId: adoptCv.cvId, title: vals.title.trim() });
            }
          });
        }}
        okText="Nhận vào kho của tôi"
        cancelText="Hủy"
        destroyOnClose
      >
        <div className="py-2 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Hệ thống sẽ tạo một bản sao độc lập của tệp CV này trong kho CV cá nhân của bạn. Bản sao này sẽ hoàn toàn
            thuộc quyền sở hữu của bạn để dùng nộp trực tiếp cho các tin tuyển dụng khác.
          </p>

          <Form form={adoptForm} layout="vertical">
            <Form.Item
              name="title"
              label="Tên gợi nhớ cho CV"
              rules={[{ required: true, message: 'Vui lòng nhập tên gợi nhớ cho CV' }]}
            >
              <Input placeholder="Ví dụ: CV Senior Fullstack - Tiếng Anh" size="large" />
            </Form.Item>
          </Form>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <div>• Tệp gốc: <strong className="text-slate-700">{adoptCv?.fileName}</strong></div>
            <div>• Nguồn giới thiệu: <strong className="text-slate-700">{adoptCv?.affiliateDisplayName || 'Đối tác'}</strong></div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
