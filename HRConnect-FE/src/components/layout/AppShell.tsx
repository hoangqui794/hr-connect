/**
 * @file AppShell.tsx
 * @description Enterprise application shell for HR Connect.
 *
 * Layout architecture:
 *   - CANDIDATE ROLE: No sidebar (full-width LinkedIn/TopCV style layout). Uses CandidateHeader.
 *   - B2B & INTERNAL ROLES (CLIENT, AFFILIATE, INTERNAL_HR, ADMIN):
 *     Fixed Dark Navy Sider with AppHeader and multi-column management consoles.
 */

import React, { useState, useEffect } from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './Header';
import { CandidateHeader } from './CandidateHeader';
import { MockWebSocketService } from '@/services/mockWebSocket';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const { Content } = Layout;

const SIDER_WIDTH = 240;
const SIDER_COLLAPSED_WIDTH = 64;

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();
  const { role } = useAuthStore();

  // Candidate has a clean, full-width portal layout with no left sidebar
  const isCandidate = role === UserRole.CANDIDATE;
  const siderWidth = isCandidate ? 0 : collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH;

  // Connect the mock SignalR/WebSocket service for the lifetime of the shell.
  useEffect(() => {
    MockWebSocketService.connect();
    return () => {
      MockWebSocketService.disconnect();
    };
  }, []);

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      {/*
       * Sidebar is ONLY rendered for B2B & Internal roles: CLIENT, AFFILIATE, INTERNAL_HR, ADMIN.
       * For CANDIDATE role, the sidebar is completely removed to provide full-width TopCV / LinkedIn experience.
       */}
      {!isCandidate && (
        <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      )}

      <Layout
        style={{
          marginLeft: siderWidth,
          transition: 'margin-left 0.3s cubic-bezier(0.2, 0, 0, 1)',
          minHeight: '100vh',
          background: token.colorBgLayout,
        }}
      >
        {/* Render specialized CandidateHeader for CANDIDATE, and AppHeader for other roles */}
        {isCandidate ? <CandidateHeader /> : <AppHeader siderWidth={0} />}

        <Content
          style={{
            padding: isCandidate ? '24px 32px' : '24px',
            background: token.colorBgLayout,
            minHeight: 'calc(100vh - 64px)',
            overflowX: 'hidden',
          }}
        >
          {/* Full-width container with comfortable max-width for candidate view */}
          <div
            className="animate-fade-in"
            style={{
              maxWidth: isCandidate ? 1280 : '100%',
              margin: isCandidate ? '0 auto' : '0',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
