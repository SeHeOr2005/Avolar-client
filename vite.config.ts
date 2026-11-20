import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // En desarrollo, /api se reenvía al backend: mismo origen, sin problemas de cookies ni CORS.
      proxy: {
        '/api': { target: env.DEV_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
      },
    },
  };
});
