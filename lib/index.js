import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
//#region src/profile.ts
const REASONING_EFFORTS = Object.freeze({
	off: "none",
	medium: "medium",
	high: "high",
	max: "max"
});
const REASONING_COMPAT = Object.freeze({
	thinkingFormat: "deepseek",
	supportsReasoningEffort: true
});
/**
* Add native Harness reasoning metadata to one already-declared model while
* preserving every endpoint, credential, capacity and unrelated model field.
*/
function promoteProvider(source, modelId, defaultEffort) {
	if (!Array.isArray(source.models)) throw new Error("dsh-web-ui-promax: target provider has no explicit models list");
	let found = false;
	let changed = source.reasoning !== defaultEffort;
	const models = source.models.map((raw) => {
		if (!isRecord(raw) || raw.id !== modelId) return raw;
		found = true;
		const desired = {
			...raw,
			reasoningEfforts: { ...REASONING_EFFORTS },
			compat: {
				...isRecord(raw.compat) ? raw.compat : {},
				...REASONING_COMPAT
			}
		};
		if (!sameJson(raw, desired)) changed = true;
		return desired;
	});
	if (!found) throw new Error(`dsh-web-ui-promax: target model "${modelId}" is not declared`);
	return {
		profile: {
			...source,
			reasoning: defaultEffort,
			models
		},
		changed
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}
//#endregion
//#region src/index.ts
const name = "dsh-web-ui-promax";
const inject = ["settings", "connection"];
const PI_AI_NAMESPACE = settingsNamespace("llm-pi-ai");
const UI_SETTINGS_NAMESPACE = settingsNamespace("web-ui-promax");
const UI_EFFECTS = ["ios"];
const UI_SETTINGS_SCHEMA = z.object({ uiEffect: z.union(UI_EFFECTS).default("ios") });
const Config = z.object({
	provider: z.string().default("deepseek-v4-flash"),
	model: z.string().default("deepseek-v4-flash"),
	defaultEffort: z.union([
		"off",
		"medium",
		"high",
		"max"
	]).default("high")
});
/**
* Reconcile the generic adapter's public settings schema once. The adapter
* remains the request owner; this plugin only declares capabilities the exact
* self-hosted route was missing, so the native Model/Effort selector and
* session persistence continue to work unchanged.
*/
function apply(ctx, config) {
	const uiSettings = ctx.settings.register(UI_SETTINGS_NAMESPACE, UI_SETTINGS_SCHEMA, { base: { uiEffect: "ios" } });
	ctx.connection.rpc.handle("/web-ui-promax", async (endpoint, payload) => {
		try {
			if (endpoint === "get-ui-effect") return ok({ uiEffect: uiSettings.get().uiEffect });
			if (endpoint === "set-ui-effect") {
				const value = payload?.uiEffect;
				if (!isUiEffect(value)) return fail("uiEffect must be ios");
				await uiSettings.update({ uiEffect: value });
				return ok({ uiEffect: uiSettings.get().uiEffect });
			}
			return fail(`unknown endpoint: ${endpoint}`);
		} catch (error) {
			return fail((error instanceof Error ? error.message : String(error)).slice(0, 500));
		}
	}, { authority: "trusted-host" });
	const provider = nonBlank(config.provider, "provider");
	const model = nonBlank(config.model, "model");
	const defaultEffort = config.defaultEffort ?? "high";
	let attempts = 0;
	let timer;
	const schedule = (delay) => {
		timer = setTimeout(() => {
			timer = void 0;
			reconcile().catch(reportFailure);
		}, delay);
	};
	ctx.effect(() => () => {
		if (timer !== void 0) clearTimeout(timer);
	}, "dsh-web-ui-promax: settings reconciliation");
	const reconcile = async () => {
		attempts += 1;
		const source = ctx.settings.get(PI_AI_NAMESPACE)?.providers?.[provider];
		if (source === void 0) {
			if (attempts < 150) schedule(100);
			else ctx.logger.warn("dsh-web-ui-promax: provider \"%s\" did not appear in llm-pi-ai settings; leaving Harness operational", provider);
			return;
		}
		const promoted = promoteProvider(source, model, defaultEffort);
		if (!promoted.changed) return;
		await ctx.settings.mutate(PI_AI_NAMESPACE, [{
			op: "set",
			path: [
				"providers",
				provider,
				"reasoning"
			],
			value: defaultEffort
		}, {
			op: "set",
			path: [
				"providers",
				provider,
				"models"
			],
			value: promoted.profile.models
		}]);
		ctx.logger.info("dsh-web-ui-promax: enabled native reasoning controls for %s/%s", provider, model);
	};
	const reportFailure = (error) => {
		ctx.logger.error("dsh-web-ui-promax: failed to reconcile native reasoning controls");
		ctx.logger.error(error);
	};
	schedule(0);
}
function ok(value) {
	return {
		ok: true,
		value
	};
}
function fail(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
function isUiEffect(value) {
	return value === "ios";
}
function nonBlank(value, field) {
	const normalized = value?.trim();
	if (normalized === void 0 || normalized.length === 0) throw new Error(`dsh-web-ui-promax: ${field} must be non-empty`);
	return normalized;
}
//#endregion
export { Config, REASONING_COMPAT, REASONING_EFFORTS, UI_EFFECTS, UI_SETTINGS_NAMESPACE, UI_SETTINGS_SCHEMA, apply, inject, isUiEffect, name, promoteProvider };

//# sourceMappingURL=index.js.map