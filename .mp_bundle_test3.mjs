import { build as esbuild } from 'esbuild';
await esbuild({
  entryPoints: ['src/engine/reports.js'],
  bundle: true, platform: 'node', format: 'esm', outfile: '.mp_reports_bundle.mjs', logLevel: 'error',
  plugins: [{ name: 'skip', setup(b){ build.onResolve({filter:/bigfishmarquis-qimen/},()=>({path:'s.js',namespace:'s'})); build.onResolve({filter:/lunar-typescript/},()=>({path:'l2.js',namespace:'s'})); build.onLoad({filter:/.*/,namespace:'s'},()=>({contents:'export const nianJiaGenerate=()=>({});export const yueJiaGenerate=()=>({});export const riJiaGenerate=()=>({});export class Solar{static fromYmd(){return new Solar()}fromHms(){return this}getLunar(){return{getJieQi:()=>""}}}',loader:'js'}));} }],
});
const { buildMangpaiReport } = await import('./.mp_reports_bundle.mjs');
const rep = buildMangpaiReport({ year:1975, month:10, day:13, hour:6, minute:30, gender:'男' });
const s = rep.sections.find(x=>x.key==='yearroute');
for (const r of s.data.rows) console.log(r.join('  |  '));
