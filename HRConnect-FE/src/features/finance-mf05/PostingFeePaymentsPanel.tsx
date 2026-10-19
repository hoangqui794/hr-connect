/**
 * Admin › Tài chính › Phí đăng tin (N4, chốt 19/10): only Platform Admin records that a Client paid the
 * CV_APPLICATION posting fee. Recording it opens the job. Internal HR no longer records payments.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Form, Input, Modal, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Job } from '@/types/api/jobs';
import { date, money } from './financeLabels';

export const POSTING_FEE_QUERY_KEY = 'mf05-posting-fees';

export const PostingFeePaymentsPanel: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Job | null>(null);
  const [form] = Form.useForm<{ paymentReference: string }>();

  const jobs = useQuery({
    queryKey: [POSTING_FEE_QUERY_KEY],
    queryFn: async () =>
      (await jobsApi.getReviewQueue('PENDING_PAYMENT')).filter((job) => job.serviceTypeCode !== 'CV_SOURCING'),
    enabled,
  });
  const fee = useQuery({
    queryKey: [POSTING_FEE_QUERY_KEY, 'fee', selected?.jobId],
    queryFn: () => jobsApi.getPostingFee(selected!.jobId),
    enabled: Boolean(selected),
  });

  const record = useMutation({
    mutationFn: (paymentReference: string) => jobsApi.payPostingFee(selected!.jobId, paymentReference),
    onSuccess: () => {
      message.success('Đã ghi nhận thanh toán. Tin tuyển dụng đã được công bố.');
      setSelected(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: [POSTING_FEE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const columns: ColumnsType<Job> = [
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      render: (_, job) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{job.title}</div>
          <div className="text-xs text-slate-500">{job.companyName ?? '—'}</div>
        </div>
      ),
    },
    { title: 'Gói', key: 'package', render: (_, job) => job.postingPackageName ?? 'Tiêu chuẩn' },
    { title: 'Cập nhật', key: 'updated', render: (_, job) => date(job.updatedAt) },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, job) => (
        <Button type="primary" size="small" onClick={() => setSelected(job)}>
          Ghi nhận đã thu
        </Button>
      ),
    },
  ];

  return (
    <>
      {jobs.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(jobs.error)} />}
      <Table
        rowKey="jobId"
        columns={columns}
        dataSource={jobs.data}
        loading={jobs.isFetching}
        pagination={false}
        scroll={{ x: 640 }}
        locale={{ emptyText: 'Không có tin nào chờ thu phí đăng tin.' }}
      />
      <Modal
        open={Boolean(selected)}
        title="Ghi nhận Client đã thanh toán phí đăng tin"
        okText="Xác nhận"
        cancelText="Đóng"
        confirmLoading={record.isPending}
        onOk={async () => record.mutate((await form.validateFields()).paymentReference.trim())}
        onCancel={() => { setSelected(null); form.resetFields(); }}
        destroyOnClose
      >
        {fee.isLoading ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : (
          <Alert
            className="mb-4"
            type="info"
            showIcon
            message={`${selected?.companyName ?? 'Client'} — ${fee.data ? money(fee.data.amount, fee.data.currencyCode) : 'số tiền theo gói đăng tin'}. Đối chiếu sao kê trước khi ghi nhận; tin sẽ được công bố ngay.`}
          />
        )}
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="paymentReference"
            label="Mã tham chiếu / số biên lai"
            rules={[{ required: true, whitespace: true, message: 'Nhập mã tham chiếu chuyển khoản.' }, { max: 200 }]}
          >
            <Input placeholder="VD: VCB-20261019-001" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
