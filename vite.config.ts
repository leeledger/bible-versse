import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // 환경에 따른 백엔드 타겟 설정
  const isTest = env.NODE_ENV === 'test';
  const backendTarget = isTest ? 'http://backend-test:3001' : 'http://backend:3001';
  console.log(`Using backend target: ${backendTarget} for environment: ${env.NODE_ENV}`);

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
          target: backendTarget, // Use the appropriate docker service name based on environment
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
          target: backendTarget, // Use the appropriate docker service name based on environment
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
