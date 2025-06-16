import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    server: { // For development (npm run dev)
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://backend:3001', // Use the docker service name
          changeOrigin: true,

        },
      },
    },
    preview: { // For serving the build (npm run preview)
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['robotncoding.synology.me'],
      proxy: {
        '/api': {
          target: 'http://backend:3001', // Use the docker service name
          changeOrigin: true,

        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
