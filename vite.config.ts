import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { rawMarkdownHashPathPlugin } from './build/vite/rawMarkdownHashPathPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [rawMarkdownHashPathPlugin(), react(), tailwindcss()],
  base: '/',  
})
