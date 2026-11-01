import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App as AntApp, Button, Descriptions, Form, Input, Modal, Skeleton, Statistic, Tag } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, MergeCellsOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { getApiError, getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { AdminIdentityClaimCandidateDetail } from '@/types/api/mf02';
import { formatDateTime } from './adminTheme';
import { PageHero, StatusDot, Surface, type Tone } from './ui';

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PENDING_ADMIN_REVIEW: { label: 'Chờ đối chiếu', tone: 'warning' },
  COMPLETED: { label: 'Đã liên kết', tone: 'success' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
  EXPIRED: { label: 'Đã hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  MERGED: 'Đã hợp nhất',
  INACTIVE: 'Ngừng hoạt động',
  SUSPENDED: 'Tạm khóa',
  PENDING: 'Chờ kích hoạt',
  VERIFIED: 'Đã xác minh',
};

const EMAIL_KIND_LABEL: Record<string, string> = {
  PRIMARY: 'Email chính',
  SECONDARY: 'Email phụ',
  ALIAS: 'Email phụ (liên kết)',
  LINKED: 'Email đã liên kết',
};

const CandidateEvidence: React.FC<{ title: string; candidate: AdminIdentityClaimCandidateDetail | null; recommended?: boolean }> = ({ title, candidate, recommended }) => (
  <Surface padded className="h-full">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="m-0 text-base font-bold text-slate-900">{title}</h2>
      {recommended && <Tag color="green" icon={<SafetyCertificateOutlined />}>Hồ sơ chính được đề xuất</Tag>}
    </div>
    {!candidate ? (
      <Alert type="info" showIcon message="Không tìm thấy hồ sơ Candidate cũ theo email này." />
    ) : (
      <div className="space-y-4">
        <Descriptions size="small" column={1} styles={{ label: { width: 125 } }}>
          <Descriptions.Item label="Họ tên">{candidate.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Điện thoại">{candidate.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Tài khoản">{candidate.userId ? 'Đã có tài khoản' : 'Chưa có tài khoản'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">{CANDIDATE_STATUS_LABEL[candidate.status] ?? candidate.status}</Descriptions.Item>
          <Descriptions.Item label="Chức danh">{candidate.currentJobTitle ?? 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Kinh nghiệm">{candidate.yearsOfExperience == null ? 'Chưa cập nhật' : `${candidate.yearsOfExperience} năm`}</Descriptions.Item>
          <Descriptions.Item label="Học vấn">{candidate.highestEducation ?? 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Ngày sinh">{candidate.dateOfBirth ?? 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="CV chính">{candidate.primaryCvTitle ?? candidate.primaryCvFileName ?? 'Chưa có'}</Descriptions.Item>
          <Descriptions.Item label="Tạo hồ sơ">{formatDateTime(candidate.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Đã hợp nhất vào">{candidate.mergedIntoCandidateId ?? 'Chưa'}</Descriptions.Item>
        </Descriptions>
        {candidate.summary && <p className="m-0 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{candidate.summary}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Statistic title="CV" value={candidate.cvCount} />
          <Statistic title="Lượt giới thiệu" value={candidate.submissionCount} />
          <Statistic title="Đơn ứng tuyển" value={candidate.applicationCount} />
          <Statistic title="Kỹ năng" value={candidate.skillCount} />
          <Statistic title="Lượt chấm AI" value={candidate.matchCount} />
        </div>
      </div>
    )}
  </Surface>
);

export const AdminIdentityClaimDetailPage: React.FC = () => {
  const { claimId = '' } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();
  const canReview = useAuthStore((state) => state.hasPermission('candidate.identity.review'));
  const canMerge = useAuthStore((state) => state.hasPermission('candidate_duplicate.resolve'));
  const [decision, setDecision] = useState<'approve' | 'reject' | 'merge' | null>(null);
  const [form] = Form.useForm<{ text?: string }>();

  const detail = useQuery({
    queryKey: ['admin-candidate-identity-claim', claimId],
    queryFn: () => adminIdentityClaimApi.get(claimId),
    enabled: canReview && Boolean(claimId),
  });

  const manualMergeRequired = Boolean(
    detail.data?.targetCandidate &&
    !detail.data.targetCandidate.mergedIntoCandidateId &&
    detail.data.requesterCandidate.hasBusinessData &&
    detail.data.targetCandidate.hasBusinessData
  );
  const mergePreview = useQuery({
    queryKey: ['admin-candidate-identity-merge-preview', detail.data?.duplicateCaseId],
    queryFn: () => adminIdentityClaimApi.previewMerge(detail.data!.duplicateCaseId!),
    enabled: Boolean(manualMergeRequired && canMerge && detail.data?.duplicateCaseId),
    retry: false,
  });

  useEffect(() => {
    if (detail.isError && getApiError(detail.error).status === 404) {
      message.warning('Yêu cầu không còn tồn tại.');
      navigate('/admin/candidate-identity-claims', { replace: true });
    }
  }, [detail.error, detail.isError, message, navigate]);

  const decide = useMutation({
    mutationFn: async ({ kind, text }: { kind: 'approve' | 'reject' | 'merge'; text?: string }) => {
      const current = detail.data;
      if (!current) throw new Error('Chưa tải được dữ liệu yêu cầu.');
      if (kind === 'merge') {
        if (!current.duplicateCaseId || !mergePreview.data) {
          throw new Error('Chưa tải được bản xem trước hợp nhất an toàn.');
        }
        const reason = text?.trim() || 'Đã đối chiếu bằng chứng và xác nhận hai hồ sơ thuộc cùng một Candidate.';
        await adminIdentityClaimApi.mergeDuplicateCase(current.duplicateCaseId, mergePreview.data, reason);
        return adminIdentityClaimApi.approve(claimId, current.concurrencyToken, reason);
      }
      return kind === 'approve'
        ? adminIdentityClaimApi.approve(claimId, current.concurrencyToken, text?.trim())
        : adminIdentityClaimApi.reject(claimId, current.concurrencyToken, text?.trim() ?? '');
    },
    onSuccess: async (result) => {
      message.success(result.message);
      setDecision(null);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-candidate-identity-claims'] }),
        detail.refetch(),
      ]);
    },
    onError: async (error) => {
      const normalized = getApiError(error);
      if (normalized.status === 409) {
        await detail.refetch();
        if (normalized.code === 'IDENTITY_CLAIM_MANUAL_MERGE_REQUIRED') {
          message.warning('Hai hồ sơ đều có dữ liệu nghiệp vụ. Hệ thống không tự động hợp nhất; cần xử lý thủ công trước.');
          return;
        }
        message.warning(`${normalized.message} Dữ liệu mới nhất đã được tải lại.`);
        return;
      }
      message.error(normalized.message);
    },
  });

  if (!canReview) {
    return <Alert type="error" showIcon message="Bạn không có quyền xử lý yêu cầu khôi phục danh tính Candidate." />;
  }
  if (detail.isLoading) return <Skeleton active paragraph={{ rows: 14 }} />;
  if (detail.isError || !detail.data) {
    return <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được chi tiết yêu cầu.')} />;
  }

  const claim = detail.data;
  const status = STATUS_META[claim.status] ?? { label: claim.status, tone: 'neutral' as Tone };
  const isPending = claim.status === 'PENDING_ADMIN_REVIEW';
  const recommendedId = mergePreview.data?.recommendedCanonicalCandidateId;

  return (
    <div>
      <PageHero
        eyebrow="Đối chiếu danh tính"
        title={claim.requesterCandidate.fullName}
        description={`Yêu cầu chứng minh quyền sở hữu email ${claim.assertedEmail}.`}
        actions={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/candidate-identity-claims')}>Danh sách</Button>
            <Button icon={<ReloadOutlined />} loading={detail.isFetching} onClick={() => detail.refetch()}>Tải lại</Button>
            {isPending && (
              <>
                <Button danger icon={<CloseOutlined />} disabled={decide.isPending} onClick={() => setDecision('reject')}>Từ chối</Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={manualMergeRequired || decide.isPending}
                  onClick={() => setDecision('approve')}
                >
                  Phê duyệt
                </Button>
                {manualMergeRequired && (
                  <Button
                    type="primary"
                    icon={<MergeCellsOutlined />}
                    disabled={!canMerge || !claim.duplicateCaseId || !mergePreview.data?.canMerge || decide.isPending}
                    loading={mergePreview.isFetching}
                    onClick={() => setDecision('merge')}
                  >
                    Hợp nhất an toàn
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="mb-5">
        {manualMergeRequired && (
          <Alert
            type="warning"
            showIcon
            message="Không thể tự động hợp nhất hai hồ sơ đã có dữ liệu nghiệp vụ"
            description={canMerge
              ? 'Hãy kiểm tra các bằng chứng bên dưới. Hệ thống sẽ xem trước xung đột, giữ hồ sơ có tài khoản làm hồ sơ chính và chỉ cho hợp nhất khi không có khoản chi trả đã hoàn tất.'
              : 'Bạn có quyền đối chiếu nhưng chưa có quyền hợp nhất hồ sơ. Cần người có quyền xử lý hồ sơ trùng thực hiện bước này.'}
          />
        )}
        {manualMergeRequired && !claim.duplicateCaseId && (
          <Alert
            className="mt-3"
            type="error"
            showIcon
            message="Thiếu hồ sơ đối chiếu an toàn"
            description="Không tìm thấy hồ sơ nghi trùng được tạo khi xác minh email. Hãy tải lại; nếu vẫn còn lỗi, không hợp nhất thủ công trong cơ sở dữ liệu."
          />
        )}
      </div>

      {claim.targetCandidate && (
        <Surface padded className="mb-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-bold text-slate-900">Bằng chứng xác định cùng một người</h2>
              <p className="mb-0 mt-1 text-sm text-slate-500">Email đã xác minh là bằng chứng chính; điện thoại, ngày sinh và dấu vân tay CV chỉ là tín hiệu hỗ trợ.</p>
            </div>
            <Tag color={claim.evidence.conflictingSignalCount > 0 ? 'red' : 'green'}>
              {claim.evidence.supportingSignalCount} tín hiệu phù hợp · {claim.evidence.conflictingSignalCount} xung đột
            </Tag>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[
              ['Quyền sở hữu email', claim.evidence.emailOwnershipVerified],
              ['Họ và tên', claim.evidence.sameFullName],
              ['Số điện thoại', claim.evidence.samePhone],
              ['Ngày sinh', claim.evidence.sameDateOfBirth],
              ['Tệp CV giống hệt', claim.evidence.exactCvMatch],
              ['Nội dung CV tương đồng', claim.evidence.similarCvText],
            ].map(([label, matched]) => (
              <div key={String(label)} className={`rounded-xl border p-3 ${matched ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                <div className={`mt-1 font-bold ${matched ? 'text-emerald-700' : 'text-slate-500'}`}>{matched ? 'Trùng khớp' : 'Cần đối chiếu'}</div>
              </div>
            ))}
          </div>
          {mergePreview.data && (
            <Alert
              className="mt-4"
              type={mergePreview.data.canMerge ? 'success' : 'error'}
              showIcon
              message={mergePreview.data.canMerge ? 'Có thể hợp nhất an toàn' : 'Chưa thể hợp nhất'}
              description={mergePreview.data.canMerge
                ? `${mergePreview.data.collisions.length} công việc có dữ liệu chồng lặp sẽ được xử lý theo lượt Candidate xác nhận hợp lệ sớm nhất.`
                : `Có ${mergePreview.data.financeBlockers.length} khoản chi trả đã hoàn tất. Cần xử lý tài chính trước.`}
            />
          )}
        </Surface>
      )}

      <Surface padded className="mb-5">
        <Descriptions size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Trạng thái"><StatusDot tone={status.tone}>{status.label}</StatusDot></Descriptions.Item>
          <Descriptions.Item label="Email đang dùng">{claim.requesterPrimaryEmail}</Descriptions.Item>
          <Descriptions.Item label="Email cần khôi phục">{claim.assertedEmail}</Descriptions.Item>
          <Descriptions.Item label="Tài khoản yêu cầu">{CANDIDATE_STATUS_LABEL[claim.requesterUserStatus] ?? claim.requesterUserStatus}</Descriptions.Item>
          <Descriptions.Item label="Tạo lúc">{formatDateTime(claim.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Xác minh lúc">{formatDateTime(claim.verifiedAt)}</Descriptions.Item>
          <Descriptions.Item label="Hết hạn">{formatDateTime(claim.expiresAt)}</Descriptions.Item>
          <Descriptions.Item label="Số lần gửi / nhập OTP">{claim.resendCount} / {claim.attemptCount}</Descriptions.Item>
          {claim.reviewedAt && <Descriptions.Item label="Xử lý lúc">{formatDateTime(claim.reviewedAt)}</Descriptions.Item>}
          {claim.reviewReason && <Descriptions.Item label="Ghi chú xử lý" span={2}>{claim.reviewReason}</Descriptions.Item>}
        </Descriptions>
      </Surface>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <CandidateEvidence title="Hồ sơ Candidate hiện tại" candidate={claim.requesterCandidate} recommended={recommendedId === claim.requesterCandidate.candidateId} />
        <CandidateEvidence title="Hồ sơ Candidate cũ theo email" candidate={claim.targetCandidate} recommended={recommendedId === claim.targetCandidate?.candidateId} />
      </div>

      <Surface padded>
        <h2 className="m-0 mb-3 text-base font-bold text-slate-900">Chủ sở hữu email hiện tại</h2>
        {claim.currentEmailOwner ? (
          <Descriptions size="small" column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Tên hiển thị">{claim.currentEmailOwner.displayName}</Descriptions.Item>
            <Descriptions.Item label="Email chính">{claim.currentEmailOwner.primaryEmail}</Descriptions.Item>
            <Descriptions.Item label="Loại email">{EMAIL_KIND_LABEL[claim.currentEmailOwner.kind] ?? claim.currentEmailOwner.kind}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{CANDIDATE_STATUS_LABEL[claim.currentEmailOwner.status] ?? claim.currentEmailOwner.status}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Alert type="warning" showIcon message="Không tìm thấy bản ghi sở hữu email đang hoạt động." />
        )}
      </Surface>

      <Modal
        open={decision !== null}
        title={decision === 'approve' ? 'Phê duyệt liên kết danh tính?' : decision === 'merge' ? 'Xác nhận hợp nhất hai hồ sơ?' : 'Từ chối yêu cầu liên kết?'}
        okText={decision === 'approve' ? 'Phê duyệt' : decision === 'merge' ? 'Hợp nhất an toàn' : 'Từ chối'}
        cancelText="Hủy"
        okButtonProps={{ danger: decision === 'reject', loading: decide.isPending }}
        onCancel={() => { setDecision(null); form.resetFields(); }}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={({ text }) => decision && decide.mutate({ kind: decision, text })}
        >
          <Form.Item
            name="text"
            label={decision === 'approve' ? 'Ghi chú đối chiếu (không bắt buộc)' : decision === 'merge' ? 'Kết luận đối chiếu' : 'Lý do từ chối'}
            rules={decision === 'reject'
              ? [
                  { required: true, whitespace: true, message: 'Nhập lý do từ chối.' },
                  { max: 1000, message: 'Tối đa 1000 ký tự.' },
                ]
              : decision === 'merge'
                ? [
                    { required: true, whitespace: true, message: 'Nhập kết luận đối chiếu trước khi hợp nhất.' },
                    { max: 1000, message: 'Tối đa 1000 ký tự.' },
                  ]
                : [{ max: 1000, message: 'Tối đa 1000 ký tự.' }]}
          >
            <Input.TextArea rows={5} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminIdentityClaimDetailPage;
