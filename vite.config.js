import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devApiProxy = process.env.VITE_DEV_API_PROXY || 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: devApiProxy,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 玄学排盘引擎：各自独立 chunk，避免全塞进主包
          'engine-bazi': ['cantian-tymext'],
          'engine-ziwei': ['iztro'],
          'engine-liuyao': ['iching-shifa', 'tyme4ts'],
          'engine-qimen': ['bigfishmarquis-qimen', 'lunar-typescript'],
          'kangxi': ['./src/data/kangxi.js']
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
})
