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
const GENERIC_REASONING_EFFORTS = Object.freeze({
	off: null,
	medium: "medium",
	high: "high",
	max: "max"
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
/**
* Add reasoning controls to every declared model on one generic local route.
* Explicit `reasoningEfforts: false` remains authoritative. Existing model or
* provider dialect settings win; otherwise the dialect is inferred from the
* provider id, model id, and endpoint rather than hard-coded to DeepSeek.
*/
function promoteAllProviderModels(source, providerId, defaultEffort) {
	if (!Array.isArray(source.models) || source.models.length === 0) throw new Error(`dsh-web-ui-promax: provider "${providerId}" has no explicit models list`);
	let changed = source.reasoning !== defaultEffort;
	const providerCompat = isRecord(source.compat) ? source.compat : {};
	const models = source.models.map((raw) => {
		if (!isRecord(raw) || typeof raw.id !== "string" || raw.id.trim().length === 0) throw new Error(`dsh-web-ui-promax: provider "${providerId}" contains a model without an id`);
		if (raw.reasoningEfforts === false) return raw;
		const format = inferThinkingFormat(providerId, source, raw);
		const compat = isRecord(raw.compat) ? raw.compat : {};
		const desired = {
			...raw,
			reasoningEfforts: format === "deepseek" ? { ...REASONING_EFFORTS } : { ...GENERIC_REASONING_EFFORTS },
			compat: {
				...compat,
				...compat.thinkingFormat === void 0 && providerCompat.thinkingFormat === void 0 ? { thinkingFormat: format } : {},
				...compat.supportsReasoningEffort === void 0 && providerCompat.supportsReasoningEffort === void 0 ? { supportsReasoningEffort: true } : {}
			}
		};
		if (!sameJson(raw, desired)) changed = true;
		return desired;
	});
	return {
		profile: {
			...source,
			reasoning: defaultEffort,
			models
		},
		changed
	};
}
function inferThinkingFormat(providerId, source, model) {
	const modelCompat = isRecord(model.compat) ? model.compat : {};
	const providerCompat = isRecord(source.compat) ? source.compat : {};
	const declared = modelCompat.thinkingFormat ?? providerCompat.thinkingFormat;
	if (isThinkingFormat(declared)) return declared;
	const fingerprint = [
		providerId,
		model.id,
		source.baseURL
	].map((value) => String(value ?? "").toLowerCase()).join(" ");
	if (fingerprint.includes("qwen")) return "qwen";
	if (fingerprint.includes("deepseek") || fingerprint.includes("dsv4")) return "deepseek";
	if (fingerprint.includes("openrouter")) return "openrouter";
	if (fingerprint.includes("together")) return "together";
	if (fingerprint.includes("zai") || fingerprint.includes("z.ai") || fingerprint.includes("glm")) return "zai";
	return "openai";
}
function isThinkingFormat(value) {
	return value === "openai" || value === "deepseek" || value === "openrouter" || value === "together" || value === "zai" || value === "qwen";
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
const UI_EFFECTS = ["original", "ios"];
const UI_SETTINGS_SCHEMA = z.object({ uiEffect: z.union(UI_EFFECTS).default("original") });
const Config = z.object({
	providers: z.array(z.string()).default([]),
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
	const uiSettings = ctx.settings.register(UI_SETTINGS_NAMESPACE, UI_SETTINGS_SCHEMA, { base: { uiEffect: "original" } });
	ctx.connection.rpc.handle("/web-ui-promax", async (endpoint, payload) => {
		try {
			if (endpoint === "get-ui-effect") return ok({ uiEffect: uiSettings.get().uiEffect });
			if (endpoint === "set-ui-effect") {
				const value = payload?.uiEffect;
				if (!isUiEffect(value)) return fail("uiEffect must be original or ios");
				await uiSettings.update({ uiEffect: value });
				return ok({ uiEffect: uiSettings.get().uiEffect });
			}
			return fail(`unknown endpoint: ${endpoint}`);
		} catch (error) {
			return fail((error instanceof Error ? error.message : String(error)).slice(0, 500));
		}
	}, { authority: "trusted-host" });
	const providerAllowlist = new Set((config.providers ?? []).map((provider) => nonBlank(provider, "providers entry")));
	const defaultEffort = config.defaultEffort ?? "high";
	let attempts = 0;
	let timer;
	const schedule = (delay) => {
		if (timer !== void 0) return;
		timer = setTimeout(() => {
			timer = void 0;
			reconcile().catch(reportFailure);
		}, delay);
	};
	ctx.effect(() => () => {
		if (timer !== void 0) clearTimeout(timer);
	}, "dsh-web-ui-promax: settings reconciliation");
	ctx.on("settings/updated", (namespace) => {
		if (namespace === PI_AI_NAMESPACE) schedule(0);
	});
	const reconcile = async () => {
		attempts += 1;
		const providers = ctx.settings.get(PI_AI_NAMESPACE)?.providers;
		if (providers === void 0 || Object.keys(providers).length === 0) {
			if (attempts < 150) schedule(100);
			else ctx.logger.warn("dsh-web-ui-promax: no providers appeared in llm-pi-ai settings; leaving Harness operational");
			return;
		}
		attempts = 0;
		const operations = [];
		const promotedProviders = [];
		for (const [providerId, source] of Object.entries(providers)) {
			if (providerAllowlist.size > 0 && !providerAllowlist.has(providerId)) continue;
			const promoted = promoteAllProviderModels(source, providerId, defaultEffort);
			if (!promoted.changed) continue;
			operations.push({
				op: "set",
				path: [
					"providers",
					providerId,
					"reasoning"
				],
				value: defaultEffort
			}, {
				op: "set",
				path: [
					"providers",
					providerId,
					"models"
				],
				value: promoted.profile.models
			});
			promotedProviders.push(providerId);
		}
		if (operations.length === 0) return;
		await ctx.settings.mutate(PI_AI_NAMESPACE, operations);
		ctx.logger.info("dsh-web-ui-promax: enabled native reasoning controls for providers: %s", promotedProviders.join(", "));
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
	return value === "original" || value === "ios";
}
function nonBlank(value, field) {
	const normalized = value.trim();
	if (normalized.length === 0) throw new Error(`dsh-web-ui-promax: ${field} must be non-empty`);
	return normalized;
}
//#endregion
export { Config, REASONING_COMPAT, REASONING_EFFORTS, UI_EFFECTS, UI_SETTINGS_NAMESPACE, UI_SETTINGS_SCHEMA, apply, inferThinkingFormat, inject, isUiEffect, name, promoteAllProviderModels, promoteProvider };

//# sourceMappingURL=index.js.map