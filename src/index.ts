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
export function apply(ctx: Context, config: Config): void {
  const provider = nonBlank(config.provider, 'provider')
  const model = nonBlank(config.model, 'model')
  const defaultEffort = config.defaultEffort ?? 'high'
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (delay: number): void => {
    timer = setTimeout(() => {
      timer = undefined
      void reconcile().catch(reportFailure)
    }, delay)
  }
  ctx.effect(() => () => {
    if (timer !== undefined) clearTimeout(timer)
  }, 'dsh-web-ui-promax: settings reconciliation')

  // Cordis applies sibling loader entries concurrently. The generic adapter
  // owns this namespace and may register it a few ticks after this bundle is
  // mounted, so wait for that public settings seam instead of making plugin
  // ordering an application-startup dependency.
  const reconcile = async (): Promise<void> => {
    attempts += 1
    const current = ctx.settings.get(PI_AI_NAMESPACE) as PiAiSettings | undefined
    const source = current?.providers?.[provider]
    if (source === undefined) {
      if (attempts < 150) {
        schedule(100)
      } else {
        ctx.logger.warn(
          'dsh-web-ui-promax: provider "%s" did not appear in llm-pi-ai settings; leaving Harness operational',
          provider,
        )
      }
      return
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

  const reportFailure = (error: unknown): void => {
    ctx.logger.error('dsh-web-ui-promax: failed to reconcile native reasoning controls')
    ctx.logger.error(error)
  }
  schedule(0)
}

function nonBlank(value: string | undefined, field: string): string {
  const normalized = value?.trim()
  if (normalized === undefined || normalized.length === 0) {
    throw new Error(`dsh-web-ui-promax: ${field} must be non-empty`)
  }
  return normalized
}
