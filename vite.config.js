import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  root: 'src',
  base: '/chatalarm/',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../',
    emptyOutDir: false,
  }
})
