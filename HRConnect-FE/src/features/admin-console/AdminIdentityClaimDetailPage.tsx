import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App as AntApp, Button, Descriptions, Form, Input, Modal, Skeleton, Statistic } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
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

const CandidateEvidence: React.FC<{ title: string; candidate: AdminIdentityClaimCandidateDetail | null }> = ({ title, candidate }) => (
  <Surface padded className="h-full">
    <h2 className="m-0 mb-4 text-base font-bold text-slate-900">{title}</h2>
    {!candidate ? (
      <Alert type="info" showIcon message="Không tìm thấy hồ sơ Candidate cũ theo email này." />
    ) : (
      <div className="space-y-4">
        <Descriptions size="small" column={1} styles={{ label: { width: 125 } }}>
          <Descriptions.Item label="Họ tên">{candidate.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{candidate.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Điện thoại">{candidate.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Tài khoản">{candidate.userId ? 'Đã có tài khoản' : 'Chưa có tài khoản'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">{candidate.status}</Descriptions.Item>
          <Descriptions.Item label="Đã hợp nhất vào">{candidate.mergedIntoCandidateId ?? 'Chưa'}</Descriptions.Item>
        </Descriptions>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Statistic title="CV" value={candidate.cvCount} />
          <Statistic title="Submission" value={candidate.submissionCount} />
          <Statistic title="Application" value={candidate.applicationCount} />
          <Statistic title="AI Match" value={candidate.matchCount} />
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
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [form] = Form.useForm<{ text?: string }>();

  const detail = useQuery({
    queryKey: ['admin-candidate-identity-claim', claimId],
    queryFn: () => adminIdentityClaimApi.get(claimId),
    enabled: canReview && Boolean(claimId),
  });

  useEffect(() => {
    if (detail.isError && getApiError(detail.error).status === 404) {
      message.warning('Yêu cầu không còn tồn tại.');
      navigate('/admin/candidate-identity-claims', { replace: true });
    }
  }, [detail.error, detail.isError, message, navigate]);

  const decide = useMutation({
    mutationFn: ({ kind, text }: { kind: 'approve' | 'reject'; text?: string }) => {
      const current = detail.data;
      if (!current) throw new Error('Chưa tải được dữ liệu yêu cầu.');
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
  const manualMergeRequired = Boolean(
    claim.targetCandidate && claim.requesterCandidate.hasBusinessData && claim.targetCandidate.hasBusinessData
  );

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
            description="Cả hồ sơ hiện tại và hồ sơ cũ đều đã có CV, Submission, Application hoặc kết quả AI. Hãy đối chiếu và xử lý hợp nhất thủ công trước; nút phê duyệt tự động đã được khóa để tránh mất hoặc gán sai lịch sử."
          />
        )}
      </div>

      <Surface padded className="mb-5">
        <Descriptions size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Trạng thái"><StatusDot tone={status.tone}>{status.label}</StatusDot></Descriptions.Item>
          <Descriptions.Item label="Email đang dùng">{claim.requesterPrimaryEmail}</Descriptions.Item>
          <Descriptions.Item label="Email cần khôi phục">{claim.assertedEmail}</Descriptions.Item>
          <Descriptions.Item label="Tài khoản yêu cầu">{claim.requesterUserStatus}</Descriptions.Item>
          <Descriptions.Item label="Tạo lúc">{formatDateTime(claim.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Xác minh lúc">{formatDateTime(claim.verifiedAt)}</Descriptions.Item>
          <Descriptions.Item label="Hết hạn">{formatDateTime(claim.expiresAt)}</Descriptions.Item>
          <Descriptions.Item label="Số lần gửi / nhập OTP">{claim.resendCount} / {claim.attemptCount}</Descriptions.Item>
          {claim.reviewedAt && <Descriptions.Item label="Xử lý lúc">{formatDateTime(claim.reviewedAt)}</Descriptions.Item>}
          {claim.reviewReason && <Descriptions.Item label="Ghi chú xử lý" span={2}>{claim.reviewReason}</Descriptions.Item>}
        </Descriptions>
      </Surface>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <CandidateEvidence title="Hồ sơ Candidate hiện tại" candidate={claim.requesterCandidate} />
        <CandidateEvidence title="Hồ sơ Candidate cũ theo email" candidate={claim.targetCandidate} />
      </div>

      <Surface padded>
        <h2 className="m-0 mb-3 text-base font-bold text-slate-900">Chủ sở hữu email hiện tại</h2>
        {claim.currentEmailOwner ? (
          <Descriptions size="small" column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Tên hiển thị">{claim.currentEmailOwner.displayName}</Descriptions.Item>
            <Descriptions.Item label="Email chính">{claim.currentEmailOwner.primaryEmail}</Descriptions.Item>
            <Descriptions.Item label="Loại email">{claim.currentEmailOwner.kind}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{claim.currentEmailOwner.status}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Alert type="warning" showIcon message="Không tìm thấy bản ghi sở hữu email đang hoạt động." />
        )}
      </Surface>

      <Modal
        open={decision !== null}
        title={decision === 'approve' ? 'Phê duyệt liên kết danh tính?' : 'Từ chối yêu cầu liên kết?'}
        okText={decision === 'approve' ? 'Phê duyệt' : 'Từ chối'}
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
            label={decision === 'approve' ? 'Ghi chú đối chiếu (không bắt buộc)' : 'Lý do từ chối'}
            rules={decision === 'reject'
              ? [
                  { required: true, whitespace: true, message: 'Nhập lý do từ chối.' },
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
