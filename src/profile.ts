export type Effort = 'off' | 'medium' | 'high' | 'max'

export interface ModelProfile {
  id?: unknown
  [key: string]: unknown
}

export interface ProviderProfile {
  models?: unknown
  reasoning?: unknown
  [key: string]: unknown
}

export interface PromotedProvider {
  profile: ProviderProfile
  changed: boolean
}

export const REASONING_EFFORTS = Object.freeze({
  off: 'none',
  medium: 'medium',
  high: 'high',
  max: 'max',
})

export const REASONING_COMPAT = Object.freeze({
  thinkingFormat: 'deepseek',
  supportsReasoningEffort: true,
})

/**
 * Add native Harness reasoning metadata to one already-declared model while
 * preserving every endpoint, credential, capacity and unrelated model field.
 */
export function promoteProvider(
  source: ProviderProfile,
  modelId: string,
  defaultEffort: Effort,
): PromotedProvider {
  if (!Array.isArray(source.models)) {
    throw new Error('dsh-web-ui-promax: target provider has no explicit models list')
  }
  let found = false
  let changed = source.reasoning !== defaultEffort
  const models = source.models.map((raw): ModelProfile => {
    if (!isRecord(raw) || raw.id !== modelId) return raw as ModelProfile
    found = true
    const desired = {
      ...raw,
      reasoningEfforts: { ...REASONING_EFFORTS },
      compat: {
        ...isRecord(raw.compat) ? raw.compat : {},
        ...REASONING_COMPAT,
      },
    }
    if (!sameJson(raw, desired)) changed = true
    return desired
  })
  if (!found) throw new Error(`dsh-web-ui-promax: target model "${modelId}" is not declared`)
  return {
    profile: {
      ...source,
      reasoning: defaultEffort,
      models,
    },
    changed,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
