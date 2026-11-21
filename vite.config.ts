import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // テストは tests/ 配下の TypeScript だけを対象にする。
  // 作業用ディレクトリ（.qa など）に転記されたコピーを拾わせない。
  test: { include: ['tests/**/*.test.ts'] },
});
