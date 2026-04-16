import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const postBuildPlugin = {
  name: 'post-build',
  writeBundle() {
    const publicDir = resolve(__dirname, 'public');
    const distDir = resolve(__dirname, 'dist');

    // Copy manifest.json
    fs.copyFileSync(resolve(publicDir, 'manifest.json'), resolve(distDir, 'manifest.json'));

    // Move src/popup.html to root
    const srcPopup = resolve(distDir, 'src/popup.html');
    if (fs.existsSync(srcPopup)) {
      fs.copyFileSync(srcPopup, resolve(distDir, 'popup.html'));
    }

    // Copy icons
    fs.cpSync(resolve(publicDir, 'icons'), resolve(distDir, 'icons'), { recursive: true, force: true });

    // Copy auth-success.html
    fs.copyFileSync(resolve(publicDir, 'pages/auth-success.html'), resolve(distDir, 'auth-success.html'));

    // Remove src and pages folders
    if (fs.existsSync(resolve(distDir, 'src'))) {
      fs.rmSync(resolve(distDir, 'src'), { recursive: true });
    }
    if (fs.existsSync(resolve(distDir, 'pages'))) {
      fs.rmSync(resolve(distDir, 'pages'), { recursive: true });
    }
  },
};

export default defineConfig({
  plugins: [react(), postBuildPlugin],
  build: {
    outDir: 'dist',
    minify: 'terser',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
