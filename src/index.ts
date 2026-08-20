import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import { promoteAllProviderModels, promoteProvider, type Effort, type ProviderProfile } from './profile.ts'

export { inferThinkingFormat, promoteAllProviderModels, promoteProvider, REASONING_COMPAT, REASONING_EFFORTS } from './profile.ts'
export type { Effort, ModelProfile, ProviderProfile, PromotedProvider, ThinkingFormat } from './profile.ts'

export const name = 'dsh-web-ui-promax'
export const inject = ['settings', 'connection']

const PI_AI_NAMESPACE = settingsNamespace('llm-pi-ai')
export const UI_SETTINGS_NAMESPACE = settingsNamespace('web-ui-promax')
export const UI_EFFECTS = ['original', 'ios'] as const
export type UiEffect = (typeof UI_EFFECTS)[number]

export interface UiSettings {
  uiEffect: UiEffect
}

export const UI_SETTINGS_SCHEMA: z<UiSettings> = z.object({
  uiEffect: z.union(UI_EFFECTS).default('original'),
})

export interface Config {
  providers?: string[]
  defaultEffort?: Effort
}

export const Config: z<Config> = z.object({
  providers: z.array(z.string()).default([]),
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
  const uiSettings = ctx.settings.register<UiSettings>(UI_SETTINGS_NAMESPACE, UI_SETTINGS_SCHEMA, {
    base: { uiEffect: 'original' },
  })
  ctx.connection.rpc.handle(
    '/web-ui-promax',
    async (endpoint, payload): Promise<RpcResult<{ uiEffect: UiEffect }>> => {
      try {
        if (endpoint === 'get-ui-effect') return ok({ uiEffect: uiSettings.get().uiEffect })
        if (endpoint === 'set-ui-effect') {
          const value = (payload as Record<string, unknown> | undefined)?.uiEffect
          if (!isUiEffect(value)) return fail('uiEffect must be original or ios')
          await uiSettings.update({ uiEffect: value })
          return ok({ uiEffect: uiSettings.get().uiEffect })
        }
        return fail(`unknown endpoint: ${endpoint}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return fail(message.slice(0, 500))
      }
    },
    { authority: 'trusted-host' },
  )

  const providerAllowlist = new Set((config.providers ?? []).map(provider => nonBlank(provider, 'providers entry')))
  const defaultEffort = config.defaultEffort ?? 'high'
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (delay: number): void => {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void reconcile().catch(reportFailure)
    }, delay)
  }
  ctx.effect(() => () => {
    if (timer !== undefined) clearTimeout(timer)
  }, 'dsh-web-ui-promax: settings reconciliation')
  ctx.on('settings/updated', (namespace) => {
    if (namespace === PI_AI_NAMESPACE) schedule(0)
  })

  // Cordis applies sibling loader entries concurrently. The generic adapter
  // owns this namespace and may register it a few ticks after this bundle is
  // mounted, so wait for that public settings seam instead of making plugin
  // ordering an application-startup dependency.
  const reconcile = async (): Promise<void> => {
    attempts += 1
    const current = ctx.settings.get(PI_AI_NAMESPACE) as PiAiSettings | undefined
    const providers = current?.providers
    if (providers === undefined || Object.keys(providers).length === 0) {
      if (attempts < 150) {
        schedule(100)
      } else {
        ctx.logger.warn(
          'dsh-web-ui-promax: no providers appeared in llm-pi-ai settings; leaving Harness operational',
        )
      }
      return
    }
    attempts = 0
    const operations: Array<{ op: 'set'; path: string[]; value: unknown }> = []
    const promotedProviders: string[] = []
    for (const [providerId, source] of Object.entries(providers)) {
      if (providerAllowlist.size > 0 && !providerAllowlist.has(providerId)) continue
      const promoted = promoteAllProviderModels(source, providerId, defaultEffort)
      if (!promoted.changed) continue
      operations.push(
        { op: 'set', path: ['providers', providerId, 'reasoning'], value: defaultEffort },
        { op: 'set', path: ['providers', providerId, 'models'], value: promoted.profile.models },
      )
      promotedProviders.push(providerId)
    }
    if (operations.length === 0) return
    await ctx.settings.mutate(PI_AI_NAMESPACE, operations)
    ctx.logger.info('dsh-web-ui-promax: enabled native reasoning controls for providers: %s', promotedProviders.join(', '))
  }

  const reportFailure = (error: unknown): void => {
    ctx.logger.error('dsh-web-ui-promax: failed to reconcile native reasoning controls')
    ctx.logger.error(error)
  }
  schedule(0)
}

interface RpcError {
  code: 'internal'
  message: string
  details: Record<string, never>
}

type RpcResult<T> = { ok: true; value: T } | { ok: false; error: RpcError }

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

function fail(message: string): RpcResult<never> {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

export function isUiEffect(value: unknown): value is UiEffect {
  return value === 'original' || value === 'ios'
}

function nonBlank(value: string, field: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`dsh-web-ui-promax: ${field} must be non-empty`)
  }
  return normalized
}
