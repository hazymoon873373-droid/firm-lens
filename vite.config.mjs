import { resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/firm-lens/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        browserAi: resolve(import.meta.dirname, 'experiments/browser-ai/index.html')
      }
    }
  },
  plugins: [
    {
      name: 'copy-static-root-files',
      closeBundle() {
        for (const [file, output] of [
          ['de-xuat.md', 'de-xuat.md'],
          ['favicon.svg', 'favicon.svg'],
          ['.nojekyll', '.nojekyll'],
          ['docs/verification/competition-readiness.md', 'competition-readiness.md'],
          ['docs/verification/repo-remediation-01.md', 'repo-remediation-01.md'],
          ['docs/verification/qwen-15b-final-evidence.json', 'ai-verification-evidence.json'],
          ['docs/verification/toolkit-sources.md', 'toolkit-sources.md'],
          ['research/co-so-khoa-hoc.md', 'co-so-khoa-hoc.md']
        ]) {
          const src = resolve(import.meta.dirname, file);
          const dest = resolve(import.meta.dirname, 'dist', output);
          if (existsSync(src)) copyFileSync(src, dest);
        }
      }
    }
  ]
});
