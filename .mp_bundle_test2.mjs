import { build as esbuild } from 'esbuild';
await esbuild({
  entryPoints: ['src/engine/reports.js'],
  bundle: true, platform: 'node', format: 'esm',
  outfile: '.mp_reports_bundle.mjs',
  logLevel: 'silent',
  external: ['react','react-dom'],
});
const { buildMangpaiReport } = await import('./.mp_reports_bundle.mjs');
const rep = buildMangpaiReport({ year:1975, month:10, day:13, hour:6, minute:30, gender:'男' });
console.log('rep ok?', rep.ok, 'sections:', rep.sections ? rep.sections.length : 'NONE');
if (rep.meta) console.log('meta:', JSON.stringify(rep.meta));
console.log('advice:', JSON.stringify(rep.advice).slice(0,200));
