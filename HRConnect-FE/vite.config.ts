import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend from `dotnet run` (HRConnect.Presentation launchSettings "https" profile on 7289 or "http" on 5041).
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://localhost:7289'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('/react/') ||
                id.includes('\\react\\') ||
                id.includes('/react-dom/') ||
                id.includes('\\react-dom\\') ||
                id.includes('/react-router-dom/') ||
                id.includes('\\react-router-dom\\') ||
                id.includes('/@remix-run/') ||
                id.includes('\\@remix-run\\') ||
                id.includes('/zustand/') ||
                id.includes('\\zustand\\')
              ) {
                return 'vendor-react';
              }
              if (
                id.includes('/antd/') ||
                id.includes('\\antd\\') ||
                id.includes('/@ant-design/') ||
                id.includes('\\@ant-design\\')
              ) {
                return 'vendor-ui';
              }
              if (
                id.includes('/@tanstack/') ||
                id.includes('\\@tanstack\\')
              ) {
                return 'vendor-tanstack';
              }
              if (
                id.includes('/axios/') ||
                id.includes('\\axios\\') ||
                id.includes('/dayjs/') ||
                id.includes('\\dayjs\\') ||
                id.includes('/lucide-react/') ||
                id.includes('\\lucide-react\\')
              ) {
                return 'vendor-utils';
              }
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // apiClient defaults to the relative '/api/v1', so dev requests go through this proxy.
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/hubs': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
