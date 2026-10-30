/**
 * @file ClientVnPayReturnPage.tsx
 * @description Where VNPay sends the Client back after paying (/client/billing/vnpay-return?vnp_...). The signed query
 * goes to the backend, which confirms the payment if VNPay's IPN has not already, and the page shows the outcome.
 */
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { money } from '@/features/finance-mf05/financeLabels';

// VNPay response code 24 = the customer cancelled on VNPay.
const CANCELLED = '24';

export const ClientVnPayReturnPage: React.FC = () => {
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ['vnpay-return', search],
    queryFn: () => vnPayApi.confirmReturn(search),
    enabled: search.includes('vnp_'),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      void queryClient.invalidateQueries({ queryKey: ['client-billing'] });
    }
  }, [result.data, queryClient]);

  const back = (
    <Link to="/client/billing">
      <Button type="primary">Về trang Công nợ</Button>
    </Link>
  );

  if (!search.includes('vnp_')) {
    return <Result status="warning" title="Không có kết quả thanh toán" subTitle="Trang này chỉ mở khi VNPay chuyển bạn về." extra={back} />;
  }
  if (result.isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Spin size="large" />
        Đang xác nhận kết quả thanh toán với VNPay…
      </div>
    );
  }
  if (result.isError || !result.data) {
    return <Result status="error" title="Không xác nhận được kết quả" subTitle={getApiErrorMessage(result.error)} extra={back} />;
  }

  const p = result.data;
  const amount = money(p.amount, p.currencyCode);
  if (p.status === 'SUCCEEDED') {
    return (
      <Result
        status="success"
        title="Thanh toán thành công"
        subTitle={`Đã thanh toán ${amount} qua VNPay${p.providerTransactionNo ? ` (mã giao dịch ${p.providerTransactionNo})` : ''}. Khoản phí đã chuyển sang Đã thanh toán.`}
        extra={back}
      />
    );
  }
  if (p.status === 'NEEDS_REVIEW') {
    return (
      <Result
        status="warning"
        title="Đã nhận tiền, đang chờ HR Connect kiểm tra"
        subTitle={`VNPay đã nhận ${amount} nhưng khoản phí chưa tự cập nhật được. HR Connect sẽ kiểm tra và liên hệ bạn.`}
        extra={back}
      />
    );
  }
  if (p.status === 'PENDING' || p.status === 'PROCESSING') {
    return <Result status="info" title="Đang chờ VNPay xác nhận" subTitle="Tải lại trang Công nợ sau ít phút để xem trạng thái mới." extra={back} />;
  }
  return (
    <Result
      status="error"
      title={p.responseCode === CANCELLED ? 'Bạn đã hủy thanh toán' : 'Thanh toán không thành công'}
      subTitle="Khoản phí vẫn ở trạng thái chờ thanh toán. Bạn có thể thanh toán lại từ trang Công nợ."
      extra={back}
    />
  );
};

export default ClientVnPayReturnPage;
