import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@': path.resolve(__dirname, './src'),
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  server: { port: 3000 },
});
