import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Forward browser's original Host to the backend so API docs URLs match
function forwardHost() {
  return {
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any, req: any) => {
        const host = req.headers.host;
        if (host) {
          proxyReq.setHeader('X-Forwarded-Host', host);
          proxyReq.setHeader('X-Forwarded-Proto', 'http');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', ...forwardHost() },
      '/search': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/search/, '/api/search'),
        ...forwardHost(),
      },
      '/docs': { target: 'http://localhost:8000', ...forwardHost() },
      '/redoc': { target: 'http://localhost:8000', ...forwardHost() },
      '/openapi.json': { target: 'http://localhost:8000', ...forwardHost() },
    },
  },
})
