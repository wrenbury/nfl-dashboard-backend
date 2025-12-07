import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/games': 'http://localhost:8000',
      // Only proxy the CFB API endpoint, NOT the /cfb React route
      '/cfb/scoreboard': 'http://localhost:8000',
    },
  },
})
