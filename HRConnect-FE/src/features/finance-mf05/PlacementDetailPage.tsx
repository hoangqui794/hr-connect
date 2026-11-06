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

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

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
    <div className={`placement-detail-page max-w-5xl mx-auto px-4 py-6 space-y-5 ${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-[#0C4A6E]"
                  onClick={() => navigate('/dashboard')}
                >
                  <HomeOutlined /> Bàn làm việc
                </span>
              ),
            },
            {
              title: (
                <span
                  className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-[#0C4A6E]"
                  onClick={handleBack}
                >
                  <SafetyCertificateOutlined /> Theo dõi bảo hành
                </span>
              ),
            },
            {
              title: (
                <span className="flex items-center gap-1 text-slate-800 font-semibold">
                  <AuditOutlined className="text-[#0C4A6E]" /> Chi tiết tiếp nhận việc
                </span>
              ),
            },
          ]}
        />

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          className="!h-9 rounded-xl border-slate-200 text-slate-700 hover:border-slate-300 font-medium"
        >
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
