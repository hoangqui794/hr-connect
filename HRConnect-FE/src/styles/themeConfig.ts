/**
 * @file themeConfig.ts
 * @description Central Ant Design v5 Theme Token configuration integrated with Tailwind CSS.
 * Spec: Emerald Tuyển dụng Công nghệ (#00b14f / #10b981), Be Vietnam Pro font, Clean White / Light Slate Enterprise Table.
 */
import { theme, type ThemeConfig } from 'antd';

export const primaryBrand = {
  primary: '#2563eb',        // Primary Action Blue (blue-600)
  primaryHover: '#1d4ed8',   // Darker Blue for hover states (blue-700)
  primaryActive: '#1e40af',  // Deep Blue for active states (blue-800)
  primaryBg: '#eff6ff',      // blue-50 tint
  primaryBorder: '#bfdbfe',  // blue-200 border
  secondary: '#3b82f6',      // blue-500
  accentRuby: '#e11d48',     // Red Heart Tier (>=80%)
  accentTeal: '#0d9488',     // Strong Tier (70-79%)
  accentGreen: '#16a34a',    // Moderate Tier (60-69%)
  accentGray: '#64748b',     // Weak Tier (<60%)
};

export const emeraldBrand = primaryBrand;

export const themeConfig: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // 1. Primary Colors - Unified Blue Action
    colorPrimary: primaryBrand.primary,
    colorPrimaryHover: primaryBrand.primaryHover,
    colorPrimaryActive: primaryBrand.primaryActive,
    colorPrimaryBg: primaryBrand.primaryBg,
    colorPrimaryBorder: primaryBrand.primaryBorder,

    // Status Colors (Success: emerald-600, Error: rose-600)
    colorSuccess: '#16a34a', // emerald-600
    colorWarning: '#f59e0b', // amber-500
    colorError: '#e11d48',   // rose-600
    colorInfo: '#2563eb',    // blue-600

    // Canvas Backgrounds - Light Slate Enterprise
    colorBgBase: '#ffffff',
    colorBgLayout: '#F8FAFC',       // slate-50
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgSpotlight: '#0f172a',

    // High Contrast Typography (Vietnamese-optimized)
    colorTextBase: '#0f172a',       // slate-900 (crisp high contrast)
    colorText: '#0f172a',
    colorTextSecondary: '#475569',  // slate-600
    colorTextTertiary: '#94a3b8',   // slate-400
    colorTextQuaternary: '#cbd5e1', // slate-300
    colorTextDisabled: '#cbd5e1',

    // Borders & Dividers
    colorBorder: 'rgba(226, 232, 240, 0.9)',        // slate-200
    colorBorderSecondary: 'rgba(241, 245, 249, 0.9)', // slate-100
    colorSplit: 'rgba(226, 232, 240, 0.8)',

    // Radii & Metric tokens
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    borderRadiusXS: 4,

    // Typography: Be Vietnam Pro for pristine Vietnamese baseline and diacritics
    fontFamily: "'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    fontSizeHeading1: 28,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    fontWeightStrong: 600,

    // Shadows
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',

    // Interactive Controls
    controlHeight: 38,
    controlHeightLG: 44,
    controlHeightSM: 32,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: 'rgba(255, 255, 255, 0.92)',
      bodyBg: '#F8FAFC',
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: '#eff6ff',            // blue-50
      itemHoverBg: 'rgba(241, 245, 249, 0.8)', // slate-100
      itemColor: '#475569',
      itemSelectedColor: '#2563eb',
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Button: {
      primaryColor: '#ffffff',
      fontWeight: 600,
      borderRadius: 8,
      controlHeight: 38,
      controlHeightLG: 44,
      primaryShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    Card: {
      borderRadius: 12,
      colorBgContainer: '#ffffff',
      colorBorderSecondary: 'rgba(226, 232, 240, 0.85)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
      headerFontSize: 16,
      headerHeight: 48,
    },
    // Standard Enterprise Clean Table Spec: py-3 px-3.5 (12px 14px)
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#334155',
      headerSortActiveBg: '#f1f5f9',
      headerSortHoverBg: '#f1f5f9',
      headerBorderRadius: 8,
      rowHoverBg: 'rgba(239, 246, 255, 0.5)', // blue-50 hover tint
      rowSelectedBg: '#eff6ff',
      rowSelectedHoverBg: '#dbeafe',
      borderColor: 'rgba(226, 232, 240, 0.85)',
      borderRadius: 8,
      cellPaddingBlock: 12,
      cellPaddingInline: 14,
      fontSize: 13.5,
    },
    Modal: {
      borderRadius: 14,
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      titleFontSize: 18,
    },
    Steps: {
      colorPrimary: '#2563eb',
      dotSize: 8,
      titleLineHeight: 24,
      descriptionMaxWidth: 160,
    },
    Tag: {
      borderRadius: 6,
      fontSize: 12,
      lineHeight: 20,
    },
    Badge: {
      colorBgContainer: '#2563eb',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.85)',
      activeBorderColor: '#2563eb',
      hoverBorderColor: '#3b82f6',
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.85)',
      colorPrimary: '#2563eb',
      colorPrimaryHover: '#3b82f6',
    },
    Tabs: {
      colorPrimary: '#2563eb',
      itemSelectedColor: '#1d4ed8',
      itemHoverColor: '#3b82f6',
      titleFontSize: 14,
    },
    Alert: {
      borderRadius: 10,
    },
    Progress: {
      lineBorderRadius: 9999,
      defaultColor: '#2563eb',
    },
  },
};

/**
 * Dark Theme Configuration for dedicated dark surfaces
 */
export const darkThemeConfig: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#10b981',
    colorBgBase: '#0f172a',
    colorBgLayout: '#090d16',
    colorBgContainer: '#1e293b',
    colorBgElevated: '#334155',
    colorTextBase: '#f8fafc',
    colorText: '#f8fafc',
    colorTextSecondary: '#94a3b8',
    colorBorder: 'rgba(51, 65, 85, 0.8)',
    borderRadius: 8,
    fontFamily: "'Be Vietnam Pro', 'Inter', sans-serif",
  },
};

export const antdTheme = themeConfig;
export default themeConfig;
