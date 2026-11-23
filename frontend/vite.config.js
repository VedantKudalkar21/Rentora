import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', 'Referrer-Policy': 'strict-origin-when-cross-origin' }, port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', 'Referrer-Policy': 'strict-origin-when-cross-origin' }, port: 4173, proxy: { '/api': 'http://localhost:8080' } },
});
