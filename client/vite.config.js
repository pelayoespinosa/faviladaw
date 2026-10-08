import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/faviladaw/',
  plugins: [react()],
  build: {
    outDir: '../public'
  },
  server: {
    proxy: {
      '/faviladaw/api': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/faviladaw/, '')
      }
    }
  }
})
