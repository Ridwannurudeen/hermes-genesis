/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8003', '/ws': { target: 'ws://localhost:8003', ws: true } } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/d3') || id.includes('\\d3')) return 'd3'
          if (id.includes('/recharts') || id.includes('\\recharts')) return 'recharts'
          if (id.includes('/framer-motion') || id.includes('\\framer-motion')) return 'framer'
          if (
            id.includes('/react') ||
            id.includes('\\react') ||
            id.includes('/react-dom') ||
            id.includes('\\react-dom') ||
            id.includes('/react-router-dom') ||
            id.includes('\\react-router-dom')
          ) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
  }
})
