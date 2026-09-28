import { theme, type ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Brand Colors - High-End Royal Blue & Accents
    colorPrimary: '#2563eb', // blue-600
    colorSuccess: '#10b981', // emerald-500
    colorWarning: '#f59e0b', // amber-500
    colorError: '#ef4444',   // rose-500
    colorInfo: '#3b82f6',

    // High-End Modern Light SaaS Canvas (#F8FAFC / Slate-50)
    colorBgBase: '#ffffff',
    colorBgLayout: '#F8FAFC',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',

    // Typography & Contrast (Stripe / Linear Light)
    colorText: '#0f172a',          // slate-900 (crisp charcoal)
    colorTextSecondary: '#475569', // slate-600
    colorTextTertiary: '#94a3b8',  // slate-400
    colorTextDisabled: '#cbd5e1',  // slate-300

    // Ultra-clean Subtle Borders
    colorBorder: 'rgba(226, 232, 240, 0.85)',       // slate-200
    colorBorderSecondary: 'rgba(241, 245, 249, 0.9)', // slate-100

    // Radii
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,

    // Typography
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontWeightStrong: 600,

    // High-End Soft Shadows
    boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.05)',
    boxShadowSecondary: '0 8px 30px -6px rgba(0, 0, 0, 0.08)',

    // Motion
    motionDurationSlow: '0.25s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.15s',
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: 'rgba(255, 255, 255, 0.85)',
      bodyBg: '#F8FAFC',
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: 'rgba(239, 246, 255, 0.9)', // blue-50
      itemHoverBg: 'rgba(241, 245, 249, 0.7)',   // slate-100
      itemColor: '#475569',                       // slate-600
      itemSelectedColor: '#1d4ed8',               // blue-700
      itemBorderRadius: 10,
      itemMarginInline: 8,
    },
    Button: {
      primaryColor: '#ffffff',
      fontWeight: 600,
      borderRadius: 10,
      controlHeight: 38,
      controlHeightLG: 44,
    },
    Card: {
      borderRadius: 16,
      colorBgContainer: 'rgba(255, 255, 255, 0.85)',
      colorBorderSecondary: 'rgba(226, 232, 240, 0.8)',
      boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.05)',
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSortActiveBg: '#f1f5f9',
      rowHoverBg: '#f8fafc',
      borderColor: 'rgba(226, 232, 240, 0.8)',
      borderRadius: 12,
    },
    Modal: {
      borderRadius: 16,
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Steps: {
      colorPrimary: '#2563eb',
      dotSize: 8,
    },
    Tag: {
      borderRadius: 9999,
    },
    Badge: {
      colorBgContainer: '#2563eb',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.8)',
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.8)',
    },
    Tabs: {
      colorPrimary: '#2563eb',
      itemSelectedColor: '#1d4ed8',
      itemHoverColor: '#3b82f6',
    },
    Alert: {
      borderRadius: 12,
    },
    Progress: {
      lineBorderRadius: 100,
    },
  },
};
