import { copyFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';

const out = 'dist/3d-pages';
await build({
  configFile: false,
  base: './',
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: true,
    rollupOptions: {
      input: 'prototype3d.html',
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
await rename(join(out, 'prototype3d.html'), join(out, 'index.html'));
await copyFile('node_modules/three/LICENSE', join(out, 'three-LICENSE.txt'));
await writeFile(join(out, '.nojekyll'), '');
