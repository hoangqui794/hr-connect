/**
 * @file PlacementDetailDrawer.tsx
 * @description Drawer wrapper for PlacementDetailView.
 */

import React from 'react';
import { Drawer } from 'antd';
import { PlacementDetailView } from './PlacementDetailView';
import type { PlacementDetailDto } from '@/types/api/placement';

export interface PlacementDetailDrawerProps {
  open: boolean;
  placementId?: string;
  initialData?: PlacementDetailDto;
  mode?: 'client' | 'hr' | 'affiliate';
  onClose: () => void;
}

export const PlacementDetailDrawer: React.FC<PlacementDetailDrawerProps> = ({
  open,
  placementId,
  initialData,
  mode = 'client',
  onClose,
}) => {
  if (!placementId && !initialData) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={780}
      destroyOnClose
      title="Chi tiết tiếp nhận việc (Placement Detail)"
      className="placement-detail-drawer"
    >
      <div className="py-2">
        <PlacementDetailView
          placementId={placementId || initialData?.placementId || ''}
          initialData={initialData}
          mode={mode}
          onBack={onClose}
          showBackAction={false}
        />
      </div>
    </Drawer>
  );
};

export default PlacementDetailDrawer;
