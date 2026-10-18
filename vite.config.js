import { defineConfig } from 'vite'

export default defineConfig({
  base: '/moglin/',
  server: {
    port: 5173,
    strictPort: false,
  },
})
