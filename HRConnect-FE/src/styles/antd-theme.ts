import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    // Brand Colors
    colorPrimary: '#0284c7',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#0284c7',

    // Background
    colorBgBase: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',

    // Text
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#94a3b8',
    colorTextDisabled: '#cbd5e1',

    // Border
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Typography
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontWeightStrong: 600,

    // Shadows
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
    boxShadowSecondary: '0 4px 6px -1px rgb(0 0 0 / 0.07)',

    // Motion
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
  },
  components: {
    Layout: {
      siderBg: '#0f172a',
      headerBg: '#ffffff',
      bodyBg: '#f8fafc',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: '#0284c7',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      darkItemColor: '#94a3b8',
      darkItemSelectedColor: '#ffffff',
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Button: {
      primaryColor: '#ffffff',
      fontWeight: 500,
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
    },
    Card: {
      borderRadius: 12,
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
    },
    Table: {
      headerBg: '#f1f5f9',
      headerColor: '#475569',
      headerSortActiveBg: '#e2e8f0',
      rowHoverBg: '#f0f9ff',
      borderRadius: 12,
    },
    Modal: {
      borderRadius: 16,
    },
    Steps: {
      colorPrimary: '#0284c7',
      dotSize: 8,
    },
    Tag: {
      borderRadius: 6,
    },
    Badge: {
      colorBgContainer: '#0284c7',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Alert: {
      borderRadius: 10,
    },
    Progress: {
      lineBorderRadius: 100,
    },
  },
};
