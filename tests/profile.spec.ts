import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import { applyUiEffect, currentReasoning, isUiEffect as isClientUiEffect } from '../src/client/index.tsx'

describe('dsh-web-ui-promax profile', () => {
  it('keeps the Cordis namespace and settings injection', () => {
    expect('default' in plugin).toBe(false)
    expect(plugin.inject).toEqual(['settings', 'connection'])
    expect(typeof plugin.apply).toBe('function')
  })

  it('adds the exact four levels and DeepSeek request dialect without changing route authority', () => {
    const source = {
      displayName: 'Intense Sight',
      apiKeyEnv: 'DEEPSEEK_V4_FLASH_API_KEY',
      baseURL: 'https://private.example/v1',
      models: [{ id: 'deepseek-v4-flash', name: 'Deepseek V4 Flash', contextWindow: 1_000_000 }],
    }
    const result = plugin.promoteProvider(source, 'deepseek-v4-flash', 'high')
    expect(result.changed).toBe(true)
    expect(result.profile).toMatchObject({
      displayName: 'Intense Sight', apiKeyEnv: 'DEEPSEEK_V4_FLASH_API_KEY', baseURL: 'https://private.example/v1', reasoning: 'high',
      models: [{
        id: 'deepseek-v4-flash', name: 'Deepseek V4 Flash', contextWindow: 1_000_000,
        reasoningEfforts: { off: 'none', medium: 'medium', high: 'high', max: 'max' },
        compat: { thinkingFormat: 'deepseek', supportsReasoningEffort: true },
      }],
    })
    expect(source.models[0]).not.toHaveProperty('reasoningEfforts')
  })

  it('is idempotent and rejects an accidental target mismatch', () => {
    const once = plugin.promoteProvider({ models: [{ id: 'm' }] }, 'm', 'high')
    expect(plugin.promoteProvider(once.profile, 'm', 'high').changed).toBe(false)
    expect(() => plugin.promoteProvider({ models: [{ id: 'other' }] }, 'm', 'high')).toThrow(/not declared/u)
  })
})

describe('UI effects', () => {
  it('exposes the combined Swift Glass and Liquid Glass effect as iOS', () => {
    expect(plugin.UI_EFFECTS).toEqual(['ios'])
    expect(plugin.isUiEffect('ios')).toBe(true)
    expect(plugin.isUiEffect('swift-glass')).toBe(false)
    expect(plugin.isUiEffect('liquid-glass')).toBe(false)
    expect(isClientUiEffect('ios')).toBe(true)
  })

  it('projects the selected effect through one root data attribute', () => {
    const root = { dataset: {} as DOMStringMap }
    applyUiEffect(root, 'ios')
    expect(root.dataset['dshUiEffect']).toBe('ios')
  })
})

describe('reasoning control projection', () => {
  const state = (effort: string) => ({
    current: { provider: 'p', model: 'm', reasoningEffort: effort },
    groups: [{ id: 'p', models: [{ id: 'm', reasoning: { defaultEffort: 'high', efforts: [
      { id: 'off', name: 'Off' }, { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' },
    ] } }] }],
    status: 'ready' as const,
    error: null,
  })

  it('derives the live master switch from the native per-session effort', () => {
    expect(currentReasoning(state('off'))?.effectiveEffort).toBe('off')
    expect(currentReasoning(state('max'))?.effectiveEffort).toBe('max')
  })

  it('stays absent for models whose adapter did not declare reasoning', () => {
    expect(currentReasoning({ ...state('high'), groups: [{ id: 'p', models: [{ id: 'm' }] }] })).toBeUndefined()
  })
})
