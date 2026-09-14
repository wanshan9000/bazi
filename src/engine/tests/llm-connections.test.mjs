import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  configWithDefaultConnection,
  createModelConnection,
  defaultModelConnection,
  loadModelConnections,
  saveModelConnections,
} from '../llm.js'

const CONNECTIONS_KEY = 'genki-agent-model-connections-v1'

afterEach(() => localStorage.removeItem(CONNECTIONS_KEY))

test('旧单模型配置会迁移成一条默认连接', () => {
  const connections = loadModelConnections({
    provider: 'deepseek',
    apiKey: 'test-deepseek-key',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    useLLM: true,
  })

  assert.equal(connections.length, 1)
  assert.equal(connections[0].provider, 'deepseek')
  assert.equal(connections[0].isDefault, true)
  assert.equal(connections[0].enabled, true)
})

test('保存多个连接时只保留一个默认项，并优先选择已启用项', () => {
  const disabled = createModelConnection('minimax', { id: 'minimax', enabled: false, isDefault: true })
  const enabled = createModelConnection('deepseek', { id: 'deepseek', enabled: true, isDefault: true })
  const saved = saveModelConnections([disabled, enabled])

  assert.equal(saved.filter(connection => connection.isDefault).length, 1)
  assert.equal(defaultModelConnection(saved)?.id, 'deepseek')
})

test('只把默认连接同步到旧版运行配置', () => {
  const primary = createModelConnection('deepseek', {
    id: 'primary', apiKey: 'primary-key', baseUrl: 'https://example.test/v1', model: 'primary-model', isDefault: true,
  })
  const secondary = createModelConnection('minimax', {
    id: 'secondary', apiKey: 'secondary-key', baseUrl: 'https://secondary.test/v1', model: 'secondary-model',
  })
  const cfg = configWithDefaultConnection({ useLLM: true, enabledSkills: ['bazi'] }, [primary, secondary])

  assert.deepEqual(
    { provider: cfg.provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, useLLM: cfg.useLLM },
    { provider: 'deepseek', apiKey: 'primary-key', baseUrl: 'https://example.test/v1', model: 'primary-model', useLLM: true },
  )
  assert.deepEqual(cfg.enabledSkills, ['bazi'])
})

test('没有可用连接时停用旧版直连模式', () => {
  const cfg = configWithDefaultConnection({ useLLM: true, provider: 'deepseek' }, [])
  assert.equal(cfg.useLLM, false)
})
