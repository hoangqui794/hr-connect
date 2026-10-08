/**
 * @file clientTheme.tsx
 * @description Client Company workspace, "Soft UI" (ui-ux-pro-max, chosen 2026-10-08): trust blue
 * #2563EB, burnt-orange CTA #C2410C, Plus Jakarta Sans (has a Vietnamese subset), soft layered shadows.
 * Distinct from Admin (navy/emerald) and Internal HR (light/sky).
 * Contrast (measured): white on #2563EB = 5.2:1 · white on #C2410C = 5.2:1 · #1D4ED8 on white = 6.7:1.
 */
import React from 'react';
import { ConfigProvider } from 'antd';

export const clientTokens = {
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryBg: '#EFF4FF',
  canvas: '#F4F7FD',
  cta: '#C2410C',
  ctaHover: '#9A3412',
  font: "'Plus Jakarta Sans', 'Be Vietnam Pro', system-ui, sans-serif",
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
} as const;

/** Applies the Client palette to every antd component rendered inside. */
export const ClientScope: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: clientTokens.primary,
        colorPrimaryHover: clientTokens.primaryHover,
        colorPrimaryActive: clientTokens.primaryHover,
        colorPrimaryBg: clientTokens.primaryBg,
        colorLink: clientTokens.primary,
        colorLinkHover: clientTokens.primaryHover,
        colorError: clientTokens.danger,
        colorWarning: clientTokens.warning,
        colorSuccess: clientTokens.success,
        colorInfo: clientTokens.primary,
        colorText: clientTokens.text,
        colorTextSecondary: clientTokens.textMuted,
        colorBorder: clientTokens.border,
        borderRadius: 10,
        fontFamily: clientTokens.font,
      },
      components: {
        Button: { primaryShadow: 'none', dangerShadow: 'none', defaultShadow: 'none' },
      },
    }}
  >
    {children}
  </ConfigProvider>
);
