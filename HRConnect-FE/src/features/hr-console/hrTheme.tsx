/**
 * @file hrTheme.tsx
 * @description Internal HR workspace palette (chosen 2026-10-07): light sidebar, sky-700 accent,
 * so platform staff can tell it apart from the navy/emerald Admin console at a glance.
 * Measured contrast: white on #0369A1 = 5.9:1 · #075985 on white = 7.6:1 · #334155 on white = 10.3:1.
 */
import React from 'react';
import { ConfigProvider } from 'antd';

export const hrTokens = {
  primary: '#0369A1',
  primaryHover: '#075985',
  primaryBg: '#F0F9FF',
  canvas: '#F4F7FB',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
} as const;

/** Applies the HR palette to every antd component rendered inside. */
export const HrScope: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: hrTokens.primary,
        colorPrimaryHover: hrTokens.primaryHover,
        colorPrimaryActive: hrTokens.primaryHover,
        colorPrimaryBg: hrTokens.primaryBg,
        colorLink: hrTokens.primary,
        colorLinkHover: hrTokens.primaryHover,
        colorError: hrTokens.danger,
        colorWarning: hrTokens.warning,
        colorSuccess: hrTokens.success,
        colorInfo: hrTokens.primary,
        colorText: hrTokens.text,
        colorTextSecondary: hrTokens.textMuted,
        colorBorder: hrTokens.border,
        borderRadius: 8,
      },
      components: {
        Button: { primaryShadow: 'none', dangerShadow: 'none', defaultShadow: 'none' },
      },
    }}
  >
    {children}
  </ConfigProvider>
);
