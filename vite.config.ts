import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://zientres.github.io/pushistick/
export default defineConfig({
  base: '/pushistick/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true }
})
