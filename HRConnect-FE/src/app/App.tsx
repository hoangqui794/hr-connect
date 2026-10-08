import React from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { antdTheme } from '@/styles/antd-theme';
import { useI18nStore } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import '@/styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

// Cached queries are keyed by page, not by user: drop them whenever the signed-in account changes
// (logout, or logging in as someone else) so one user never sees another user's data.
let lastAccount = useAuthStore.getState().user?.email ?? null;
useAuthStore.subscribe((state) => {
  const account = state.isAuthenticated ? state.user?.email ?? null : null;
  if (account !== lastAccount) {
    lastAccount = account;
    queryClient.clear();
  }
});

const App: React.FC = () => {
  const locale = useI18nStore((state) => state.locale);
  const antdLocale = locale === 'en' ? enUS : viVN;

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme} locale={antdLocale}>
        {/* AntApp gives message/modal/notification the theme via App.useApp(). */}
        <AntApp>
          <RouterProvider router={router} />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;

