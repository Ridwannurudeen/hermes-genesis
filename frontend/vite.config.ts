import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8003', '/ws': { target: 'ws://localhost:8003', ws: true } } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'd3': ['d3'],
          'recharts': ['recharts'],
          'framer': ['framer-motion'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  }
})
