import { useState, useEffect, useMemo, useRef } from 'react'
import { SHENGXIAO } from '../data/ganzhi.js'
import AgentSettings from './AgentSettings.jsx'
import { loadConfig, saveConfig } from '../engine/llm.js'
import { api } from '../api/client.js'
import { loadAdminSkills, saveAdminSkills } from '../data/skills.js'

const ADMIN_AUTH_KEY = 'sanmen-admin-auth'
const HISTORY_KEY = 'sanmen-history'
const TAROT_KEY = 'sanmen-tarot-history'

function loadCharts() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadTarot() {
  try {
    const raw = localStorage.getItem(TAROT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const fmtDate = (ts) => {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const wxColors = {
  '金': '#f0dfae', '木': '#6ec7b2', '水': '#7fb0e0', '火': '#ff9d7e', '土': '#e8c96a'
}

export default function AdminPage({ onBack }) {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1' } catch { return false }
  })
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr] = useState('')
  const [charts, setCharts] = useState([])
  const [tarots, setTarots] = useState([])
  const [tab, setTab] = useState('charts') // charts | tarot | agent | skills
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [agentCfg, setAgentCfg] = useState(null)

  // ---- 技能管理 ----
  const [skills, setSkills] = useState([])
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('sanmen-admin-token') || '')
  const [skillMsg, setSkillMsg] = useState('')
  const [skillMsgType, setSkillMsgType] = useState('ok') // ok | err
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [skDetail, setSkDetail] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (authed) {
      setCharts(loadCharts())
      setTarots(loadTarot())
      setAgentCfg(loadConfig())
      refreshSkills()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!pwd.trim()) { setErr('请输入管理口令'); return }
    setErr('')
    try {
      const r = await api.adminAuth(pwd)
      if (r && r.ok && r.token) {
        try {
          sessionStorage.setItem(ADMIN_AUTH_KEY, '1')
          sessionStorage.setItem('sanmen-admin-token', r.token)
        } catch {}
        setAdminToken(r.token)
        setAuthed(true)
      } else {
        setErr((r && r.msg) || '口令校验失败')
      }
    } catch (e) {
      // 后端拒绝（如口令错误）时 e.message 即后端返回的 msg；网络异常时给出提示
      setErr(e && e.message && e.message !== 'Failed to fetch'
        ? e.message
        : '无法连接后端（请确认服务已启动并设置 ADMIN_PASSWORD）')
    }
  }

  const logout = () => {
    try {
      sessionStorage.removeItem(ADMIN_AUTH_KEY)
      sessionStorage.removeItem('sanmen-admin-token')
    } catch {}
    setAuthed(false)
    setPwd('')
    setAdminToken('')
  }

  // ================= 技能管理逻辑 =================
  const flash = (msg, type = 'ok') => {
    setSkillMsg(msg)
    setSkillMsgType(type)
    if (window._skMsgTimer) clearTimeout(window._skMsgTimer)
    window._skMsgTimer = setTimeout(() => setSkillMsg(''), 4000)
  }

  // 拉取后端技能，并同步本地缓存（前端 Agent 立即可用）
  const refreshSkills = async () => {
    try {
      const r = await api.adminSkills()
      const list = (r && Array.isArray(r.data)) ? r.data : []
      setSkills(list)
      saveAdminSkills(list)
    } catch {
      setSkills(loadAdminSkills())
    }
  }

  // 使用登录时后端下发的管理令牌（前端不再保存口令）
  const ensureAdminToken = async () => {
    if (adminToken) return adminToken
    flash('请先登录管理后台', 'err')
    return null
  }

  // 解析导入文本（JSON 数组或单个对象）
  const parseImport = (text) => {
    const t = (text || '').trim()
    if (!t) throw new Error('内容为空')
    const parsed = JSON.parse(t)
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  // 上传文件到输入框
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result || ''))
    reader.readAsText(file)
    e.target.value = ''
  }

  // 批量导入
  const handleImport = async () => {
    if (importBusy) return
    setImportBusy(true)
    try {
      let items = null
      let text = null
      if (importText.trim()) {
        items = parseImport(importText) // 先本地校验 JSON 格式
      } else {
        flash('请先选择文件或粘贴 JSON 内容', 'err')
        return
      }
      const token = await ensureAdminToken()
      if (!token) return
      const r = await api.importSkills({ items, text }, token)
      if (r && r.ok) {
        flash(`导入完成：成功 ${r.imported?.length || 0} 个，跳过 ${r.skipped?.length || 0} 个`)
        if (r.skipped?.length) {
          setSkillMsgType('err')
          setSkillMsg('导入完成：成功 ' + (r.imported?.length || 0) + ' 个，跳过 ' + (r.skipped?.length || 0) + ' 个（' + r.skipped.map(s => s.name + ':' + (s.errors || []).join(';')).join(' | ') + '）')
        }
        setImportText('')
        await refreshSkills()
      } else {
        flash(r?.msg || '导入失败', 'err')
      }
    } catch (e) {
      flash(e.message || '导入失败：请检查 JSON 格式', 'err')
    } finally {
      setImportBusy(false)
    }
  }

  // 新建/编辑单个技能（用于新增一个空技能后保存）
  const handleSaveSkill = async (skill) => {
    try {
      const token = await ensureAdminToken()
      if (!token) return
      const r = await api.saveSkill(skill, token)
      if (r && r.ok) {
        flash('已保存「' + (r.data?.name || skill.name) + '」')
        setSkDetail(null)
        await refreshSkills()
      } else {
        flash(r?.msg || '保存失败', 'err')
      }
    } catch (e) {
      flash(e.message || '保存失败', 'err')
    }
  }

  // 启用 / 停用
  const toggleSkillEnabled = async (s) => {
    try {
      const token = await ensureAdminToken()
      if (!token) return
      const r = await api.updateSkill(s.key, { enabled: !s.enabled }, token)
      if (r && r.ok) {
        flash('已' + (!s.enabled ? '启用' : '停用') + '「' + s.name + '」')
        await refreshSkills()
      } else {
        flash(r?.msg || '操作失败', 'err')
      }
    } catch (e) {
      flash(e.message || '操作失败', 'err')
    }
  }

  // 删除
  const handleDeleteSkill = async (s) => {
    if (!confirm(`确认删除技能「${s.name}」（${s.key}）？此操作不可恢复。`)) return
    try {
      const token = await ensureAdminToken()
      if (!token) return
      const r = await api.deleteSkill(s.key, token)
      if (r && r.ok) {
        flash('已删除「' + s.name + '」')
        setSkDetail(null)
        await refreshSkills()
      } else {
        flash(r?.msg || '删除失败', 'err')
      }
    } catch (e) {
      flash(e.message || '删除失败', 'err')
    }
  }

  // 下载 JSON 模板
  const exportTemplate = async () => {
    try {
      const r = await api.skillTemplate()
      const tpl = (r && r.template) || [{}]
      const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'skill-template.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      flash('模板下载失败', 'err')
    }
  }

  // 新建空技能，进入编辑
  const startNewSkill = () => {
    setSkDetail({
      key: '', name: '', icon: '🧩', desc: '', keywords: '', tool: '', cap: '', sys: '', enabled: true, _new: true,
    })
  }

  // 保存编辑器内容
  const saveDetail = async () => {
    if (!skDetail) return
    const d = skDetail
    if (!d.key.trim()) { flash('key 不能为空', 'err'); return }
    if (!d.name.trim()) { flash('name 不能为空', 'err'); return }
    const kw = (d.keywords || '')
      .split(/[,，、\n]/).map(k => k.trim()).filter(Boolean)
    if (!kw.length) { flash('keywords 至少一个', 'err'); return }
    const payload = {
      key: d.key.trim(),
      name: d.name.trim(),
      icon: d.icon || '🧩',
      desc: d.desc || '',
      cap: d.cap || '',
      sys: d.sys || '',
      keywords: kw,
      tool: (d.tool || '').trim() || undefined,
      enabled: d.enabled !== false,
    }
    await handleSaveSkill(payload)
  }

  const deleteChart = (id) => {
    if (!confirm('确认删除该条命盘记录？')) return
    const next = charts.filter(c => c.id !== id)
    setCharts(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
    if (selected?.id === id) setSelected(null)
  }

  const deleteTarot = (id) => {
    if (!confirm('确认删除该条塔罗记录？')) return
    const next = tarots.filter(c => c.id !== id)
    setTarots(next)
    try { localStorage.setItem(TAROT_KEY, JSON.stringify(next)) } catch {}
  }

  const clearAll = () => {
    if (!confirm(`确认清空全部${tab === 'charts' ? '命盘' : '塔罗'}记录？此操作不可恢复。`)) return
    if (tab === 'charts') {
      setCharts([])
      try { localStorage.removeItem(HISTORY_KEY) } catch {}
    } else {
      setTarots([])
      try { localStorage.removeItem(TAROT_KEY) } catch {}
    }
    setSelected(null)
  }

  const exportData = () => {
    const data = tab === 'charts' ? charts : tarots
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sanmen-${tab}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (tab === 'charts') {
      return charts.filter(c => {
        if (!kw) return true
        return `${c.year}${c.month}${c.day}${c.gender}${c.name || ''}`.toLowerCase().includes(kw)
      })
    }
    return tarots.filter(c => {
      if (!kw) return true
      return (c.question || '').toLowerCase().includes(kw) || (c.spreadName || '').toLowerCase().includes(kw)
    })
  }, [charts, tarots, tab, search])

  // 统计
  const stats = useMemo(() => {
    const wxCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }
    let male = 0, female = 0
    charts.forEach(c => {
      if (c.gender === '男') male++; else female++
      const wx = c.dayMasterWx
      if (wx && wxCount[wx] !== undefined) wxCount[wx]++
    })
    return { total: charts.length, male, female, wxCount }
  }, [charts])

  // 登录页
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="alc-deco">三</div>
          <h2 className="alc-title">管理控制台</h2>
          <p className="alc-sub">三门命理 · Admin Console</p>
          <form onSubmit={handleLogin} className="alc-form">
            <div className="alc-pwd">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="请输入管理口令"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className={`alc-eye${showPwd ? ' on' : ''}`}
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? '隐藏口令' : '显示口令'}
                title={showPwd ? '隐藏口令' : '显示口令'}
              >
                {showPwd ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {err && <div className="alc-err">{err}</div>}
            <button type="submit" className="alc-btn">登 入</button>
          </form>
          <button className="alc-back" onClick={onBack}>← 返回首页</button>
          <p className="alc-tip">仅管理员可访问 · 会话内有效</p>
        </div>
      </div>
    )
  }

  // 管理后台
  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div>
          <p className="ah-deco">Sanmen · Admin Console</p>
          <h1 className="ah-title">管理控制台</h1>
        </div>
        <div className="ah-actions">
          {tab !== 'agent' && tab !== 'skills' && (
            <>
              <button className="ah-btn ghost" onClick={exportData}>导出 {tab === 'charts' ? '命盘' : '塔罗'} JSON</button>
              <button className="ah-btn ghost warn" onClick={clearAll}>清空 {tab === 'charts' ? '命盘' : '塔罗'}</button>
            </>
          )}
          <button className="ah-btn ghost" onClick={logout}>退出</button>
          <button className="ah-btn" onClick={onBack}>回到首页</button>
        </div>
      </div>

      {/* 概览统计 */}
      <div className="admin-stats">
        <div className="as-card">
          <div className="as-num">{stats.total}</div>
          <div className="as-label">命盘总数</div>
        </div>
        <div className="as-card">
          <div className="as-num">{stats.male} / {stats.female}</div>
          <div className="as-label">乾造 / 坤造</div>
        </div>
        <div className="as-card">
          <div className="as-wx">
            {Object.entries(stats.wxCount).map(([wx, n]) => (
              <span key={wx} className="wx-pill" style={{ background: wxColors[wx] + '22', color: wxColors[wx], borderColor: wxColors[wx] + '55' }}>
                <b>{wx}</b> {n}
              </span>
            ))}
          </div>
          <div className="as-label">五行分布（依日主）</div>
        </div>
        <div className="as-card">
          <div className="as-num">{tarots.length}</div>
          <div className="as-label">塔罗占卜</div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="admin-tabs">
        <button
          className={`atab ${tab === 'charts' ? 'on' : ''}`}
          onClick={() => { setTab('charts'); setSelected(null); }}
        >
          命盘档案 ({charts.length})
        </button>
        <button
          className={`atab ${tab === 'tarot' ? 'on' : ''}`}
          onClick={() => { setTab('tarot'); setSelected(null); }}
        >
          塔罗记录 ({tarots.length})
        </button>
        <button
          className={`atab ${tab === 'agent' ? 'on' : ''}`}
          onClick={() => { setTab('agent'); setSelected(null); }}
        >
          元气AI设置
        </button>
        <button
          className={`atab ${tab === 'skills' ? 'on' : ''}`}
          onClick={() => { setTab('skills'); setSelected(null); setSkDetail(null); }}
        >
          技能管理 ({skills.length})
        </button>
      </div>

      {/* 搜索 */}
      {tab !== 'agent' && tab !== 'skills' && (
        <div className="admin-tools">
          <input
            type="text"
            className="at-input"
            placeholder={tab === 'charts' ? '搜索：年/月/日/性别/姓名' : '搜索：问题/牌阵'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="at-count">匹配 {filtered.length} 条</span>
        </div>
      )}

      {/* 命盘列表 */}
      {tab === 'charts' && (
        <div className="admin-grid">
          {filtered.length === 0 ? (
            <div className="admin-empty">暂无命盘记录</div>
          ) : filtered.map(c => {
            const sxIndex = ((c.year - 4) % 12 + 12) % 12
            const sx = SHENGXIAO[sxIndex]
            const dm = c.pillars?.[2]
            const dmWx = c.dayMasterWx
            const wxColor = wxColors[dmWx] || '#ff7ea8'
            return (
              <div key={c.id} className={`ad-row ${selected?.id === c.id ? 'on' : ''}`}>
                <div className="adr-zodiac" style={{ color: wxColor }}>{sx}</div>
                <div className="adr-main">
                  <div className="adr-line1">
                    <span className="adr-date">{c.year}年{c.month}月{c.day}日 · {c.hour ?? '?'}时</span>
                    <span className="adr-tag">{c.gender === '男' ? '乾造' : '坤造'}</span>
                  </div>
                  <div className="adr-line2">
                    {dm && <span className="adr-tag gold" style={{ background: wxColor + '15', borderColor: wxColor + '55', color: wxColor }}>{dm.gan}{dm.zhi}日主 · {dmWx}</span>}
                    <span className="adr-tag">{sx}肖</span>
                    {c.name && <span className="adr-tag">{c.name}</span>}
                  </div>
                </div>
                <div className="adr-time">{fmtDate(c.id)}</div>
                <div className="adr-actions">
                  <button className="adr-btn" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                    {selected?.id === c.id ? '收起' : '查看'}
                  </button>
                  <button className="adr-btn warn" onClick={() => deleteChart(c.id)}>删除</button>
                </div>
                {selected?.id === c.id && (
                  <div className="adr-detail">
                    <div className="add-block">
                      <div className="add-label">四柱</div>
                      <div className="add-pillars">
                        {c.pillars?.map((p, i) => (
                          <div key={i} className="add-pillar">
                            <div className="adp-pos">{['年柱', '月柱', '日柱', '时柱'][i]}</div>
                            <div className="adp-chars">
                              <span>{p.gan}</span>
                              <span>{p.zhi}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {c.dayMaster && (
                      <div className="add-block">
                        <div className="add-label">日主</div>
                        <div className="add-text">{c.dayMaster} ({c.dayMasterWx})</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 塔罗列表 */}
      {tab === 'tarot' && (
        <div className="admin-grid">
          {filtered.length === 0 ? (
            <div className="admin-empty">暂无塔罗记录</div>
          ) : filtered.map(t => (
            <div key={t.id} className="ad-row tall">
              <div className="adr-zodiac" style={{ color: '#f2558c' }}>☥</div>
              <div className="adr-main">
                <div className="adr-line1">
                  <span className="adr-date">{t.spreadName || t.spreadId || '—'}</span>
                  <span className="adr-tag">{t.cards?.length || 0} 张</span>
                </div>
                <div className="adr-line2 q">
                  {(t.question || '(无问题)').slice(0, 80)}{(t.question?.length || 0) > 80 ? '...' : ''}
                </div>
              </div>
              <div className="adr-time">{fmtDate(t.id)}</div>
              <div className="adr-actions">
                <button className="adr-btn warn" onClick={() => deleteTarot(t.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 元气AI设置 */}
      {tab === 'agent' && (
        <div className="admin-agent">
          {agentCfg ? (
            <AgentSettings
              inline
              cfg={agentCfg}
              onSave={(cfg) => {
                saveConfig(cfg)
                setAgentCfg(cfg)
              }}
            />
          ) : (
            <div className="admin-empty">正在加载设置…</div>
          )}
        </div>
      )}

      {/* 技能管理 */}
      {tab === 'skills' && (
        <div className="admin-skills">
          {skillMsg && (
            <div className={`ask-msg ${skillMsgType === 'err' ? 'err' : ''}`}>{skillMsg}</div>
          )}

          {/* 导入区 */}
          <div className="ask-import">
            <div className="ask-import-head">
              <span className="ask-import-title">上传 / 导入技能</span>
              <div className="ask-import-tools">
                <button className="ask-btn ghost" onClick={exportTemplate}>下载模板</button>
                <button className="ask-btn ghost" onClick={() => fileRef.current && fileRef.current.click()}>选择 JSON 文件</button>
                <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileUpload} />
                <button className="ask-btn ghost" onClick={() => setImportText(JSON.stringify([{
                  key: 'example-skill', name: '示例技能', icon: '🧩',
                  desc: '一句话说明用途',
                  keywords: ['关键词1', '关键词2'],
                  tool: '', cap: '调用说明', sys: '人设指令', enabled: true,
                }], null, 2))}>填入示例</button>
              </div>
            </div>
            <textarea
              className="ask-textarea"
              rows={6}
              placeholder={'粘贴技能 JSON 或选择文件上传。格式：技能对象数组 [ { key, name, icon, desc, keywords[], tool, cap, sys, enabled } ] 或单个对象。\n\nkey 为唯一标识（字母/数字/中划线/下划线）；keywords 命中触发该技能；tool 可选（bazi/liuyao/tarot/huangli/ziwei/qimen/fengshui/name 等）；sys 为人设指令（仅管理员导入可注入，仍受灵魂边界保护）。'}
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />
            <div className="ask-import-foot">
              <span className="ask-import-note">导入后全站用户可在「元气AI设置 → 技能」中启用使用；管理员需先通过后端 ADMIN_PASSWORD 鉴权。</span>
              <button className="ask-btn primary" disabled={importBusy} onClick={handleImport}>
                {importBusy ? '导入中…' : '导入技能'}
              </button>
            </div>
          </div>

          {/* 已导入技能列表 */}
          <div className="ask-list-head">
            <span className="ask-list-title">已导入技能（{skills.length}）</span>
            <button className="ask-btn ghost" onClick={startNewSkill}>+ 新建技能</button>
          </div>

          {skills.length === 0 ? (
            <div className="admin-empty">暂无管理后台导入的技能</div>
          ) : (
            <div className="ask-list">
              {skills.map(s => (
                <div key={s.key} className={`ask-item ${s.enabled === false ? 'off' : ''}`}>
                  <div className="ask-item-ico">{s.icon || '🧩'}</div>
                  <div className="ask-item-main">
                    <div className="ask-item-name">
                      {s.name}
                      <span className="ask-item-key">{s.key}</span>
                      {s.tool && <span className="ask-item-tool">工具:{s.tool}</span>}
                      <span className={`ask-item-status ${s.enabled === false ? 'off' : 'on'}`}>
                        {s.enabled === false ? '已停用' : '已启用'}
                      </span>
                    </div>
                    <div className="ask-item-desc">{s.desc || '（无描述）'}</div>
                    <div className="ask-item-kws">
                      {(s.keywords || []).slice(0, 8).map(k => <span key={k} className="ask-item-kw">{k}</span>)}
                      {(s.keywords || []).length > 8 && <span className="ask-item-kw more">+{(s.keywords || []).length - 8}</span>}
                    </div>
                  </div>
                  <div className="ask-item-actions">
                    <button
                      className={`ask-switch ${s.enabled !== false ? 'on' : ''}`}
                      onClick={() => toggleSkillEnabled(s)}
                      title={s.enabled === false ? '启用' : '停用'}
                    >
                      <span className="ask-switch-knob" />
                    </button>
                    <button className="ask-btn ghost" onClick={() => setSkDetail({ ...s, keywords: (s.keywords || []).join('、') })}>编辑</button>
                    <button className="ask-btn ghost warn" onClick={() => handleDeleteSkill(s)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 新建 / 编辑详情 */}
          {skDetail && (
            <div className="ask-detail">
              <div className="ask-detail-head">
                <span className="ask-detail-title">{skDetail._new ? '新建技能' : '编辑技能 · ' + skDetail.key}</span>
                <button className="ask-btn ghost" onClick={() => setSkDetail(null)}>关闭</button>
              </div>
              <div className="ask-detail-grid">
                <label className="ask-field">
                  <span>key（唯一标识，创建后不可改）</span>
                  <input value={skDetail.key} disabled={!skDetail._new} onChange={e => setSkDetail({ ...skDetail, key: e.target.value })} placeholder="如 my-skill" />
                </label>
                <label className="ask-field">
                  <span>名称</span>
                  <input value={skDetail.name} onChange={e => setSkDetail({ ...skDetail, name: e.target.value })} placeholder="技能名称" />
                </label>
                <label className="ask-field">
                  <span>图标（emoji）</span>
                  <input value={skDetail.icon} onChange={e => setSkDetail({ ...skDetail, icon: e.target.value })} placeholder="🧩" />
                </label>
                <label className="ask-field">
                  <span>工具（可选）</span>
                  <input value={skDetail.tool || ''} onChange={e => setSkDetail({ ...skDetail, tool: e.target.value })} placeholder="bazi / liuyao / tarot / huangli / ziwei / qimen / fengshui / name 等" />
                </label>
                <label className="ask-field wide">
                  <span>描述（desc）</span>
                  <textarea rows={2} value={skDetail.desc} onChange={e => setSkDetail({ ...skDetail, desc: e.target.value })} placeholder="一句话说明用途" />
                </label>
                <label className="ask-field wide">
                  <span>关键词（keywords，用逗号/顿号/换行分隔）</span>
                  <textarea rows={2} value={skDetail.keywords || ''} onChange={e => setSkDetail({ ...skDetail, keywords: e.target.value })} placeholder="关键词1、关键词2、关键词3" />
                </label>
                <label className="ask-field wide">
                  <span>能力说明（cap）</span>
                  <textarea rows={3} value={skDetail.cap} onChange={e => setSkDetail({ ...skDetail, cap: e.target.value })} placeholder="技能调用说明：命中哪些场景时使用" />
                </label>
                <label className="ask-field wide">
                  <span>人设指令（sys，可选）</span>
                  <textarea rows={4} value={skDetail.sys} onChange={e => setSkDetail({ ...skDetail, sys: e.target.value })} placeholder="本技能的人设指令（仅管理员导入技能可注入，仍受灵魂边界保护，不得覆盖人格/行为规范）" />
                </label>
              </div>
              <div className="ask-detail-foot">
                <label className="ask-enable">
                  <input type="checkbox" checked={skDetail.enabled !== false} onChange={e => setSkDetail({ ...skDetail, enabled: e.target.checked })} />
                  启用此技能
                </label>
                <div>
                  <button className="ask-btn ghost" onClick={() => setSkDetail(null)}>取消</button>
                  <button className="ask-btn primary" onClick={saveDetail}>保存技能</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
