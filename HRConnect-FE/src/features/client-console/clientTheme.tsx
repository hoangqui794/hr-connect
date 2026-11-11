/**
 * @file clientTheme.tsx
 * @description Client Company workspace theme — "Electric Azure & Royal Sapphire"
 * Cohesive luxury SaaS palette: primary #0284C7 (Electric Azure), hover #0369A1 (Deep Sapphire),
 * active #075985, soft canvas #F8FAFC, and modern gradient accents.
 * Complies with Anthropic Frontend Design & Vercel Web Interface Guidelines.
 */
import React from 'react';
import { ConfigProvider } from 'antd';

export const clientTokens = {
  primary: '#0284C7',
  primaryHover: '#0369A1',
  primaryActive: '#075985',
  primaryBg: '#F0F9FF',
  canvas: '#F8FAFC',
  cta: '#0284C7',
  ctaHover: '#0369A1',
  font: "'Plus Jakarta Sans', 'Be Vietnam Pro', system-ui, sans-serif",
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#059669',
} as const;

/** Applies the refined Client palette to every antd component rendered inside. */
export const ClientScope: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: clientTokens.primary,
        colorPrimaryHover: clientTokens.primaryHover,
        colorPrimaryActive: clientTokens.primaryActive,
        colorPrimaryBg: clientTokens.primaryBg,
        colorLink: clientTokens.primary,
        colorLinkHover: clientTokens.primaryHover,
        colorError: clientTokens.danger,
        colorErrorBg: '#FEF2F2',
        colorErrorBorder: '#FECACA',
        colorWarning: clientTokens.warning,
        colorWarningBg: '#FFFBEB',
        colorWarningBorder: '#FDE68A',
        colorSuccess: clientTokens.success,
        colorSuccessBg: '#ECFDF5',
        colorSuccessBorder: '#A7F3D0',
        colorInfo: clientTokens.primary,
        colorInfoBg: '#F0F9FF',
        colorInfoBorder: '#BAE6FD',
        colorText: clientTokens.text,
        colorTextSecondary: clientTokens.textMuted,
        colorBorder: clientTokens.border,
        borderRadius: 10,
        fontFamily: clientTokens.font,
      },
      components: {
        Button: { primaryShadow: '0 2px 4px 0 rgba(2, 132, 199, 0.15)', dangerShadow: 'none', defaultShadow: 'none' },
        Tag: {
          defaultBg: '#F1F5F9',
          defaultColor: '#475569',
        },
      },
    }}
  >
    {children}
  </ConfigProvider>
);
