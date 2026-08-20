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

export type ThinkingFormat = 'openai' | 'deepseek' | 'openrouter' | 'together' | 'zai' | 'qwen'

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

const GENERIC_REASONING_EFFORTS = Object.freeze({
  off: null,
  medium: 'medium',
  high: 'high',
  max: 'max',
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

/**
 * Add reasoning controls to every declared model on one generic local route.
 * Explicit `reasoningEfforts: false` remains authoritative. Existing model or
 * provider dialect settings win; otherwise the dialect is inferred from the
 * provider id, model id, and endpoint rather than hard-coded to DeepSeek.
 */
export function promoteAllProviderModels(
  source: ProviderProfile,
  providerId: string,
  defaultEffort: Effort,
): PromotedProvider {
  if (!Array.isArray(source.models) || source.models.length === 0) {
    throw new Error(`dsh-web-ui-promax: provider "${providerId}" has no explicit models list`)
  }
  let changed = source.reasoning !== defaultEffort
  const providerCompat = isRecord(source.compat) ? source.compat : {}
  const models = source.models.map((raw): ModelProfile => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.trim().length === 0) {
      throw new Error(`dsh-web-ui-promax: provider "${providerId}" contains a model without an id`)
    }
    if (raw.reasoningEfforts === false) return raw
    const format = inferThinkingFormat(providerId, source, raw)
    const compat = isRecord(raw.compat) ? raw.compat : {}
    const desired = {
      ...raw,
      reasoningEfforts: format === 'deepseek' ? { ...REASONING_EFFORTS } : { ...GENERIC_REASONING_EFFORTS },
      compat: {
        ...compat,
        ...(compat.thinkingFormat === undefined && providerCompat.thinkingFormat === undefined
          ? { thinkingFormat: format }
          : {}),
        ...(compat.supportsReasoningEffort === undefined && providerCompat.supportsReasoningEffort === undefined
          ? { supportsReasoningEffort: true }
          : {}),
      },
    }
    if (!sameJson(raw, desired)) changed = true
    return desired
  })
  return {
    profile: { ...source, reasoning: defaultEffort, models },
    changed,
  }
}

export function inferThinkingFormat(
  providerId: string,
  source: ProviderProfile,
  model: ModelProfile,
): ThinkingFormat {
  const modelCompat = isRecord(model.compat) ? model.compat : {}
  const providerCompat = isRecord(source.compat) ? source.compat : {}
  const declared = modelCompat.thinkingFormat ?? providerCompat.thinkingFormat
  if (isThinkingFormat(declared)) return declared
  const fingerprint = [providerId, model.id, source.baseURL].map(value => String(value ?? '').toLowerCase()).join(' ')
  if (fingerprint.includes('qwen')) return 'qwen'
  if (fingerprint.includes('deepseek') || fingerprint.includes('dsv4')) return 'deepseek'
  if (fingerprint.includes('openrouter')) return 'openrouter'
  if (fingerprint.includes('together')) return 'together'
  if (fingerprint.includes('zai') || fingerprint.includes('z.ai') || fingerprint.includes('glm')) return 'zai'
  return 'openai'
}

function isThinkingFormat(value: unknown): value is ThinkingFormat {
  return value === 'openai' || value === 'deepseek' || value === 'openrouter'
    || value === 'together' || value === 'zai' || value === 'qwen'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
