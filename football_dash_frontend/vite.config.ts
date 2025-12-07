import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/cfb': 'http://localhost:8000',
      '/games': 'http://localhost:8000',
    },
  },
})
