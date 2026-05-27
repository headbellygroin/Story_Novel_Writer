import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4800,
    host: true,
    allowedHosts: ['desktop-fbpj753'],
  },
});
