import { build as esbuild } from 'esbuild';
await esbuild({
  entryPoints: ['src/engine/reports.js'],
  bundle: true, platform: 'node', format: 'esm',
  outfile: '.mp_reports_bundle.mjs',
  logLevel: 'error',
  plugins: [{
    name: 'skip-qimen',
    setup(b) {
      b.onResolve({ filter: /bigfishmarquis-qimen/ }, () => ({ path: 'qimen-stub.js', namespace: 'stub' }));
      b.onResolve({ filter: /lunar-typescript/ }, () => ({ path: 'lunar-stub.js', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
export const nianJiaGenerate=()=>({}); export const yueJiaGenerate=()=>({}); export const riJiaGenerate=()=>({});
export class Solar { static fromYmd(){return new Solar()} fromHms(){return this} getLunar(){return {getJieQi:()=>''}} };
export class LunarMonth { static fromYm(){return {getFirstJieQi:()=>null}} }
`, loader: 'js' }));
    }
  }],
});
const { buildMangpaiReport } = await import('./.mp_reports_bundle.mjs');
const rep = buildMangpaiReport({ year:1975, month:10, day:13, hour:6, minute:30, gender:'男' });
const s = rep.sections.find(x=>x.key==='yearroute');
console.log('== 庚辰运逐年路线图 ==');
for (const r of s.data.rows) console.log(r.join('  |  '));
console.log('\n== meta ==', JSON.stringify(rep.meta));
