/**
 * @file portalTheme.tsx
 * @description Candidate and Affiliate workspace palettes (ui-ux-pro-max, chosen 2026-10-08).
 * Candidate: Flat/Swiss, teal #0F766E (white 5.5:1), top navigation like a job site.
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
            colorSuccess: '#047857',
            colorWarning: '#B45309',
            colorError: '#B91C1C',
            colorText: '#0F172A',
            colorTextSecondary: '#475569',
            colorBorder: '#E2E8F0',
            borderRadius: 10,
          },
          components: { Button: { primaryShadow: 'none', dangerShadow: 'none', defaultShadow: 'none' } },
        }}
      >
        {children}
      </ConfigProvider>
    );
  };

export const CandidateScope = scope('#0F766E', '#115E59', '#F0FDFA');
export const AffiliateScope = scope('#6D28D9', '#5B21B6', '#F5F3FF');
