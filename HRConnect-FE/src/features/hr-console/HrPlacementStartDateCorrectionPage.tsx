/**
 * @file HrPlacementStartDateCorrectionPage.tsx
 * @description MF-04 Internal HR screen for correcting an accidentally recorded
 * actual start date. This is intentionally a narrow operational page: it does
 * not review commissions, service fees, warranty cases or payouts (MF-05).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, DatePicker, Drawer, Form, Input, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarOutlined, EditOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getApiErrorMessage } from '@/services/apiClient';
import { placementCorrectionApi } from '@/services/api/hrApi';
import type { PlacementCorrectionDetail, PlacementItem } from '@/types/api/hr';
import { PageHero, PersonCell, StatusDot, Surface } from '@/features/admin-console/ui';
import { matchesSearch } from '@/utils/searchMatch';
import { PLACEMENT_STATUS, pick } from './hrLabels';

const PAGE_SIZE = 10;
const DATE_FORMAT = 'YYYY-MM-DD';
const date = (value?: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

const JobCell: React.FC<{ placement: PlacementItem }> = ({ placement }) => (
  <div className="min-w-0">
    <div className="truncate font-medium text-slate-900">{placement.job.title}</div>
    <div className="truncate text-[12.5px] text-slate-600">{placement.job.companyName}</div>
  </div>
);

const DetailRows: React.FC<{ detail: PlacementCorrectionDetail }> = ({ detail }) => (
  <dl className="m-0 divide-y divide-slate-100 text-sm">
    {[
      ['Ứng viên', detail.candidate.fullName],
      ['Email', detail.candidate.email],
      ['Số điện thoại', detail.candidate.phone ?? '—'],
      ['Công việc', detail.job.title],
      ['Doanh nghiệp', detail.job.companyName],
      ['Vị trí', detail.position ?? '—'],
      ['Phòng ban', detail.department ?? '—'],
      ['Ngày đi làm thực tế', date(detail.actualStartDate)],
      ['Xác nhận lúc', date(detail.confirmedAt)],
      ['Người xác nhận', detail.confirmedByName ?? '—'],
    ].map(([label, value]) => (
      <div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-2.5 first:pt-0">
        <dt className="text-slate-600">{label}</dt>
        <dd className="m-0 break-words text-right font-medium text-slate-900">{value}</dd>
      </div>
    ))}
  </dl>
);

/** Internal HR / Platform Admin only. Backend repeats every permission and correction rule. */
export const HrPlacementStartDateCorrectionPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<{ actualStartDate: Dayjs; reason: string }>();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();

  const highlightParam = searchParams.get('highlight');
  useEffect(() => {
    if (!highlightParam) return;
    setSelectedId(highlightParam);
    const next = new URLSearchParams(searchParams);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  }, [highlightParam, searchParams, setSearchParams]);

  const placements = useQuery({
    queryKey: ['mf04-placement-correction', page],
    queryFn: () => placementCorrectionApi.list({ page, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });
  const detail = useQuery({
    queryKey: ['mf04-placement-correction', selectedId],
    queryFn: () => placementCorrectionApi.get(selectedId!),
    enabled: selectedId !== null,
  });
  const correctionWindowExpired = detail.data?.confirmedAt
    ? dayjs().isAfter(dayjs(detail.data.confirmedAt).add(7, 'day'))
    : false;

  const correction = useMutation({
    mutationFn: ({ placementId, actualStartDate, reason }: { placementId: string; actualStartDate: string; reason: string }) =>
      placementCorrectionApi.correctStartDate(placementId, { actualStartDate, reason }),
    onSuccess: async (response) => {
      message.success(response.message ?? 'Đã cập nhật ngày đi làm thực tế.');
      setCorrectionOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mf04-placement-correction'] }),
        queryClient.invalidateQueries({ queryKey: ['hr-pipeline'] }),
      ]);
    },
  });

  const openCorrection = () => {
    if (!detail.data) return;
    form.setFieldsValue({ actualStartDate: dayjs(detail.data.actualStartDate), reason: '' });
    setCorrectionOpen(true);
  };

  const columns: ColumnsType<PlacementItem> = [
    { title: 'Ứng viên', key: 'candidate', render: (_, row) => <PersonCell name={row.candidate.fullName} secondary={row.candidate.email} /> },
    { title: 'Tin tuyển dụng', key: 'job', render: (_, row) => <JobCell placement={row} /> },
    { title: 'Vị trí', dataIndex: 'position', width: 150, render: (value) => value ?? '—' },
    { title: 'Ngày đi làm', dataIndex: 'actualStartDate', width: 140, render: (value) => <span className="tabular-nums">{date(value)}</span> },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, row) => {
        const status = pick(PLACEMENT_STATUS, row.status);
        return <StatusDot tone={status.tone}>{status.label}</StatusDot>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, row) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedId(row.placementId)}>
          Xem
        </Button>
      ),
    },
  ];

  const submitCorrection = async () => {
    const values = await form.validateFields();
    if (!detail.data) return;
    correction.mutate({
      placementId: detail.data.placementId,
      actualStartDate: values.actualStartDate.format(DATE_FORMAT),
      reason: values.reason.trim(),
    });
  };

  const hasSearch = searchText.trim().length > 0;
  const visiblePlacements = useMemo(() => {
    const rows = placements.data?.items ?? [];
    if (!hasSearch) return rows;
    return rows.filter((row) =>
      matchesSearch(
        searchText,
        row.candidate?.fullName,
        row.candidate?.email,
        row.job?.title,
        row.job?.companyName,
        row.position
      )
    );
  }, [placements.data?.items, hasSearch, searchText]);

  return (
    <div>
      <PageHero
        eyebrow="Internal HR"
        title="Sửa ngày đi làm thực tế"
        description="Dùng khi doanh nghiệp nhập nhầm ngày bắt đầu làm việc. Hệ thống tự kiểm tra thời hạn sửa, ngày hợp lệ và tình trạng thu phí trước khi cập nhật."
      />
      <Alert
        className="mb-5"
        type="info"
        showIcon
        message="Chỉ điều chỉnh ngày đi làm"
        description="Màn hình này không thực hiện đối soát hoa hồng, chi trả, bảo hành hay phí dịch vụ. Hệ thống sẽ không cho phép chỉnh sửa nếu hồ sơ nhận việc đã hoàn tất thu phí."
      />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <Input
          allowClear
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Tìm theo ứng viên, email, tin tuyển dụng, công ty, vị trí..."
          aria-label="Tìm kiếm danh sách nhận việc"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full sm:w-[340px]"
        />
      </div>
      <Surface>
        {placements.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được danh sách nhận việc" description={getApiErrorMessage(placements.error)} />
          </div>
        ) : (
          <Table<PlacementItem>
            className="admin-soft-table"
            rowKey="placementId"
            columns={columns}
            dataSource={visiblePlacements}
            loading={placements.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: hasSearch ? visiblePlacements.length : (placements.data?.total ?? 0),
              showSizeChanger: false,
              onChange: setPage,
            }}
            locale={{
              emptyText: hasSearch ? (
                <div className="py-10 text-slate-600">
                  <div>Không tìm thấy ứng viên phù hợp trên trang này.</div>
                  <Button className="mt-3" onClick={() => setSearchText('')}>Xóa từ khóa tìm kiếm</Button>
                </div>
              ) : (
                <div className="py-10 text-slate-600">Chưa có ứng viên nào đã được xác nhận đi làm.</div>
              ),
            }}
          />
        )}
      </Surface>

      <Drawer
        title="Chi tiết nhận việc"
        width={560}
        open={selectedId !== null}
        onClose={() => {
          setSelectedId(null);
          setCorrectionOpen(false);
        }}
        extra={
          detail.data ? (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={openCorrection}
              disabled={correctionWindowExpired}
              title={correctionWindowExpired ? 'Đã quá 7 ngày kể từ lúc xác nhận đi làm.' : undefined}
            >
              Sửa ngày đi làm
            </Button>
          ) : null
        }
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detail.isError ? (
          <Alert type="error" showIcon message="Không tải được chi tiết nhận việc" description={getApiErrorMessage(detail.error)} />
        ) : detail.data ? (
          <>
            {correctionWindowExpired && (
              <Alert
                className="mb-4"
                type="warning"
                showIcon
                message="Đã hết thời hạn chỉnh sửa"
                description="Ngày đi làm chỉ được sửa trong vòng 7 ngày kể từ lúc doanh nghiệp xác nhận."
              />
            )}
            <div className="mb-5 flex items-center gap-2">
              <StatusDot tone={pick(PLACEMENT_STATUS, detail.data.status).tone}>{pick(PLACEMENT_STATUS, detail.data.status).label}</StatusDot>
              {detail.data.isReplacement && <Tag color="gold">Ứng viên thay thế</Tag>}
            </div>
            <DetailRows detail={detail.data} />
            {detail.data.confirmationNote && (
              <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 font-medium text-slate-900">Ghi chú khi xác nhận</div>
                {detail.data.confirmationNote}
              </div>
            )}
          </>
        ) : null}
      </Drawer>

      <Drawer
        title="Sửa ngày đi làm thực tế"
        width={480}
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        extra={
          <Button type="primary" loading={correction.isPending} icon={<CalendarOutlined />} onClick={submitCorrection}>
            Lưu ngày mới
          </Button>
        }
      >
        <Alert
          className="mb-5"
          type="warning"
          showIcon
          message="Lưu ý khi điều chỉnh ngày đi làm"
          description="Chỉ dùng khi doanh nghiệp nhập nhầm ngày bắt đầu làm việc. Ngày đi làm mới không được ở tương lai, phải sau thời điểm nhận offer, nằm trong giới hạn 7 ngày kể từ khi xác nhận và chỉ sửa được khi hồ sơ chưa chốt thu phí."
        />
        {correction.isError && <Alert className="mb-5" type="error" showIcon message={getApiErrorMessage(correction.error)} />}
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="actualStartDate" label="Ngày đi làm thực tế" rules={[{ required: true, message: 'Chọn ngày đi làm thực tế.' }]}>
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              disabledDate={(current) => current.isAfter(dayjs(), 'day')}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do chỉnh sửa"
            rules={[
              { required: true, whitespace: true, message: 'Nhập lý do chỉnh sửa.' },
              { max: 1000, message: 'Tối đa 1000 ký tự.' },
            ]}
          >
            <Input.TextArea rows={5} maxLength={1000} showCount placeholder="Ví dụ: Doanh nghiệp nhập nhầm ngày ứng viên bắt đầu làm việc." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default HrPlacementStartDateCorrectionPage;
