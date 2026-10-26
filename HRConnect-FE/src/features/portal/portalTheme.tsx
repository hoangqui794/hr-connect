/**
 * @file portalTheme.tsx
 * @description Candidate and Affiliate workspace palettes (ui-ux-pro-max, chosen 2026-10-08).
 * Candidate: Flat/Swiss, royal blue #2563EB with navy text and a light-blue workspace.
 * Affiliate: violet #6D28D9 (white 7.1:1) with a gold accent for money, light sidebar.
 */
import React from 'react';
import { ConfigProvider } from 'antd';

const scope = (primary: string, hover: string, bg: string) =>
  function Scope({ children }: { children: React.ReactNode }) {
    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: primary,
            colorPrimaryHover: hover,
            colorPrimaryActive: hover,
            colorPrimaryBg: bg,
            colorLink: primary,
            colorLinkHover: hover,
            colorInfo: primary,
            colorSuccess: '#16A34A',
            colorWarning: '#B45309',
            colorError: '#E11D48',
            colorText: '#0F172A',
            colorTextSecondary: '#475569',
            colorBorder: '#E2E8F0',
            borderRadius: 8,
          },
          components: { Button: { primaryShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', dangerShadow: 'none', defaultShadow: 'none' } },
        }}
      >
        {children}
      </ConfigProvider>
    );
  };

export const CandidateScope = scope('#2563EB', '#1D4ED8', '#EFF6FF');
export const AffiliateScope = scope('#2563EB', '#1D4ED8', '#EFF6FF');
