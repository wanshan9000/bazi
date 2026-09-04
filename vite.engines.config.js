// 命理引擎 → Node bundle（供 dsh 插件使用）。ssr 模式：不做浏览器 polyfill、保留 node 内置模块。
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'server/dsh/plugins/lingshu-tools/dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve('server/dsh/plugins/lingshu-tools/engines.entry.js'),
      output: { format: 'es', entryFileNames: 'engines.mjs' },
    },
  },
  ssr: {
    // 把所有依赖一起打进去（含发 .ts 源码的 bigfishmarquis-qimen），产物零外部依赖
    noExternal: true,
  },
})
