import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { promoteProvider, type Effort, type ProviderProfile } from './profile.ts'

export { promoteProvider, REASONING_COMPAT, REASONING_EFFORTS } from './profile.ts'
export type { Effort, ModelProfile, ProviderProfile, PromotedProvider } from './profile.ts'

export const name = 'dsh-web-ui-promax'
export const inject = ['settings']

const PI_AI_NAMESPACE = settingsNamespace('llm-pi-ai')

export interface Config {
  provider?: string
  model?: string
  defaultEffort?: Effort
}

export const Config: z<Config> = z.object({
  provider: z.string().default('deepseek-v4-flash'),
  model: z.string().default('deepseek-v4-flash'),
  defaultEffort: z.union(['off', 'medium', 'high', 'max'] as const).default('high'),
})

interface PiAiSettings {
  providers?: Record<string, ProviderProfile>
}

/**
 * Reconcile the generic adapter's public settings schema once. The adapter
 * remains the request owner; this plugin only declares capabilities the exact
 * self-hosted route was missing, so the native Model/Effort selector and
 * session persistence continue to work unchanged.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const provider = nonBlank(config.provider, 'provider')
  const model = nonBlank(config.model, 'model')
  const defaultEffort = config.defaultEffort ?? 'high'
  const current = ctx.settings.get(PI_AI_NAMESPACE) as PiAiSettings | undefined
  const source = current?.providers?.[provider]
  if (source === undefined) {
    throw new Error(`dsh-web-ui-promax: provider "${provider}" is not registered in llm-pi-ai settings`)
  }
  const promoted = promoteProvider(source, model, defaultEffort)
  if (!promoted.changed) return
  await ctx.settings.mutate(PI_AI_NAMESPACE, [
    {
      op: 'set',
      path: ['providers', provider, 'reasoning'],
      value: defaultEffort,
    },
    {
      op: 'set',
      path: ['providers', provider, 'models'],
      value: promoted.profile.models,
    },
  ])
  ctx.logger.info('dsh-web-ui-promax: enabled native reasoning controls for %s/%s', provider, model)
}

function nonBlank(value: string | undefined, field: string): string {
  const normalized = value?.trim()
  if (normalized === undefined || normalized.length === 0) {
    throw new Error(`dsh-web-ui-promax: ${field} must be non-empty`)
  }
  return normalized
}
