import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'

const NS = 'web-ui-promax'

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
  },
  zh: {
    reasoning: '推理', on: '开启', off: '关闭', aria: '推理：{state}', failed: '无法切换推理：{message}',
  },
}

const styles = `
.promax-root{position:relative;display:inline-flex;align-items:center}.promax-trigger{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}.promax-trigger:hover,.promax-trigger[aria-expanded=true]{background:var(--dsw-alias-bg-hover)}.promax-trigger:disabled{opacity:.4;cursor:default}.promax-chevron{width:12px;height:12px;transition:transform .15s ease}.promax-trigger[aria-expanded=true] .promax-chevron{transform:rotate(180deg)}.promax-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:80;min-width:150px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-l1);box-shadow:0 10px 32px rgba(0,0,0,.28)}.promax-menu-title{display:block;padding:5px 9px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.promax-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}.promax-option:hover{background:var(--dsw-alias-bg-hover)}.promax-check{width:14px;text-align:center;color:var(--dsw-alias-label-primary)}.promax-error{position:absolute;right:0;bottom:calc(100% + 48px);width:260px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:9px;background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
`

export const name = 'dsh-web-ui-promax'
export const inject = ['slots', 'locale', 'modelDirectories']

export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as { inject(key: string, cb: () => unknown): unknown; register(options: unknown, component: unknown): unknown } | undefined
  const locale = ctx.get('locale') as { bind(ns: string): (key: string, values?: Record<string, unknown>) => string; register(ns: string, value: unknown): unknown } | undefined
  const modelDirectories = ctx.get('modelDirectories') as ModelDirectories | undefined
  if (!slots || !locale || !modelDirectories) return
  const t = locale.bind(NS)
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
