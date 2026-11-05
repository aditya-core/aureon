import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { build as bundleWorker } from 'esbuild'

export default defineConfig({
  plugins: [react(), tailwindcss(), { name: 'nova-automation-worker', async generateBundle() { const result = await bundleWorker({entryPoints:['src/automation/worker.ts'],bundle:true,write:false,format:'iife',platform:'browser',target:'chrome116'}); this.emitFile({type:'asset',fileName:'automation-worker.js',source:result.outputFiles[0].contents}) } }],
  // Relative asset paths work both in an unpacked extension and a browser preview.
  base: './',
  build: { manifest: true, rollupOptions: { input: { main: 'index.html', popup: 'popup.html', command: 'command.html', assistant: 'sidepanel.html', research: 'research.html', automations: 'automations.html' } } },
  server: { allowedHosts: true },
})
