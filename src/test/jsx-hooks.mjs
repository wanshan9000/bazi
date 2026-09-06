// Node 模块加载钩子：让 node --test 能直接跑前端代码。
//
// 项目里 38 个组件此前一条自动化测试都没有，根因就是 node 跑不动前端模块。
// 缺的其实只有三件事，这里各补一件：
//   1. JSX / TypeScript：node 不认，交给 esbuild 转（vite 本来就带它，同一个转换器行为一致）。
//      .ts 也必须接管：一旦注册了同步钩子，所有模块都走同步加载路径，而 node 内建的
//      类型擦除对 node_modules 下的 .ts 直接报错，依赖里恰好就有这种包
//      （bigfishmarquis-qimen 发的是 .ts 源码）。
//   2. 省略扩展名的导入：`'../engine/qimen'` 这种 vite 能解析、node ESM 不能。
//   3. `import.meta.env`：vite 注入的，node 下是 undefined，一读就抛。
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

const LOADERS = { '.jsx': 'jsx', '.tsx': 'tsx', '.ts': 'ts', '.mts': 'ts', '.cts': 'ts' }
const CANDIDATES = ['.js', '.mjs', '.ts', '.tsx', '.jsx', '/index.js', '/index.ts', '/index.tsx']

/** vite 注入的 import.meta.env 在测试里替换成这个全局（setup.mjs 负责赋值） */
export const VITE_ENV_GLOBAL = '__TEST_VITE_ENV__'

/**
 * 补全省略扩展名的相对导入。
 * 只处理相对路径：裸包名交回 node 走正常的 node_modules 解析 ——
 * 在这里瞎猜会把包的 exports 字段绕过去。
 */
export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('.') || !context.parentURL) return nextResolve(specifier, context)
  try {
    return nextResolve(specifier, context)
  } catch (err) {
    if (!err || err.code !== 'ERR_MODULE_NOT_FOUND') throw err
    const base = fileURLToPath(new URL(specifier, context.parentURL))
    // 已经是目录时只试 index.*，免得 foo/ 被拼成 foo.js
    const isDir = existsSync(base) && statSync(base).isDirectory()
    for (const ext of CANDIDATES) {
      if (isDir && !ext.startsWith('/index')) continue
      const candidate = base + ext
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, format: 'module', shortCircuit: true }
      }
    }
    throw err
  }
}

// 同步钩子（module.registerHooks），所以用 transformSync。
export function load(url, context, nextLoad) {
  const ext = Object.keys(LOADERS).find(e => url.endsWith(e))
  // 本项目自己的 .js 也要过一遍，只为把 import.meta.env 替换掉；
  // node_modules 里的 .js 原样放行，没必要为它们付转换开销。
  const isOwnJs = url.endsWith('.js') && url.includes('/src/') && !url.includes('/node_modules/')
  if (!ext && !isOwnJs) return nextLoad(url, context)

  const source = readFileSync(fileURLToPath(url), 'utf8')
  if (isOwnJs && !source.includes('import.meta.env')) return nextLoad(url, context)

  const { code } = transformSync(source, {
    loader: ext ? LOADERS[ext] : 'js',
    format: 'esm',
    target: 'node20',
    jsx: 'automatic',
    sourcefile: url,
    // 指向一个全局空对象，于是 `import.meta.env.VITE_API_BASE` 得到 undefined
    // 而不是抛异常 —— 组件因此走「用默认值/相对路径」那条分支，
    // 正是生产同源部署时的真实行为。
    define: { 'import.meta.env': VITE_ENV_GLOBAL },
  })
  return { format: 'module', shortCircuit: true, source: code }
}
