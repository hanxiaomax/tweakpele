/** Build src/main.jsx → assets/app.js (committed; GitHub Pages serves it statically). */
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: 'assets/app.js',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  metafile: true,
  banner: { js: '/* tweakpele UI — built from src/ with esbuild: npm run build */' },
});

const sizes = {};
for (const [file, info] of Object.entries(result.metafile.outputs)) {
  if (!file.startsWith('assets/')) continue;
  sizes[file] = (info.bytes / 1024).toFixed(1) + ' KB';
}
console.log('built', sizes);
