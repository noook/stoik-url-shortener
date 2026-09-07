import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Dashboard is served under /admin on the same domain as the redirect
  // service (which owns "/" and bare short codes) - see
  // apps/api/src/links/redirect.controller.ts and docker-compose.yml's
  // `web` router. Affects both dev server and build asset URLs; App.tsx's
  // BrowserRouter `basename` must stay in sync with this.
  base: '/admin/',
  plugins: [
    react(),
    tailwindcss(),
    // Auto-imported, tree-shaken icon components: import HomeIcon from
    // '~icons/lucide/home'. Lucide is the preferred icon set for this app.
    Icons({ compiler: 'jsx', jsx: 'react' }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Lets the dev server proxy API calls so cookies stay same-origin
      // locally too - matches production's *.nook.sh same-registrable-domain
      // setup closely enough for local dev.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
