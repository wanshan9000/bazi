import { useState } from 'react'
import {
  PROVIDERS, providerDefaults, testLLM, saveConfig, createModelConnection,
  loadModelConnections, saveModelConnections, defaultModelConnection, configWithDefaultConnection,
} from '../engine/llm.js'
import { allSkills, loadCustomSkills, BUILTIN_SKILLS } from '../data/skills.js'
import { getEvolveStatus, runAutoEvolution, clearEvolveStore, clearSkillLogs } from '../engine/agentEvolve.js'

// 构建期常量：与 App.jsx 挑选聊天组件的判断保持一致
const IS_LEGACY_BACKEND = import.meta.env.VITE_AGENT_BACKEND === 'legacy'

export default function AgentSettings({ cfg, onSave, onClose, inline }) {
  const [form, setForm] = useState(cfg)
  const [tab, setTab] = useState('model')
  const [connections, setConnections] = useState(() => loadModelConnections(cfg))
  const [selectedConnectionId, setSelectedConnectionId] = useState(() => defaultModelConnection(connections)?.id || '')
  // 技能池 = 内置 + 管理后台导入（mount 时读本地缓存；切回本 tab 会重新 mount，故为最新）
  const [customSkills] = useState(() => loadCustomSkills())
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState(null) // { ok, ms, preview } | { ok:false, msg }
  const [evolve, setEvolve] = useState(() => getEvolveStatus())

  const selectedConnection = connections.find(connection => connection.id === selectedConnectionId) || null

  const updateConnection = (patch) => {
    if (!selectedConnection) return
    setConnections(prev => prev.map(connection => connection.id === selectedConnection.id ? { ...connection, ...patch } : connection))
  }

  const pickProvider = (key) => {
    const d = providerDefaults(key)
    if (!selectedConnection) return
    const oldPreset = PROVIDERS[selectedConnection.provider]?.name
    updateConnection({
      provider: key,
      name: selectedConnection.name === oldPreset ? PROVIDERS[key]?.name || '自定义模型' : selectedConnection.name,
      baseUrl: d.baseUrl,
      model: d.model,
    })
  }

  const addConnection = () => {
    const connection = createModelConnection('deepseek', { isDefault: connections.length === 0 })
    setConnections(prev => [...prev, connection])
    setSelectedConnectionId(connection.id)
    setTestRes(null)
  }

  const setDefaultConnection = (id) => {
    setConnections(prev => prev.map(connection => ({ ...connection, isDefault: connection.id === id, enabled: connection.id === id ? true : connection.enabled })))
    setSelectedConnectionId(id)
    setTestRes(null)
  }

  const toggleConnection = (id) => {
    setConnections(prev => {
      const next = prev.map(connection => connection.id === id ? { ...connection, enabled: !connection.enabled } : connection)
      // 停用当前默认项时，立即交给下一个可用项，避免列表显示的默认与实际运行项不一致。
      const changed = next.find(connection => connection.id === id)
      if (changed?.isDefault && !changed.enabled) {
        const fallback = next.find(connection => connection.enabled)
        if (fallback) return next.map(connection => ({ ...connection, isDefault: connection.id === fallback.id }))
      }
      return next
    })
    setTestRes(null)
  }

  const removeConnection = (id) => {
    setConnections(prev => {
      const next = prev.filter(connection => connection.id !== id)
      const fallback = defaultModelConnection(next)
      setSelectedConnectionId(fallback?.id || '')
      return next
    })
    setTestRes(null)
  }

  const toggleSkill = (key) => {
    const list = form.enabledSkills.includes(key)
      ? form.enabledSkills.filter(k => k !== key)
      : [...form.enabledSkills, key]
    setForm(prev => ({ ...prev, enabledSkills: list }))
  }

  // 手动触发一次技能进化分析（绕过自动节流）
  const runEvolveNow = () => {
    const staged = runAutoEvolution(null, true)
    setEvolve(getEvolveStatus())
    return staged
  }
  // 重置学习数据（清空进化库 + 行为日志）
  const resetEvolve = () => {
    clearEvolveStore()
    clearSkillLogs()
    setEvolve(getEvolveStatus())
  }

  const doSave = () => {
    const savedConnections = saveModelConnections(connections)
    const next = configWithDefaultConnection(form, savedConnections)
    saveConfig(next)
    onSave(next)
  }

  const doTest = async () => {
    setTesting(true)
    setTestRes(null)
    try {
      if (!selectedConnection?.apiKey) throw new Error('请先填写当前模型的 API Key')
      const r = await testLLM({ ...form, ...selectedConnection, useLLM: true })
      setTestRes({ ok: true, ...r })
    } catch (err) {
      setTestRes({ ok: false, msg: err.message })
    } finally {
      setTesting(false)
    }
  }

  const content = (
    <>
      {!inline && (
        <div className="agent-settings-head">
          <div className="agent-settings-title">Agent 设置</div>
          <button className="agent-settings-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>
      )}

      {/* 这一整块设置只对 legacy（浏览器内编排）生效。默认的 dsh 模式下，模型、
          密钥、技能全在服务端，这里改什么都只写进管理员自己浏览器的 localStorage，
          线上用户毫无感知 —— 不说清楚的话，改完以为生效了才是最糟的。 */}
      {!IS_LEGACY_BACKEND && (
        <div className="as-notice" style={{
          margin: '12px 0', padding: '10px 12px', borderRadius: 8,
          background: 'rgba(200,140,60,.12)', border: '1px solid rgba(200,140,60,.35)',
          fontSize: 13, lineHeight: 1.6,
        }}>
          <b>当前为服务端（dsh）模式，本页设置不会生效。</b><br />
          模型路由、API Key、技能目录都在服务器上：模型密钥配置于 <code>/etc/bazi/env</code>，
          技能正文见 <code>server/dsh/skills/</code>。<br />
          本页仅在构建时设了 <code>VITE_AGENT_BACKEND=legacy</code> 的回退模式下有效，
          且那种模式会把 API Key 明文存在本浏览器里，仅供本机调试。
        </div>
      )}

      <div className="agent-settings-tabs">
        <button className={`tab ${tab === 'model' ? 'active' : ''}`} onClick={() => setTab('model')}>🤖 大模型</button>
        <button className={`tab ${tab === 'skill' ? 'active' : ''}`} onClick={() => setTab('skill')}>🛠 技能</button>
      </div>

        {tab === 'model' ? (
          <div className="agent-settings-body">
            <div className="as-field">
              <label className="as-label">接入模式</label>
              <div className="as-mode-row">
                <div
                  className={`as-mode ${!form.useLLM ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, useLLM: false }))}
                >
                  <span className="as-mode-ico">🧠</span>
                  <span className="as-mode-t">本地规则引擎</span>
                  <span className="as-mode-d">零配置 · 无需 Key · 内置玄学知识</span>
                </div>
                <div
                  className={`as-mode ${form.useLLM ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, useLLM: true }))}
                >
                  <span className="as-mode-ico">🔗</span>
                  <span className="as-mode-t">接入大模型</span>
                  <span className="as-mode-d">OpenAI 兼容 · 多服务商 · 更自由</span>
                </div>
              </div>
            </div>

            {form.useLLM && (
              <>
                <div className="as-field">
                  <div className="as-connections-head">
                    <div>
                      <label className="as-label">模型连接</label>
                      <p className="as-hint">可同时保存多个服务商或同服务商的不同模型；带星标的连接作为默认模型。</p>
                    </div>
                    <button type="button" className="as-add-connection" onClick={addConnection}>＋ 添加模型</button>
                  </div>
                  {connections.length ? (
                    <div className="as-connection-list">
                      {connections.map(connection => (
                        <div key={connection.id} className={`as-connection ${selectedConnectionId === connection.id ? 'selected' : ''} ${connection.enabled ? 'enabled' : 'disabled'}`}>
                          <button type="button" className="as-connection-select" onClick={() => { setSelectedConnectionId(connection.id); setTestRes(null) }}>
                            <span className="as-connection-name">{connection.name}</span>
                            <span className="as-connection-meta">{PROVIDERS[connection.provider]?.name || '自定义'} · {connection.model || '未设置模型'}</span>
                          </button>
                          <div className="as-connection-actions">
                            {connection.isDefault && <span className="as-connection-default">默认</span>}
                            <button type="button" className={`as-connection-icon ${connection.isDefault ? 'active' : ''}`} onClick={() => setDefaultConnection(connection.id)} title="设为默认模型" aria-label="设为默认模型">★</button>
                            <button type="button" className={`as-connection-icon ${connection.enabled ? 'active' : ''}`} onClick={() => toggleConnection(connection.id)} title={connection.enabled ? '停用模型' : '启用模型'} aria-label={connection.enabled ? '停用模型' : '启用模型'}>{connection.enabled ? '●' : '○'}</button>
                            <button type="button" className="as-connection-icon danger" onClick={() => removeConnection(connection.id)} title="移除模型" aria-label="移除模型">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="as-connection-empty">尚未绑定模型。添加模型后可分别填写和测试连接。</div>
                  )}
                </div>

                {selectedConnection && <>
                <div className="as-field">
                  <label className="as-label">连接名称</label>
                  <input
                    className="as-input"
                    type="text"
                    placeholder="例如：DeepSeek 快速咨询"
                    value={selectedConnection.name}
                    onChange={e => updateConnection({ name: e.target.value })}
                  />
                </div>

                <div className="as-field">
                  <label className="as-label">模型服务商</label>
                  <div className="as-provider-grid">
                    {Object.entries(PROVIDERS).map(([key, p]) => (
                      <div
                        key={key}
                        className={`as-provider ${selectedConnection.provider === key ? 'active' : ''}`}
                        onClick={() => pickProvider(key)}
                      >
                        <span className="as-provider-name">{p.name}</span>
                        <span className="as-provider-tip">{p.model}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="as-field">
                  <label className="as-label">API Key <span className="as-required">*</span></label>
                  <input
                    className="as-input"
                    type="password"
                    placeholder="sk-..."
                    value={selectedConnection.apiKey}
                    onChange={e => updateConnection({ apiKey: e.target.value.trim() })}
                  />
                  <p className="as-hint">Key 仅保存在浏览器本地（localStorage），不会上传到我们的服务器。</p>
                </div>

                <div className="as-field">
                  <label className="as-label">Base URL</label>
                  <input
                    className="as-input"
                    type="text"
                    placeholder="https://api.deepseek.com/v1"
                    value={selectedConnection.baseUrl}
                    onChange={e => updateConnection({ baseUrl: e.target.value.trim() })}
                  />
                </div>

                <div className="as-field">
                  <label className="as-label">模型名</label>
                  <input
                    className="as-input"
                    type="text"
                    placeholder="deepseek-chat"
                    value={selectedConnection.model}
                    onChange={e => updateConnection({ model: e.target.value.trim() })}
                  />
                  <p className="as-hint">{PROVIDERS[selectedConnection.provider]?.tip}</p>
                </div>

                <div className="as-actions">
                  <button className="btn ghost small" onClick={doTest} disabled={testing || !selectedConnection.apiKey}>
                    {testing ? '连接中…' : '测试连接'}
                  </button>
                  {testRes && (
                    <div className={`as-test-res ${testRes.ok ? 'ok' : 'fail'}`}>
                      {testRes.ok ? `✅ 连接成功（${testRes.ms}ms）${testRes.preview ? '：' + testRes.preview : ''}` : `❌ ${testRes.msg}`}
                    </div>
                  )}
                </div>
                </>}
              </>
            )}

            <div className="as-save-row">
              <button className="btn" onClick={doSave}>保存设置</button>
            </div>
          </div>
        ) : (
          <div className="agent-settings-body">
            <p className="as-intro">启用后，提问命中对应技能时：本地引擎将调用内置工具（起卦/抽牌/黄历等）生成真实结果，接入大模型后则由模型结合结果回答。</p>

            <div className="as-sec-title">技能列表</div>
            <div className="as-skill-list">
              {allSkills(customSkills).map(s => {
                const on = form.enabledSkills.includes(s.key)
                const isBuiltin = BUILTIN_SKILLS.some(b => b.key === s.key)
                return (
                  <div key={s.key} className={`as-skill ${on ? 'on' : ''}`}>
                    <div className="as-skill-ico">{s.icon}</div>
                    <div className="as-skill-info">
                      <div className="as-skill-name">
                        {s.name}
                        {isBuiltin
                          ? (s.tool && <span className="as-skill-tool">内置工具</span>)
                          : <span className="as-skill-tool admin">管理导入</span>}
                      </div>
                      <div className="as-skill-desc">{s.desc}</div>
                    </div>
                    <button className={`as-switch ${on ? 'on' : ''}`} onClick={() => toggleSkill(s.key)} aria-pressed={on}>
                      <span className="as-switch-knob" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="as-sec-title" style={{ marginTop: 22 }}>
              技能生态
            </div>
            <p className="as-intro">技能由系统统一维护，普通用户仅可启用/停用，无法修改内容。AI 会根据使用反馈与命中质量持续自我学习、进化技能（优化关键词、补充能力说明），让回答越来越贴合真实需求。</p>

            <div className="as-evolve-box">
              <div className="as-evolve-head">
                <span>自我进化状态</span>
                <span className="as-evolve-ops">
                  <button className="btn ghost small" onClick={runEvolveNow} title="立即分析日志并触发一次进化">立即进化</button>
                  <button className="btn ghost small danger" onClick={resetEvolve} title="清空进化库与行为日志">重置学习</button>
                </span>
              </div>
              <div className="as-evolve-stats">
                <span>学习日志 <b>{evolve.logCount}</b> 条</span>
                <span>已进化 <b>{Object.keys(evolve.store).length}</b> 个技能</span>
              </div>
              {Object.keys(evolve.store).length > 0 ? (
                <div className="as-evolve-list">
                  {Object.entries(evolve.store).map(([k, it]) => (
                    <div key={k} className="as-evolve-item">
                      <span className="as-evolve-name">{k}</span>
                      <span className={`as-evolve-state ${it.state}`}>{it.state}</span>
                      {it.pending && <span className="as-evolve-detail">进化中（待 {6 - (it.pending.gray?.total || 0)} 次观察）</span>}
                      {it.active && !it.pending && <span className="as-evolve-detail">已生效 v{it.active.version}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="as-evolve-empty">暂无进化记录。对话中点击回答下方的 👍/👎 反馈，或持续使用后，AI 会自动学习并优化技能。</p>
              )}
            </div>

            <div className="as-save-row">
              <button className="btn" onClick={doSave}>保存设置</button>
            </div>
          </div>
        )}
    </>
  )

  if (inline) {
    return <div className="agent-settings inline">{content}</div>
  }
  return (
    <div className="agent-settings-mask" onClick={onClose}>
      <div className="agent-settings" onClick={e => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
}
