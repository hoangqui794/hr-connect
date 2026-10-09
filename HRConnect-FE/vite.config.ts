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
      },
    },
  }
})
