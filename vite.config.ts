import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths work both in an unpacked extension and a browser preview.
  base: './',
  server: { allowedHosts: true },
})
