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

  it('discovers and promotes every declared local model with its own dialect', () => {
    const source = {
      displayName: 'Intense Sight', apiKeyEnv: 'LOCAL_KEY', baseURL: 'https://models.example/v1',
      models: [
        { id: 'deepseek-ai/DeepSeek-V4', name: 'DeepSeek' },
        { id: 'Qwen/Qwen3.8-27B', name: 'Qwen' },
        { id: 'embedding-only', reasoningEfforts: false },
      ],
    }
    const result = plugin.promoteAllProviderModels(source, 'intensesight', 'high')
    expect(result.changed).toBe(true)
    expect(result.profile).toMatchObject({
      displayName: 'Intense Sight', apiKeyEnv: 'LOCAL_KEY', baseURL: 'https://models.example/v1', reasoning: 'high',
      models: [
        { id: 'deepseek-ai/DeepSeek-V4', compat: { thinkingFormat: 'deepseek', supportsReasoningEffort: true }, reasoningEfforts: { off: 'none', medium: 'medium', high: 'high', max: 'max' } },
        { id: 'Qwen/Qwen3.8-27B', compat: { thinkingFormat: 'qwen', supportsReasoningEffort: true }, reasoningEfforts: { off: null, medium: 'medium', high: 'high', max: 'max' } },
        { id: 'embedding-only', reasoningEfforts: false },
      ],
    })
    expect(plugin.promoteAllProviderModels(result.profile, 'intensesight', 'high').changed).toBe(false)
    expect(source.models[0]).not.toHaveProperty('compat')
  })

  it('preserves explicit provider dialect authority instead of guessing', () => {
    const result = plugin.promoteAllProviderModels({
      compat: { thinkingFormat: 'together', supportsReasoningEffort: false },
      models: [{ id: 'new-model' }],
    }, 'private', 'high')
    expect(result.profile.models).toEqual([{ id: 'new-model', reasoningEfforts: { off: null, medium: 'medium', high: 'high', max: 'max' }, compat: {} }])
  })
})

describe('UI effects', () => {
  it('exposes the combined Swift Glass and Liquid Glass effect as iOS', () => {
    expect(plugin.UI_EFFECTS).toEqual(['original', 'ios'])
    expect(plugin.isUiEffect('original')).toBe(true)
    expect(plugin.isUiEffect('ios')).toBe(true)
    expect(plugin.isUiEffect('swift-glass')).toBe(false)
    expect(plugin.isUiEffect('liquid-glass')).toBe(false)
    expect(isClientUiEffect('original')).toBe(true)
    expect(isClientUiEffect('ios')).toBe(true)
  })

  it('projects the selected effect through one root data attribute', () => {
    const root = { dataset: {} as DOMStringMap }
    applyUiEffect(root, 'ios')
    expect(root.dataset['dshUiEffect']).toBe('ios')
    applyUiEffect(root, 'original')
    expect(root.dataset['dshUiEffect']).toBeUndefined()
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
