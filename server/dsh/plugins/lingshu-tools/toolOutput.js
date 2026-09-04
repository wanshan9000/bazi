// 所有排盘类工具共用的输出定义：结果是纯文本，直接渲染为一段 text。
export function textOutput() {
  return { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }
}
