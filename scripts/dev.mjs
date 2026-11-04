import { context } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('dist', { recursive: true })
await Promise.all([
  copyFile('site/index.html', 'dist/index.html'),
  copyFile('site/light.css', 'dist/light.css'),
])
const ctx = await context({
  entryPoints: ['site/app.tsx'],
  outfile: 'dist/app.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
})
await ctx.watch()
const server = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 8080 })
console.log('Trace Viewer dev: http://' + server.host + ':' + server.port)
