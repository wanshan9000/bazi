// dsh 插件：把灵枢命理引擎注册为模型可调用的工具
export const name = 'lingshu-tools'
export const inject = ['tools']

export function apply(ctx) {
  // Task 3 起在此逐个 ctx.tools.register(...)
  console.error('[lingshu-tools] 已挂载')
}
