// 测试环境引导：注册 JSX 加载钩子 + 装一个 jsdom 当浏览器。
//
// 由 package.json 的 test 脚本以 --import 方式加载，对所有测试文件生效。
// 纯逻辑测试不用它也能跑（多装一个 DOM 不影响），组件测试则必须有。
import { registerHooks } from 'node:module'
import { JSDOM } from 'jsdom'
import { load, resolve, VITE_ENV_GLOBAL } from './jsx-hooks.mjs'

// vite 注入的 import.meta.env 会被钩子替换成这个全局。必须在注册钩子**之前**
// 建好，否则先被加载的模块读到的是 undefined。
Object.defineProperty(globalThis, VITE_ENV_GLOBAL, {
  configurable: true, writable: true,
  value: { MODE: 'test', DEV: false, PROD: false },
})

// registerHooks 是同步的进程内钩子（register 已废弃）。
// 同步意味着不能用 esbuild 的异步 transform，jsx-hooks 里用的是 transformSync。
registerHooks({ load, resolve })

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

// 只补 React / 组件代码真正会碰到的那些全局，不做整套 window 的复制 ——
// 复制太多反而会盖掉 node 自己的实现（比如 fetch），让测试测的不是真实行为。
const w = dom.window

// 新版 Node 自带了只读的 navigator / localStorage 等，直接赋值会抛
// 「only a getter」。统一走 defineProperty。
function define(name, value) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

for (const [name, value] of [
  ['window', w],
  ['document', w.document],
  ['navigator', w.navigator],
  ['HTMLElement', w.HTMLElement],
  ['Element', w.Element],
  ['Node', w.Node],
  ['Event', w.Event],
  ['MouseEvent', w.MouseEvent],
  ['KeyboardEvent', w.KeyboardEvent],
  ['getComputedStyle', w.getComputedStyle],
  ['localStorage', w.localStorage],
  ['sessionStorage', w.sessionStorage],
  ['requestAnimationFrame', cb => setTimeout(() => cb(Date.now()), 0)],
  ['cancelAnimationFrame', id => clearTimeout(id)],
  ['matchMedia', w.matchMedia || (q => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false },
  }))],
]) define(name, value)
// jsdom 没有实现这几个，组件里到处在用；不打桩会在渲染时直接抛。
w.HTMLElement.prototype.scrollIntoView = function () {}
// canvas 的 2d 上下文 jsdom 不带（要另装 node-canvas）。给一个只记不画的假上下文，
// 让用 canvas 的组件能跑完 effect —— 目的是验证它不崩，不是验证它画得对。
const CANVAS_NOOP = new Proxy({}, {
  get: (_t, k) => (k === 'canvas' ? null : (k === 'measureText' ? () => ({ width: 0 }) : (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}))),
  set: () => true,
})
w.HTMLCanvasElement.prototype.getContext = function () { return CANVAS_NOOP }
define('scrollTo', () => {})
w.scrollTo = () => {}

// React 18 的 act() 要靠它判断当前是不是测试环境，不设会刷一屏警告
define('IS_REACT_ACT_ENVIRONMENT', true)
