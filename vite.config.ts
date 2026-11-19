import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies static HTML/JS/assets required by the Vanilla JS multi-page app into dist/.
      {
        name: 'copy-doclocker-static-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const foldersToCopy = ['js', 'assets'];
          for (const folder of foldersToCopy) {
            const srcFolder = path.resolve(__dirname, folder);
            const distFolder = path.resolve(distDir, folder);
            if (fs.existsSync(distDir) && fs.existsSync(srcFolder)) {
              fs.cpSync(srcFolder, distFolder, {recursive: true, force: true});
            }
          }
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distSrcAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distSrcAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          register: path.resolve(__dirname, 'register.html'),
          dashboard: path.resolve(__dirname, 'dashboard.html'),
          upload: path.resolve(__dirname, 'upload.html'),
          documents: path.resolve(__dirname, 'documents.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
