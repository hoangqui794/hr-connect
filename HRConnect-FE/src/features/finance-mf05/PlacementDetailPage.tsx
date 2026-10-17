/**
 * @file PlacementDetailPage.tsx
 * @description Dedicated standalone page for Placement Detail (/placements/:placementId).
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, Button } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, SafetyCertificateOutlined, AuditOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { PlacementDetailView } from './PlacementDetailView';

export const PlacementDetailPage: React.FC = () => {
  const { placementId } = useParams<{ placementId: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  const mode: 'client' | 'hr' | 'affiliate' =
    role === 'CLIENT' ? 'client' : role === 'AFFILIATE' ? 'affiliate' : 'hr';

  const handleBack = () => {
    if (mode === 'client') {
      navigate('/client/warranty');
    } else if (mode === 'hr') {
      navigate('/hr/warranty-tracking');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="placement-detail-page max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={() => navigate('/dashboard')}
                >
                  <HomeOutlined /> Bàn làm việc
                </span>
              ),
            },
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-blue-600"
                  onClick={handleBack}
                >
                  <SafetyCertificateOutlined /> Theo dõi bảo hành
                </span>
              ),
            },
            {
              title: (
                <span className="flex items-center gap-1 text-slate-800 font-semibold">
                  <AuditOutlined className="text-blue-600" /> Chi tiết tiếp nhận việc
                </span>
              ),
            },
          ]}
        />

        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} className="text-slate-600">
          Quay lại danh sách
        </Button>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <PlacementDetailView
          placementId={placementId || ''}
          mode={mode}
          onBack={handleBack}
          showBackAction={true}
        />
      </div>
    </div>
  );
};

export default PlacementDetailPage;
