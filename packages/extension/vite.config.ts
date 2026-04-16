import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    minify: 'terser',
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

// Copy manifest.json and public files to dist after build
const copyFilesPlugin = {
  name: 'copy-files',
  writeBundle() {
    const publicDir = resolve(__dirname, 'public');
    const distDir = resolve(__dirname, 'dist');

    // Copy manifest.json
    const manifest = fs.readFileSync(resolve(publicDir, 'manifest.json'), 'utf-8');
    fs.writeFileSync(resolve(distDir, 'manifest.json'), manifest);

    // Copy icons
    const iconsDir = resolve(publicDir, 'icons');
    if (fs.existsSync(iconsDir)) {
      const iconsDist = resolve(distDir, 'icons');
      if (!fs.existsSync(iconsDist)) fs.mkdirSync(iconsDist);
      fs.readdirSync(iconsDir).forEach((file) => {
        fs.copyFileSync(resolve(iconsDir, file), resolve(iconsDist, file));
      });
    }

    // Copy auth-success.html
    const authSuccess = resolve(publicDir, 'pages', 'auth-success.html');
    if (fs.existsSync(authSuccess)) {
      fs.copyFileSync(authSuccess, resolve(distDir, 'auth-success.html'));
    }
  },
};
