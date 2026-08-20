import { readFile } from 'node:fs/promises'

const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const marker of ['dsh-web-ui-promax', 'llm-pi-ai', 'promoteAllProviderModels', 'settings/updated', 'reasoningEfforts', 'supportsReasoningEffort', 'deepseek', 'qwen', '/web-ui-promax', 'uiEffect', 'original', 'ios']) {
  if (!host.includes(marker)) throw new Error(`host bundle missing required marker: ${marker}`)
}
const plugin = await import(new URL('../lib/index.js', import.meta.url))
if ('default' in plugin) throw new Error('default export collapses the Cordis namespace')
if (JSON.stringify(plugin.inject) !== JSON.stringify(['settings', 'connection'])) throw new Error('host settings/connection injection missing')
if (typeof plugin.apply !== 'function') throw new Error('Cordis apply export missing')

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
for (const marker of ['dsh-web-ui-promax', 'conversation.input.right', 'settings.general.item', 'Reasoning', '推理', 'UI Effects', 'UI 特效', 'Original UI', '原生界面', 'Swift Glass', 'Liquid Glass', 'More effects coming soon', 'modelDirectories']) {
  if (!client.includes(marker)) throw new Error(`client bundle missing required marker: ${marker}`)
}
for (const forbidden of ['node:fs', 'DEEPSEEK_V4_FLASH_API_KEY', 'apiKey']) {
  if (client.includes(forbidden)) throw new Error(`client bundle leaks server-only marker: ${forbidden}`)
}
const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
for (const forbidden of ['provider: deepseek-v4-flash', 'model: deepseek-v4-flash']) {
  if (patch.includes(forbidden)) throw new Error(`Cordis patch retains hard-coded model target: ${forbidden}`)
}
console.log('dsh-web-ui-promax bundle contract: pass')
