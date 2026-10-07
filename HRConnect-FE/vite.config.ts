import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend from `dotnet run` (HRConnect.Presentation launchSettings "http" profile).
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5041'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
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
        },
      },
    },
  }
})
