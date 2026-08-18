import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'

const NS = 'web-ui-promax'
const CHANNEL = '/web-ui-promax'
export const UI_EFFECTS = ['ios'] as const
export type UiEffect = (typeof UI_EFFECTS)[number]

type ModelSelection = { provider: string; model: string; reasoningEffort?: string }
type Reasoning = { efforts: Array<{ id: string; name: string }>; defaultEffort?: string }
type Model = { id: string; reasoning?: Reasoning }
type Group = { id: string; models: Model[] }
type DirectoryState = {
  current: ModelSelection | null
  groups: Group[]
  status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  error: string | null
}
type Store = {
  subscribe(listener: () => void): () => void
  getSnapshot(): DirectoryState
}
type Directory = { store: Store; load(): Promise<unknown>; select(selection: ModelSelection): Promise<void> }
type ModelDirectories = { directoryFor(sessionId: string): Directory }

const dict = {
  en: {
    reasoning: 'Reasoning', on: 'On', off: 'Off', aria: 'Reasoning: {state}', failed: 'Could not change reasoning: {message}',
    uiEffects: 'UI Effects', ios: 'iOS', iosHint: 'Swift Glass motion with a Liquid Glass interface.',
    moreSoon: 'More effects coming soon', effectFailed: 'Could not apply UI effect: {message}',
  },
  zh: {
    reasoning: '推理', on: '开启', off: '关闭', aria: '推理：{state}', failed: '无法切换推理：{message}',
    uiEffects: 'UI 特效', ios: 'iOS', iosHint: 'Swift Glass 动效与 Liquid Glass 界面。',
    moreSoon: '更多特效即将推出', effectFailed: '无法应用 UI 特效：{message}',
  },
}

const styles = `
.promax-root{position:relative;display:inline-flex;align-items:center}.promax-trigger{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}.promax-trigger:hover,.promax-trigger[aria-expanded=true]{background:var(--dsw-alias-bg-hover)}.promax-trigger:disabled{opacity:.4;cursor:default}.promax-chevron{width:12px;height:12px;transition:transform .15s ease}.promax-trigger[aria-expanded=true] .promax-chevron{transform:rotate(180deg)}.promax-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:80;min-width:150px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-l1);box-shadow:0 10px 32px rgba(0,0,0,.28)}.promax-menu-title{display:block;padding:5px 9px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.promax-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}.promax-option:hover{background:var(--dsw-alias-bg-hover)}.promax-check{width:14px;text-align:center;color:var(--dsw-alias-label-primary)}.promax-error{position:absolute;right:0;bottom:calc(100% + 48px);width:260px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:9px;background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
.promax-effects-group{display:flex;flex-direction:column;gap:8px;padding:16px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}.promax-effects-title{font-size:14px;font-weight:400;line-height:22px;color:var(--dsw-alias-label-primary)}.promax-effects-row{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap}.promax-effect-cube{box-sizing:border-box;position:relative;overflow:hidden;flex:1 1 220px;display:flex;min-height:108px;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:3px;padding:18px 20px;border:1px solid var(--dsw-static-neutral-bluish-400);border-radius:16px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}.promax-effect-cube:hover{background:var(--dsw-alias-interactive-bg-hover)}.promax-effect-cube:disabled{opacity:.65;cursor:wait}.promax-effect-name{position:relative;z-index:1;font-size:14px;font-weight:500;line-height:22px}.promax-effect-hint{position:relative;z-index:1;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.promax-effect-preview{position:absolute;inset:10px 12px auto auto;width:74px;height:38px;border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 68%,white);border-radius:15px;background:radial-gradient(circle at 28% 18%,rgba(255,255,255,.78),transparent 34%),linear-gradient(135deg,rgba(99,153,255,.38),rgba(209,128,255,.24));box-shadow:inset 0 1px 0 rgba(255,255,255,.42),0 9px 24px rgba(0,0,0,.16);backdrop-filter:blur(22px) saturate(1.45);-webkit-backdrop-filter:blur(22px) saturate(1.45);animation:promax-swift-glass 4.6s ease-in-out infinite}.promax-effects-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.promax-effects-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}@keyframes promax-swift-glass{0%,100%{transform:translate3d(0,0,0);filter:hue-rotate(0deg)}50%{transform:translate3d(-5px,2px,0);filter:hue-rotate(12deg)}}
html[data-dsh-ui-effect="ios"]{--dsw-mask-blur:blur(22px) saturate(1.42)}html[data-dsh-ui-effect="ios"] body{background-image:radial-gradient(circle at 12% 18%,rgba(80,145,255,.12),transparent 32%),radial-gradient(circle at 88% 78%,rgba(190,105,255,.10),transparent 35%);background-attachment:fixed}html[data-dsh-ui-effect="ios"] [role="dialog"],html[data-dsh-ui-effect="ios"] [role="menu"],html[data-dsh-ui-effect="ios"] [role="listbox"]{background:color-mix(in srgb,var(--dsw-alias-bg-l1) 78%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-border-l2) 72%,white);backdrop-filter:blur(22px) saturate(1.42);-webkit-backdrop-filter:blur(22px) saturate(1.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 18px 48px rgba(0,0,0,.22);transition:transform .18s cubic-bezier(.2,.8,.2,1),opacity .18s ease}
@media(prefers-reduced-motion:reduce){.promax-effect-preview{animation:none}html[data-dsh-ui-effect="ios"] [role="dialog"],html[data-dsh-ui-effect="ios"] [role="menu"],html[data-dsh-ui-effect="ios"] [role="listbox"]{transition:none}}
`

export const name = 'dsh-web-ui-promax'
export const inject = ['slots', 'locale', 'modelDirectories', 'connection']

export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as { inject(key: string, cb: () => unknown): unknown; register(options: unknown, component: unknown): unknown } | undefined
  const locale = ctx.get('locale') as { bind(ns: string): (key: string, values?: Record<string, unknown>) => string; register(ns: string, value: unknown): unknown } | undefined
  const modelDirectories = ctx.get('modelDirectories') as ModelDirectories | undefined
  const connection = ctx.get('connection') as { rpc: { call(channel: string, endpoint: string, payload: unknown): Promise<{ ok: boolean; value?: unknown; error?: { message?: string } }> } } | undefined
  if (!slots || !locale || !modelDirectories || !connection) return
  const t = locale.bind(NS)
  let effect: UiEffect = 'ios'
  const effectListeners = new Set<() => void>()
  const publishEffect = (next: UiEffect): void => {
    effect = next
    applyUiEffect(document.documentElement, next)
    for (const listener of effectListeners) listener()
  }
  const call = async (endpoint: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
    const response = await connection.rpc.call(CHANNEL, endpoint, payload)
    if (response.ok) return response.value
    throw new Error(response.error?.message ?? 'RPC failed')
  }
  const setEffect = async (next: UiEffect): Promise<void> => {
    const state = await call('set-ui-effect', { uiEffect: next }) as { uiEffect?: unknown }
    if (!isUiEffect(state.uiEffect)) throw new Error('Host returned an invalid UI effect')
    publishEffect(state.uiEffect)
  }
  publishEffect(effect)
  void call('get-ui-effect').then((value) => {
    const state = value as { uiEffect?: unknown }
    if (isUiEffect(state.uiEffect)) publishEffect(state.uiEffect)
  }).catch(() => undefined)
  ctx.effect(() => {
    const dispose = locale.register(NS, dict)
    return () => { if (typeof dispose === 'function') dispose() }
  }, 'dsh-web-ui-promax: dictionaries')
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset['dshWebUiPromax'] = 'true'
    style.textContent = styles
    document.head.append(style)
    return () => { style.remove() }
  }, 'dsh-web-ui-promax: styles')
  slots.inject('conversation.input.right', () => slots.register({
    name: 'conversation.input.right', id: 'web-ui-promax-reasoning', order: 90, locale: NS,
    inject: (sessionId: string) => ({ directory: modelDirectories.directoryFor(sessionId), t }),
  }, ReasoningControl))
  slots.inject('settings.general.item', () => slots.register({
    name: 'settings.general.item', id: 'web-ui-promax-effects', order: 11, locale: NS,
    inject: () => ({
      t,
      getEffect: () => effect,
      subscribeEffect: (listener: () => void) => { effectListeners.add(listener); return () => { effectListeners.delete(listener) } },
      setEffect,
    }),
  }, UiEffectsRow))
}

interface EffectsProps {
  t: (key: string, values?: Record<string, unknown>) => string
  getEffect: () => UiEffect
  subscribeEffect: (listener: () => void) => () => void
  setEffect: (effect: UiEffect) => Promise<void>
}

function UiEffectsRow({ t, getEffect, subscribeEffect, setEffect }: EffectsProps) {
  const current = useSyncExternalStore(subscribeEffect, getEffect)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choose = async (): Promise<void> => {
    setBusy(true); setError('')
    try {
      await setEffect('ios')
    } catch (cause) {
      setError(format(t('effectFailed'), { message: messageOf(cause) }))
    } finally {
      setBusy(false)
    }
  }
  return <div className="promax-effects-group">
    <div className="promax-effects-title">{t('uiEffects')}</div>
    <div className="promax-effects-row">
      <button type="button" className="promax-effect-cube" aria-pressed={current === 'ios'} disabled={busy} onClick={() => { void choose() }}>
        <span className="promax-effect-preview" aria-hidden />
        <span className="promax-effect-name">{t('ios')}</span>
        <span className="promax-effect-hint">{t('iosHint')}</span>
      </button>
    </div>
    <span className="promax-effects-note">{t('moreSoon')}</span>
    {error && <span className="promax-effects-error" role="alert">{error}</span>}
  </div>
}

export function isUiEffect(value: unknown): value is UiEffect {
  return value === 'ios'
}

export function applyUiEffect(root: { dataset: DOMStringMap }, effect: UiEffect): void {
  root.dataset['dshUiEffect'] = effect
}

interface ControlProps {
  directory: Directory
  t: (key: string, values?: Record<string, unknown>) => string
}

function ReasoningControl({ directory, t }: ControlProps) {
  const state = useSyncExternalStore(
    listener => directory.store.subscribe(listener),
    () => directory.store.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const lastEnabled = useRef('high')
  const current = currentReasoning(state)
  const effective = current?.effectiveEffort
  const enabled = effective !== undefined && effective !== 'off'
  useEffect(() => {
    if (enabled && effective !== undefined) lastEnabled.current = effective
  }, [enabled, effective])
  useEffect(() => {
    if (state.current !== null && state.groups.length === 0) void directory.load().catch(() => undefined)
  }, [directory, state.current, state.groups.length])
  if (current === undefined) return null
  const busy = state.status === 'selecting'
  const choose = async (nextEnabled: boolean): Promise<void> => {
    setError('')
    setOpen(false)
    const nonOff = current.reasoning.efforts.filter(item => item.id !== 'off').map(item => item.id)
    const preferred = nonOff.includes(lastEnabled.current)
      ? lastEnabled.current
      : nonOff.includes('high') ? 'high' : nonOff[0]
    const effort = nextEnabled ? preferred : 'off'
    if (effort === undefined || effort === effective) return
    try {
      await directory.select({
        provider: current.selection.provider,
        model: current.selection.model,
        reasoningEffort: effort,
      })
    } catch (cause) {
      setError(format(t('failed'), { message: messageOf(cause) }))
    }
  }
  const stateLabel = enabled ? t('on') : t('off')
  return <div className="promax-root" onBlur={(event) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button type="button" className="promax-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={format(t('aria'), { state: stateLabel })} disabled={busy} onClick={() => setOpen(value => !value)}>
      <span>{t('reasoning')}</span><span>{stateLabel}</span>
      <svg className="promax-chevron" viewBox="0 0 12 12" aria-hidden><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <div className="promax-menu" role="menu">
      <span className="promax-menu-title">{t('reasoning')}</span>
      {[true, false].map(value => {
        const label = value ? t('on') : t('off')
        return <button key={String(value)} type="button" role="menuitemradio" aria-checked={enabled === value} className="promax-option" onClick={() => { void choose(value) }}><span>{label}</span><span className="promax-check">{enabled === value ? '✓' : ''}</span></button>
      })}
    </div>}
    {error && <div className="promax-error" role="alert">{error}</div>}
  </div>
}

export function currentReasoning(state: DirectoryState): { selection: ModelSelection; reasoning: Reasoning; effectiveEffort?: string } | undefined {
  const selection = state.current
  if (selection === null) return undefined
  const model = state.groups.find(group => group.id === selection.provider)?.models.find(item => item.id === selection.model)
  const reasoning = model?.reasoning
  if (reasoning === undefined || !reasoning.efforts.some(item => item.id === 'off') || !reasoning.efforts.some(item => item.id !== 'off')) return undefined
  return {
    selection,
    reasoning,
    ...(selection.reasoningEffort ?? reasoning.defaultEffort) === undefined
      ? {}
      : { effectiveEffort: selection.reasoningEffort ?? reasoning.defaultEffort },
  }
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/gu, (_match, key: string) => values[key] ?? '')
}
