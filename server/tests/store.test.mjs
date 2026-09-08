// 存储层回归测试：原子写、损坏不静默清库、分享 TTL、验证码尝试次数。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'))
const file = path.join(dir, 'db.json')

const { config } = await import('../config.js')
config.storeFile = file
const store = await import('../store.js')

test('验证码：错误尝试有次数上限', () => {
  const phone = '13800000001'
  store.createVerify(phone, '123456')
  for (let i = 0; i < 5; i++) {
    const r = store.verifyCode(phone, '000000')
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'MISMATCH')
  }
  const blocked = store.verifyCode(phone, '000000')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'TOO_MANY_ATTEMPTS')
  // 作废之后，即便给出正确的码也不再接受，必须重新发送
  assert.equal(store.verifyCode(phone, '123456').reason, 'NO_CODE')
})

test('验证码：正确的码一次性通过', () => {
  const phone = '13800000002'
  store.createVerify(phone, '654321')
  assert.equal(store.verifyCode(phone, '654321').ok, true)
  assert.equal(store.verifyCode(phone, '654321').ok, false, '用过即失效')
})

test('分享：写入后可读，落盘无残留临时文件', () => {
  const id = store.saveShare({ payload: JSON.stringify({ hello: 'world' }) })
  assert.ok(id)
  assert.ok(store.getShare(id))
  const leftovers = fs.readdirSync(dir).filter(f => f.includes('.tmp-'))
  assert.deepEqual(leftovers, [], `残留临时文件：${leftovers.join(', ')}`)
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')))
})

test('分享：读取时校验有效期，不是等到下次有人新建分享才清理', () => {
  // 用独立进程跑：store.js 有模块级缓存，本进程里改不了文件再重新加载
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'store-ttl-'))
  const f = path.join(d, 'db.json')
  const stale = Date.now() - 999 * 24 * 3600 * 1000
  fs.writeFileSync(f, JSON.stringify({
    subscribers: [], verifies: [], adminSkills: [],
    shares: [{ id: 'abc123', payload: '{"x":1}', createdAt: stale }],
  }))
  const out = execFileSync(process.execPath, ['-e', `
    const { config } = await import('${path.resolve('server/config.js')}')
    config.storeFile = ${JSON.stringify(f)}
    const s = await import('${path.resolve('server/store.js')}')
    console.log(JSON.stringify({ share: s.getShare('abc123') }))
  `.trim()], { input: '', encoding: 'utf8', env: { ...process.env } })
  const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop()
  assert.equal(JSON.parse(line).share, null, '过期分享必须立刻读不到')
})

test('数据文件损坏时另存备份，而不是静默清库后覆盖', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'store-bad-'))
  const f = path.join(d, 'db.json')
  fs.writeFileSync(f, '{ 这不是合法 JSON')
  execFileSync(process.execPath, ['-e', `
    const { config } = await import('${path.resolve('server/config.js')}')
    config.storeFile = ${JSON.stringify(f)}
    const s = await import('${path.resolve('server/store.js')}')
    s.listSubscribers()
  `.trim()], { encoding: 'utf8', env: { ...process.env } })
  const backups = fs.readdirSync(d).filter(x => x.includes('.corrupt-'))
  assert.equal(backups.length, 1, '损坏的原文件必须被另存，否则数据无法人工找回')
  assert.equal(fs.readFileSync(path.join(d, backups[0]), 'utf8'), '{ 这不是合法 JSON')
})

test('文库文章：草稿与已发布内容分别持久化和筛选', () => {
  const published = store.upsertArticle({
    id: 'article-store-published', title: '已发布文章', cat: 'intro', emoji: '📜',
    digest: '公开文章', read: 3, body: '正文', content: [{ h: '正文', p: ['正文'] }],
    status: 'published', updatedAt: Date.now(), publishedAt: Date.now(), views: 0,
  })
  store.upsertArticle({
    id: 'article-store-draft', title: '草稿文章', cat: 'intro', emoji: '📜',
    digest: '未公开文章', read: 3, body: '正文', content: [{ h: '正文', p: ['正文'] }],
    status: 'draft', updatedAt: Date.now(), publishedAt: null, views: 0,
  })
  assert.equal(store.findArticle(published.id).title, '已发布文章')
  assert.deepEqual(store.listArticles({ publishedOnly: true }).map(a => a.id), ['article-store-published'])
  store.upsertArticle({
    id: 'article-store-deleted', title: '已删除文章', cat: 'intro', emoji: '📜',
    digest: '删除标记', read: 3, body: '正文', content: [{ h: '正文', p: ['正文'] }],
    status: 'deleted', updatedAt: Date.now(), publishedAt: null, views: 0,
  })
  assert.equal(store.listArticles().some(a => a.id === 'article-store-deleted'), false, '删除标记不能出现在后台列表')
  assert.ok(store.findArticle('article-store-deleted'), '保留删除标记，避免内置内容被迁移回流')
  assert.equal(store.deleteArticle('article-store-draft'), true)
})
