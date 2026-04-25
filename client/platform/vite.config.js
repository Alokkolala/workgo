import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/platform/',
  server: {
    proxy: {
      '/api': 'http://localhost:4242',
      '/health': 'http://localhost:4242'
    }
  },
  build: {
    outDir: 'dist'
  }
})
