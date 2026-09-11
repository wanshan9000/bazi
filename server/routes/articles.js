// 文库文章 API。公开端只读已发布内容；草稿、发布和删除统一交给管理员令牌保护。
import { Router } from 'express'
import crypto from 'crypto'
import { deleteArticle, findArticle, listArticles, upsertArticle } from '../store.js'
import { requireAdmin } from '../adminAuth.js'
import { ARTICLES as LEGACY_ARTICLES, CATEGORIES } from '../../src/data/articles.js'

const router = Router()
const CATEGORY_KEYS = new Set(CATEGORIES.map(category => category.key).filter(key => key !== 'all'))
const STATUS = new Set(['draft', 'published'])
const ID_RE = /^[a-z][a-z0-9-]{1,80}$/

function parseBody(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const sections = []
  let current = { h: '正文', p: [] }
  text.split('\n').forEach(line => {
    const value = line.trim()
    const heading = value.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      if (current.p.length) sections.push(current)
      current = { h: heading[1].trim().slice(0, 80) || '正文', p: [] }
    } else if (value) {
      current.p.push(value.slice(0, 2000))
    }
  })
  if (current.p.length) sections.push(current)
  return sections
}

function bodyFromContent(content) {
  return (content || []).flatMap(section => [`## ${section.h}`, ...(section.p || []), '']).join('\n').trim()
}

// 首次访问时把原先写死在前端的文章转入持久化存储。已有记录绝不覆盖：
// 管理员的编辑、隐藏和删除标记都会被原样保留。
function ensureLegacyArticles() {
  const migratedAt = Date.now()
  LEGACY_ARTICLES.forEach((article, index) => {
    const existing = findArticle(article.id)
    // 早期迁移版本把时间戳设为 0；仅修正这一明确的迁移占位值，绝不覆盖后台编辑。
    if (existing) {
      if (existing.source === 'builtin' && existing.updatedAt === 0) {
        const timestamp = migratedAt - index
        upsertArticle({
          ...existing,
          updatedAt: timestamp,
          publishedAt: existing.status === 'published' && !existing.publishedAt ? timestamp : existing.publishedAt,
        })
      }
      return
    }
    const body = bodyFromContent(article.content)
    const timestamp = migratedAt - index
    upsertArticle({
      ...article,
      body,
      content: article.content,
      source: 'builtin',
      status: 'published',
      updatedAt: timestamp,
      publishedAt: timestamp,
    })
  })
}

function articleSummary(article) {
  const { body, content, ...summary } = article
  return summary
}

function publicArticle(article) {
  const { status, source, createdAt, updatedAt, publishedAt, ...publicData } = article
  return publicData
}

function validateArticle(raw, { id, existing } = {}) {
  const errors = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['文章数据无效'] }
  const title = String(raw.title || '').trim().slice(0, 100)
  const cat = String(raw.cat || '').trim()
  const emoji = String(raw.emoji || '📜').trim().slice(0, 12)
  const digest = String(raw.digest || '').trim().slice(0, 500)
  const read = Number(raw.read)
  const body = String(raw.body || '').replace(/\r\n/g, '\n').trim()
  const status = STATUS.has(raw.status) ? raw.status : (existing?.status || 'draft')

  if (!title) errors.push('请填写文章标题')
  if (!CATEGORY_KEYS.has(cat)) errors.push('请选择有效分类')
  if (!digest) errors.push('请填写摘要')
  if (!Number.isInteger(read) || read < 1 || read > 180) errors.push('阅读时长需为 1 到 180 分钟')
  if (!body) errors.push('请填写正文')
  if (body.length > 20000) errors.push('正文最多 20000 字')

  const content = parseBody(body)
  if (!content.length) errors.push('正文至少需要一段内容')
  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    article: {
      id: id || `article-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`,
      title,
      cat,
      emoji,
      digest,
      read,
      body,
      content,
      status,
      views: existing?.views || 0,
      createdAt: existing?.createdAt,
      updatedAt: Date.now(),
      publishedAt: status === 'published' ? (existing?.publishedAt || Date.now()) : null,
    },
  }
}

// ---- 公开文库：仅返回已发布文章 ----
router.get('/articles', (_req, res) => {
  ensureLegacyArticles()
  res.json({ ok: true, data: listArticles({ publishedOnly: true }).map(article => articleSummary(publicArticle(article))) })
})

router.get('/articles/:id', (req, res) => {
  ensureLegacyArticles()
  const article = findArticle(req.params.id)
  if (!article || article.status !== 'published') return res.status(404).json({ ok: false, msg: '文章不存在或尚未发布' })
  res.json({ ok: true, data: publicArticle(article) })
})

// ---- 管理端：完整内容和全部状态都需要管理员令牌 ----
router.get('/admin/articles', requireAdmin, (_req, res) => {
  ensureLegacyArticles()
  res.json({ ok: true, data: listArticles().map(articleSummary) })
})

router.get('/admin/articles/:id', requireAdmin, (req, res) => {
  ensureLegacyArticles()
  const article = findArticle(req.params.id)
  if (!article) return res.status(404).json({ ok: false, msg: '文章不存在' })
  res.json({ ok: true, data: article })
})

router.post('/admin/articles', requireAdmin, (req, res) => {
  const result = validateArticle(req.body)
  if (!result.ok) return res.status(400).json({ ok: false, msg: '校验失败', errors: result.errors })
  const saved = upsertArticle(result.article)
  res.status(201).json({ ok: true, msg: '草稿已保存', data: saved })
})

router.put('/admin/articles/:id', requireAdmin, (req, res) => {
  ensureLegacyArticles()
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ ok: false, msg: '文章标识无效' })
  const existing = findArticle(req.params.id)
  if (!existing) return res.status(404).json({ ok: false, msg: '文章不存在' })
  const result = validateArticle(req.body, { id: existing.id, existing })
  if (!result.ok) return res.status(400).json({ ok: false, msg: '校验失败', errors: result.errors })
  const saved = upsertArticle(result.article)
  res.json({ ok: true, msg: saved.status === 'published' ? '文章已更新并发布' : '草稿已更新', data: saved })
})

router.patch('/admin/articles/:id', requireAdmin, (req, res) => {
  ensureLegacyArticles()
  const existing = findArticle(req.params.id)
  if (!existing) return res.status(404).json({ ok: false, msg: '文章不存在' })
  if (!STATUS.has(req.body?.status)) return res.status(400).json({ ok: false, msg: '状态仅支持 draft 或 published' })
  const status = req.body.status
  const saved = upsertArticle({
    ...existing,
    status,
    updatedAt: Date.now(),
    publishedAt: status === 'published' ? (existing.publishedAt || Date.now()) : null,
  })
  res.json({ ok: true, msg: status === 'published' ? '已发布到文库' : '已从文库隐藏', data: articleSummary(saved) })
})

router.delete('/admin/articles/:id', requireAdmin, (req, res) => {
  ensureLegacyArticles()
  const existing = findArticle(req.params.id)
  if (!existing) return res.status(404).json({ ok: false, msg: '文章不存在' })
  // 内置文章保留删除标记，避免下次迁移检查时被重新导入。
  const ok = existing.source === 'builtin'
    ? Boolean(upsertArticle({ ...existing, status: 'deleted', updatedAt: Date.now() }))
    : deleteArticle(req.params.id)
  if (!ok) return res.status(404).json({ ok: false, msg: '文章不存在' })
  res.json({ ok: true, msg: '文章已删除' })
})

export { bodyFromContent }
export default router
