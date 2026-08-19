# dsh-web-ui-promax

An external DeepSeek Harness plugin that gives a declared self-hosted model the same native reasoning controls as supported official models and adds a persistent UI effect.

## Behavior

- Native **Effort** levels: Off, Medium, High, Max.
- **High** is the default.
- A localized **Reasoning** On/Off control appears beside the model selector.
- Reasoning Off selects native effort `off`; Reasoning On restores the last enabled effort, defaulting to High.
- **Settings → General → UI Effects → Original UI** removes every ProMax visual override and restores Harness's native appearance.
- **Settings → General → UI Effects → iOS** combines Swift Glass motion with a Liquid Glass interface.
- The effect is stored in the Harness host profile, survives refresh, follows the active light/dark theme, and respects reduced-motion preferences.
- The UI Effects row is intentionally extensible; additional effects can be added later.
- For an OpenAI-compatible DeepSeek endpoint the wire mapping is:
  - Off: `thinking: {type: "disabled"}`
  - Medium/High/Max: `thinking: {type: "enabled"}` plus the matching `reasoning_effort`

The plugin does not replace or patch DeepSeek Harness source. It augments the target `llm-pi-ai` profile through the public settings seam and uses the official composer slot and per-session model directory.

## Configuration

The included bundle defaults to:

```yaml
provider: deepseek-v4-flash
model: deepseek-v4-flash
defaultEffort: high
```

The provider/model must already exist in the `llm-pi-ai` settings section. Endpoint and credential ownership remain with that adapter and are never copied into the browser.
