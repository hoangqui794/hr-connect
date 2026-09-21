import React, { useState } from 'react';
import { Button, Input, Select, TreeSelect, Typography } from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  RocketOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { INDUSTRY_TAXONOMY } from '@/constants/industryTaxonomy';
import { useI18nStore } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const { Title, Paragraph } = Typography;

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18nStore();
  const { isAuthenticated, role } = useAuthStore();

  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState<string | undefined>();
  const [location, setLocation] = useState<string | undefined>();

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.append('keyword', keyword.trim());
    if (industry) params.append('industry', industry);
    if (location && location !== 'ALL') params.append('location', location);

    const queryStr = params.toString();
    navigate(queryStr ? `/jobs?${queryStr}` : '/jobs');
  };

  const handlePostJob = () => {
    if (isAuthenticated && role === UserRole.CLIENT) {
      navigate('/jobs/create');
    } else {
      navigate('/register?role=CLIENT');
    }
  };

  const handleJoinAffiliate = () => {
    if (isAuthenticated && role === UserRole.AFFILIATE) {
      navigate('/affiliate/dashboard');
    } else {
      navigate('/register?role=AFFILIATE');
    }
  };

  const locationOptions = [
    { value: 'ALL', label: t.hero.searchLocationAll },
    { value: 'HN', label: `📍 ${t.hero.locationHanoi}` },
    { value: 'HCM', label: `📍 ${t.hero.locationHcm}` },
    { value: 'DN', label: `📍 ${t.hero.locationDanang}` },
    { value: 'REMOTE', label: `🌐 ${t.hero.locationRemote}` },
  ];

  return (
    <section
      style={{
        position: 'relative',
        padding: '72px 24px 96px',
        textAlign: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #0f172a 0%, #111e38 100%)',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 420,
          background: 'radial-gradient(ellipse at center, rgba(2, 132, 199, 0.22) 0%, rgba(14, 165, 233, 0.05) 50%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>
        {/* Top Announcement Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            borderRadius: 100,
            padding: '6px 16px',
            marginBottom: 28,
            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.15)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 10px #38bdf8',
            }}
          />
          <span
            style={{
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t.hero.badge}
          </span>
        </div>

        {/* Hero Title */}
        <Title
          level={1}
          style={{
            color: '#f8fafc',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 800,
            lineHeight: 1.18,
            marginBottom: 20,
            letterSpacing: '-1.5px',
          }}
        >
          {t.hero.titleMain}
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t.hero.titleHighlight}
          </span>
        </Title>

        {/* Hero Subtitle */}
        <Paragraph
          style={{
            color: '#94a3b8',
            fontSize: 'clamp(16px, 2vw, 19px)',
            maxWidth: 780,
            margin: '0 auto 36px',
            lineHeight: 1.7,
            fontWeight: 400,
          }}
        >
          {t.hero.subtitle}
        </Paragraph>

        {/* Dual Primary CTAs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 48,
          }}
        >
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            onClick={handlePostJob}
            style={{
              height: 50,
              padding: '0 28px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              border: 'none',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.45)',
            }}
          >
            {t.hero.ctaPostJob}
          </Button>
          <Button
            size="large"
            icon={<UsergroupAddOutlined />}
            onClick={handleJoinAffiliate}
            style={{
              height: 50,
              padding: '0 28px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f1f5f9',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {t.hero.ctaJoinAffiliate}
          </Button>
        </div>

        {/* Advanced 3-Field Search Bar */}
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 18,
            padding: '12px 14px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) minmax(140px, auto)',
              gap: 10,
              alignItems: 'center',
            }}
          >
            {/* Field 1: Keyword Input */}
            <div style={{ position: 'relative' }}>
              <Input
                size="large"
                allowClear
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined style={{ color: '#0284c7', fontSize: 16, marginRight: 4 }} />}
                placeholder={t.hero.searchKeywordPlaceholder}
                style={{
                  height: 46,
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                }}
              />
            </div>

            {/* Field 2: Antd TreeSelect with 785 LinkedIn Industry taxonomy */}
            <div>
              <TreeSelect
                showSearch
                size="large"
                allowClear
                value={industry}
                onChange={setIndustry}
                treeData={INDUSTRY_TAXONOMY}
                placeholder={
                  <span>
                    <ApartmentOutlined style={{ color: '#0ea5e9', marginRight: 6 }} />
                    {t.hero.searchIndustryPlaceholder}
                  </span>
                }
                treeDefaultExpandAll={false}
                filterTreeNode={(search, node) =>
                  String(node.title ?? '').toLowerCase().includes(search.toLowerCase())
                }
                popupMatchSelectWidth={false}
                style={{
                  width: '100%',
                  height: 46,
                }}
                dropdownStyle={{
                  borderRadius: 12,
                  maxHeight: 400,
                }}
              />
            </div>

            {/* Field 3: Location Select */}
            <div>
              <Select
                size="large"
                allowClear
                value={location}
                onChange={setLocation}
                placeholder={
                  <span>
                    <EnvironmentOutlined style={{ color: '#10b981', marginRight: 6 }} />
                    {t.hero.searchLocationPlaceholder}
                  </span>
                }
                options={locationOptions}
                style={{
                  width: '100%',
                  height: 46,
                }}
              />
            </div>

            {/* Action Button: Find Jobs */}
            <div>
              <Button
                type="primary"
                size="large"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 24px',
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                }}
              >
                {t.hero.searchButton}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
