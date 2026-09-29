/**
 * @file themeConfig.ts
 * @description Central Ant Design v5 Theme Token configuration integrated with Tailwind CSS.
 * Spec: Emerald Tuyển dụng Công nghệ (#00b14f / #10b981), Be Vietnam Pro font, Clean White / Light Slate Enterprise Table.
 */
import { theme, type ThemeConfig } from 'antd';

export const emeraldBrand = {
  primary: '#00b14f',        // Modern TopCV Tech Emerald
  primaryHover: '#009643',   // Darker Emerald for hover states
  primaryActive: '#007a36',  // Deep Emerald for active states
  primaryBg: '#ecfdf5',      // emerald-50 tint
  primaryBorder: '#a7f3d0',  // emerald-200 border
  secondary: '#10b981',      // Emerald 500
  accentRuby: '#e11d48',     // Red Heart Tier (>=80%)
  accentTeal: '#0d9488',     // Strong Tier (70-79%)
  accentGreen: '#16a34a',    // Moderate Tier (60-69%)
  accentGray: '#64748b',     // Weak Tier (<60%)
};

export const themeConfig: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // 1. Primary Colors - Emerald Tuyển dụng Công nghệ (TopCV / Tech Headhunting)
    colorPrimary: emeraldBrand.primary,
    colorPrimaryHover: emeraldBrand.primaryHover,
    colorPrimaryActive: emeraldBrand.primaryActive,
    colorPrimaryBg: emeraldBrand.primaryBg,
    colorPrimaryBorder: emeraldBrand.primaryBorder,

    // Status Colors
    colorSuccess: '#10b981', // emerald-500
    colorWarning: '#f59e0b', // amber-500
    colorError: '#ef4444',   // rose-500
    colorInfo: '#0284c7',    // sky-600

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
      itemSelectedBg: '#ecfdf5',            // emerald-50
      itemHoverBg: 'rgba(241, 245, 249, 0.8)', // slate-100
      itemColor: '#475569',
      itemSelectedColor: '#009643',
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Button: {
      primaryColor: '#ffffff',
      fontWeight: 600,
      borderRadius: 8,
      controlHeight: 38,
      controlHeightLG: 44,
      primaryShadow: '0 2px 4px 0 rgba(0, 177, 79, 0.25)',
    },
    Card: {
      borderRadius: 12,
      colorBgContainer: '#ffffff',
      colorBorderSecondary: 'rgba(226, 232, 240, 0.85)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
      headerFontSize: 16,
      headerHeight: 48,
    },
    // CRUCIAL: Ant Design Table Light Enterprise Spec (TopCV / LinkedIn Talent)
    // Completely solves invisible/dark-text conflict
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#334155',
      headerSortActiveBg: '#f1f5f9',
      headerSortHoverBg: '#f1f5f9',
      headerBorderRadius: 8,
      rowHoverBg: 'rgba(236, 253, 245, 0.45)', // emerald-50/45 tint on hover
      rowSelectedBg: '#ecfdf5',
      rowSelectedHoverBg: '#d1fae5',
      borderColor: 'rgba(226, 232, 240, 0.85)',
      borderRadius: 8,
      cellPaddingBlock: 13,
      cellPaddingInline: 16,
      fontSize: 13.5,
    },
    Modal: {
      borderRadius: 14,
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      titleFontSize: 18,
    },
    Steps: {
      colorPrimary: '#00b14f',
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
      colorBgContainer: '#00b14f',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.85)',
      activeBorderColor: '#00b14f',
      hoverBorderColor: '#10b981',
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
      colorBgContainer: '#ffffff',
      colorBorder: 'rgba(203, 213, 225, 0.85)',
      colorPrimary: '#00b14f',
      colorPrimaryHover: '#10b981',
    },
    Tabs: {
      colorPrimary: '#00b14f',
      itemSelectedColor: '#009643',
      itemHoverColor: '#10b981',
      titleFontSize: 14,
    },
    Alert: {
      borderRadius: 10,
    },
    Progress: {
      lineBorderRadius: 9999,
      defaultColor: '#00b14f',
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
