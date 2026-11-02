import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 개발 중에는 /api 요청을 로컬 API 서버로 넘긴다 (배포 환경에서는 Nginx·Ingress가 같은 일을 한다)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
