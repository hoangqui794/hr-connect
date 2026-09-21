import React from 'react';
import { Dropdown, Button } from 'antd';
import { DownOutlined, CheckOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useI18nStore } from '@/i18n';

interface LanguageSwitcherProps {
  theme?: 'dark' | 'light';
  size?: 'small' | 'middle' | 'large';
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  theme = 'dark',
  size = 'middle',
  showLabel = true,
}) => {
  const { locale, setLocale } = useI18nStore();

  const isDark = theme === 'dark';

  const menuItems: MenuProps['items'] = [
    {
      key: 'vi',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 130 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🇻🇳</span>
            <span style={{ fontWeight: locale === 'vi' ? 600 : 400 }}>Tiếng Việt</span>
          </span>
          {locale === 'vi' && <CheckOutlined style={{ color: '#0284c7', fontSize: 12 }} />}
        </div>
      ),
      onClick: () => setLocale('vi'),
    },
    {
      key: 'en',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 130 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🇬🇧</span>
            <span style={{ fontWeight: locale === 'en' ? 600 : 400 }}>English</span>
          </span>
          {locale === 'en' && <CheckOutlined style={{ color: '#0284c7', fontSize: 12 }} />}
        </div>
      ),
      onClick: () => setLocale('en'),
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <Button
        size={size}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #e2e8f0',
          color: isDark ? '#f8fafc' : '#334155',
          borderRadius: 8,
          fontWeight: 500,
          padding: showLabel ? '4px 12px' : '4px 8px',
          boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <span style={{ fontSize: 15 }}>{locale === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
        {showLabel && (
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {locale === 'vi' ? 'Tiếng Việt' : 'English'}
          </span>
        )}
        <DownOutlined style={{ fontSize: 10, opacity: 0.7 }} />
      </Button>
    </Dropdown>
  );
};
