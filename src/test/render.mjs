// 组件测试的最小渲染助手。
//
// 不引 @testing-library —— 需要的其实只有「挂载、点、读文本、卸载」四件事，
// 自己写二十行反而更好懂，也少一个依赖。
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'

/** 挂载一个组件，返回容器与若干查询/交互方法。用完记得 unmount()。 */
export function render(Component, props = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(createElement(Component, props)) })

  // portal（Modal 用得多）会把内容渲染到 document.body 而不是容器里。
  // 只查 container 的话会「找不到确认按钮」，那不是组件的问题而是断言够不着。
  // 这里把容器和 body 上的 portal 根一起当查询范围。
  const roots = () => {
    const out = [container]
    for (const el of document.body.children) {
      if (el !== container && !el.contains(container)) out.push(el)
    }
    return out
  }

  const api = {
    container,
    /** 整棵子树的可见文本（去掉多余空白，便于直接 includes 判断） */
    text: () => roots().map(r => r.textContent).join(' ').replace(/\s+/g, ' ').trim(),
    html: () => roots().map(r => r.innerHTML).join(''),
    $: sel => { for (const r of roots()) { const el = r.querySelector(sel); if (el) return el } return null },
    $$: sel => roots().flatMap(r => Array.from(r.querySelectorAll(sel))),
    /** 按可见文本找按钮 —— 比记 class 名稳，改样式不会把测试带崩 */
    findByText: (text, sel = 'button, a, .btn') =>
      api.$$(sel).find(el => (el.textContent || '').includes(text)) || null,
    click: el => { act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }) },
    /** 受控 input：直接改 value 不会触发 React 的 onChange，得走原生 setter */
    type: (el, value) => {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      act(() => { el.dispatchEvent(new window.Event('input', { bubbles: true })) })
    },
    select: (el, value) => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, value)
      act(() => { el.dispatchEvent(new window.Event('change', { bubbles: true })) })
    },
    rerender: newProps => { act(() => { root.render(createElement(Component, { ...props, ...newProps })) }) },
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
  return api
}

/** 等待异步 effect（接口调用等）落定后再断言 */
export async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  }
}
