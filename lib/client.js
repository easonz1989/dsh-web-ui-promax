window.__ModuleLoader__.load({
	id: "dsh-web-ui-promax",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		const NS = "web-ui-promax";
		const dict = {
			en: {
				reasoning: "Reasoning",
				on: "On",
				off: "Off",
				aria: "Reasoning: {state}",
				failed: "Could not change reasoning: {message}"
			},
			zh: {
				reasoning: "推理",
				on: "开启",
				off: "关闭",
				aria: "推理：{state}",
				failed: "无法切换推理：{message}"
			}
		};
		const styles = `
.promax-root{position:relative;display:inline-flex;align-items:center}.promax-trigger{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}.promax-trigger:hover,.promax-trigger[aria-expanded=true]{background:var(--dsw-alias-bg-hover)}.promax-trigger:disabled{opacity:.4;cursor:default}.promax-chevron{width:12px;height:12px;transition:transform .15s ease}.promax-trigger[aria-expanded=true] .promax-chevron{transform:rotate(180deg)}.promax-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:80;min-width:150px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-l1);box-shadow:0 10px 32px rgba(0,0,0,.28)}.promax-menu-title{display:block;padding:5px 9px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.promax-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}.promax-option:hover{background:var(--dsw-alias-bg-hover)}.promax-check{width:14px;text-align:center;color:var(--dsw-alias-label-primary)}.promax-error{position:absolute;right:0;bottom:calc(100% + 48px);width:260px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:9px;background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
`;
		const name = "dsh-web-ui-promax";
		const inject = [
			"slots",
			"locale",
			"modelDirectories"
		];
		function apply(ctx) {
			const slots = ctx.get("slots");
			const locale = ctx.get("locale");
			const modelDirectories = ctx.get("modelDirectories");
			if (!slots || !locale || !modelDirectories) return;
			const t = locale.bind(NS);
			ctx.effect(() => {
				const dispose = locale.register(NS, dict);
				return () => {
					if (typeof dispose === "function") dispose();
				};
			}, "dsh-web-ui-promax: dictionaries");
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset["dshWebUiPromax"] = "true";
				style.textContent = styles;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, "dsh-web-ui-promax: styles");
			slots.inject("conversation.input.right", () => slots.register({
				name: "conversation.input.right",
				id: "web-ui-promax-reasoning",
				order: 90,
				locale: NS,
				inject: (sessionId) => ({
					directory: modelDirectories.directoryFor(sessionId),
					t
				})
			}, ReasoningControl));
		}
		function ReasoningControl({ directory, t }) {
			const state = (0, react.useSyncExternalStore)((listener) => directory.store.subscribe(listener), () => directory.store.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const lastEnabled = (0, react.useRef)("high");
			const current = currentReasoning(state);
			const effective = current?.effectiveEffort;
			const enabled = effective !== void 0 && effective !== "off";
			(0, react.useEffect)(() => {
				if (enabled && effective !== void 0) lastEnabled.current = effective;
			}, [enabled, effective]);
			(0, react.useEffect)(() => {
				if (state.current !== null && state.groups.length === 0) directory.load().catch(() => void 0);
			}, [
				directory,
				state.current,
				state.groups.length
			]);
			if (current === void 0) return null;
			const busy = state.status === "selecting";
			const choose = async (nextEnabled) => {
				setError("");
				setOpen(false);
				const nonOff = current.reasoning.efforts.filter((item) => item.id !== "off").map((item) => item.id);
				const preferred = nonOff.includes(lastEnabled.current) ? lastEnabled.current : nonOff.includes("high") ? "high" : nonOff[0];
				const effort = nextEnabled ? preferred : "off";
				if (effort === void 0 || effort === effective) return;
				try {
					await directory.select({
						provider: current.selection.provider,
						model: current.selection.model,
						reasoningEffort: effort
					});
				} catch (cause) {
					setError(format(t("failed"), { message: messageOf(cause) }));
				}
			};
			const stateLabel = enabled ? t("on") : t("off");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "promax-root",
				onBlur: (event) => {
					if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "promax-trigger",
						"aria-haspopup": "menu",
						"aria-expanded": open,
						"aria-label": format(t("aria"), { state: stateLabel }),
						disabled: busy,
						onClick: () => setOpen((value) => !value),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reasoning") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: stateLabel }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
								className: "promax-chevron",
								viewBox: "0 0 12 12",
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: "m3 4.5 3 3 3-3",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.4",
									strokeLinecap: "round",
									strokeLinejoin: "round"
								})
							})
						]
					}),
					open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "promax-menu",
						role: "menu",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "promax-menu-title",
							children: t("reasoning")
						}), [true, false].map((value) => {
							const label = value ? t("on") : t("off");
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": enabled === value,
								className: "promax-option",
								onClick: () => {
									choose(value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "promax-check",
									children: enabled === value ? "✓" : ""
								})]
							}, String(value));
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "promax-error",
						role: "alert",
						children: error
					})
				]
			});
		}
		function currentReasoning(state) {
			const selection = state.current;
			if (selection === null) return void 0;
			const reasoning = (state.groups.find((group) => group.id === selection.provider)?.models.find((item) => item.id === selection.model))?.reasoning;
			if (reasoning === void 0 || !reasoning.efforts.some((item) => item.id === "off") || !reasoning.efforts.some((item) => item.id !== "off")) return void 0;
			return {
				selection,
				reasoning,
				...(selection.reasoningEffort ?? reasoning.defaultEffort) === void 0 ? {} : { effectiveEffort: selection.reasoningEffort ?? reasoning.defaultEffort }
			};
		}
		function messageOf(value) {
			return value instanceof Error ? value.message : String(value);
		}
		function format(template, values) {
			return template.replace(/\{(\w+)\}/gu, (_match, key) => values[key] ?? "");
		}
		//#endregion
		exports.apply = apply;
		exports.currentReasoning = currentReasoning;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map