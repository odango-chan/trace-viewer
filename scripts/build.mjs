import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('dist', { recursive: true })
await Promise.all([
  copyFile('site/index.html', 'dist/index.html'),
  copyFile('site/light.css', 'dist/light.css'),
])
await build({
  entryPoints: ['site/app.tsx'],
  outfile: 'dist/app.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  legalComments: 'none',
})
console.log('Trace Viewer static build written to dist/')
