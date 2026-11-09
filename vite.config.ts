import { defineConfig } from 'vite'

export default defineConfig({
  base: '/mechanics-9/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
})
