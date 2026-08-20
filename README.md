# dsh-web-ui-promax

An external DeepSeek Harness plugin that gives every declared self-hosted model the same native reasoning controls as supported official models and adds a persistent UI effect.

## Behavior

- Native **Effort** levels: Off, Medium, High, Max.
- **High** is the default.
- A localized **Reasoning** On/Off control appears beside the model selector.
- Reasoning Off selects native effort `off`; Reasoning On restores the last enabled effort, defaulting to High.
- New models and providers added through Harness settings are discovered automatically; no provider or model id is hard-coded.
- Request dialect is inferred per model (including DeepSeek and Qwen), while an explicit provider/model compatibility declaration always wins.
- A model explicitly marked `reasoningEfforts: false` remains non-reasoning.
- **Settings → General → UI Effects → Original UI** removes every ProMax visual override and restores Harness's native appearance.
- **Settings → General → UI Effects → iOS** combines Swift Glass motion with a Liquid Glass interface.
- The effect is stored in the Harness host profile, survives refresh, follows the active light/dark theme, and respects reduced-motion preferences.
- The UI Effects row is intentionally extensible; additional effects can be added later.
- For an OpenAI-compatible DeepSeek endpoint the wire mapping is:
  - Off: `thinking: {type: "disabled"}`
  - Medium/High/Max: `thinking: {type: "enabled"}` plus the matching `reasoning_effort`

The plugin does not replace or patch DeepSeek Harness source. It augments declared `llm-pi-ai` profiles through the public settings seam and uses the official composer slot and per-session model directory.

## Configuration

The included bundle defaults to:

```yaml
providers: []
defaultEffort: high
```

Models must be declared in the `llm-pi-ai` settings section. An optional `providers` array limits discovery to named provider ids; leaving it empty (the default) covers every declared local provider. Endpoint and credential ownership remain with that adapter and are never copied into the browser.
