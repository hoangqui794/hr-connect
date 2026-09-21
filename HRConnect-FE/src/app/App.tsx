import React from 'react';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { antdTheme } from '@/styles/antd-theme';
import { useI18nStore } from '@/i18n';
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

const App: React.FC = () => {
  const locale = useI18nStore((state) => state.locale);
  const antdLocale = locale === 'en' ? enUS : viVN;

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme} locale={antdLocale}>
        <RouterProvider router={router} />
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;

