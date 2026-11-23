import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { rollupOptions: {
    input: { index: 'index.html', prototype3d: 'prototype3d.html' },
    output: { manualChunks: { three: ['three'] } },
  } },
  // テストは tests/ 配下の TypeScript だけを対象にする。
  // 作業用ディレクトリ（.qa など）に転記されたコピーを拾わせない。
  test: { include: ['tests/**/*.test.ts'] },
});
