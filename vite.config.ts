import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base path for GitHub Pages deployment
  // If your repo is https://github.com/usps-dataeng/kafka-monitoring, use '/kafka-monitoring/'
  // If your repo is https://github.com/usps-dataeng/usps-dataeng.github.io, use '/'
  base: process.env.GITHUB_ACTIONS ? '/kafka-eeb-monitoring/' : '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
