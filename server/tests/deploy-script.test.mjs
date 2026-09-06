// 部署脚本的静态检查。
//
// macOS 自带 bash 3.2 在解析 `$VAR（` 时，会把紧跟的全角标点当成变量名的一部分，
// 于是 `$BACKUP_DIR（…）` 变成读一个不存在的变量 —— 配合 `set -u` 直接中止。
// 这个坑已经复发过一次：第二次正好踩在 rollback() 里，导致真需要回滚时
// 回滚函数自己先崩了。用测试钉住，比靠记性可靠。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const script = path.join(root, 'deploy', 'deploy.sh')

test('deploy.sh 语法合法', () => {
  execFileSync('bash', ['-n', script])
})

test('deploy.sh 里紧挨全角标点的变量必须加花括号', () => {
  const src = fs.readFileSync(script, 'utf-8')
  const bad = []
  src.split('\n').forEach((line, i) => {
    // $VAR 后面直接跟全角标点（没有 {}）
    const m = line.match(/\$[A-Za-z_][A-Za-z0-9_]*[（）「」，。：；、【】《》！？]/g)
    if (m) bad.push(`第 ${i + 1} 行：${m.join(' / ')}`)
  })
  assert.deepEqual(bad, [], `bash 3.2 会把全角标点算进变量名，需写成 \${VAR}：\n${bad.join('\n')}`)
})

// 回滚是「新版本起不来」时唯一的退路，它自己必须先能跑通。
test('rollback 在 bash 3.2 语义下可执行，且不碰运行时数据', () => {
  const src = fs.readFileSync(script, 'utf-8')
  const fn = src.slice(src.indexOf('rollback() {'), src.indexOf('die_rollback()'))
  assert.ok(fn.includes('rsync'), '没找到 rollback 的实现')

  // 把函数体单独拎出来在 set -u 下跑一遍（remote 打桩成 echo），
  // 变量没定义/被标点吃掉都会在这里暴露。
  const harness = `
set -euo pipefail
BACKUP_DIR=/tmp/does-not-exist-backup
APP_DIR=/tmp/does-not-exist-app
WEB_DIR=/tmp/does-not-exist-web
SERVICE=svc
SERVICE_USER=usr
KEEP=(--exclude=/server/data)
remote() { echo "REMOTE: $*"; }
${fn}
# rollback 的输出全部走 stderr（进度提示不该混进正常输出），这里合并过来好断言
rollback 2>&1
`
  const out = execFileSync('bash', ['-c', harness], { encoding: 'utf-8' })
  assert.ok(out.includes('REMOTE:'), `rollback 没有真正发出远端命令：${out}`)
  // 运行时数据目录必须在排除项里，否则一次回滚会把用户新注册的账号覆盖成旧的
  assert.match(out, /--exclude=\/server\/data/, '回滚必须排除 server/data')
})
