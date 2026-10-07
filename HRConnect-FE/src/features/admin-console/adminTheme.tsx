/**
 * @file adminTheme.tsx
 * @description "Slate Command" design tokens for the Admin console (chosen 2026-10-07).
 * Scoped to Admin pages only via <AdminScope>; the rest of the app keeps its theme.
 * Every text/background pair below meets WCAG AA 4.5:1 (measured):
 *   white on primary #047857 = 5.5:1 · white on navy #0F172A = 17.9:1
 *   #475569 on white = 7.6:1 · white on danger #B91C1C = 6.5:1 · #B45309 on white = 5.0:1
 */
import React from 'react';
import { ConfigProvider, Empty, Tag, Typography } from 'antd';

export const adminTokens = {
  navy: '#0F172A',
  navyMuted: '#94A3B8',
  canvas: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#475569',
  primary: '#047857',
  primaryHover: '#065F46',
  primaryBg: '#ECFDF5',
  danger: '#B91C1C',
  warning: '#B45309',
  info: '#1D4ED8',
  mono: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
} as const;

/** Applies the Admin palette to every antd component rendered inside. */
export const AdminScope: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: adminTokens.primary,
        colorPrimaryHover: adminTokens.primaryHover,
        colorPrimaryActive: adminTokens.primaryHover,
        colorPrimaryBg: adminTokens.primaryBg,
        colorLink: adminTokens.primary,
        colorLinkHover: adminTokens.primaryHover,
        colorError: adminTokens.danger,
        colorWarning: adminTokens.warning,
        colorInfo: adminTokens.info,
        colorSuccess: adminTokens.primary,
        colorText: adminTokens.text,
        colorTextSecondary: adminTokens.textMuted,
        colorBorder: adminTokens.border,
        borderRadius: 8,
      },
      components: {
        Table: { headerBg: '#F1F5F9', headerColor: adminTokens.textMuted, cellPaddingBlock: 10, rowHoverBg: '#F8FAFC' },
        Button: { primaryShadow: 'none', dangerShadow: 'none', defaultShadow: 'none' },
      },
    }}
  >
    {children}
  </ConfigProvider>
);

/** Page title + one-line purpose + actions, the same on every Admin page. */
export const AdminPageHeader: React.FC<{
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <Typography.Title level={3} className="!mb-1 !text-[22px]">
        {title}
      </Typography.Title>
      <Typography.Text style={{ color: adminTokens.textMuted }}>{description}</Typography.Text>
    </div>
    {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
  </header>
);

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  success: { color: '#065F46', background: '#ECFDF5', borderColor: '#A7F3D0' },
  warning: { color: '#92400E', background: '#FFFBEB', borderColor: '#FDE68A' },
  danger: { color: '#991B1B', background: '#FEF2F2', borderColor: '#FECACA' },
  info: { color: '#1E40AF', background: '#EFF6FF', borderColor: '#BFDBFE' },
  neutral: { color: '#334155', background: '#F1F5F9', borderColor: '#E2E8F0' },
};

/** Status chip: always text + color, never color alone. */
export const StatusBadge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <Tag className="m-0 whitespace-nowrap font-medium" style={TONE_STYLE[tone]}>
    {children}
  </Tag>
);

/** Shown on Admin pages whose backend API does not exist yet. Never shows mock numbers. */
export const NoApiYet: React.FC<{ feature: string; detail?: string }> = ({ feature, detail }) => (
  <div className="admin-surface py-16">
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div className="space-y-1">
          <div className="font-semibold text-slate-900">Chưa có dữ liệu</div>
          <div className="text-slate-600">
            {feature} chưa có API ở backend, nên trang này chưa hiển thị số liệu.
          </div>
          {detail && <div className="text-sm text-slate-500">{detail}</div>}
        </div>
      }
    />
  </div>
);

export const formatDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
