import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Effort } from './profile.ts';
export { inferThinkingFormat, promoteAllProviderModels, promoteProvider, REASONING_COMPAT, REASONING_EFFORTS } from './profile.ts';
export type { Effort, ModelProfile, ProviderProfile, PromotedProvider, ThinkingFormat } from './profile.ts';
export declare const name = "dsh-web-ui-promax";
export declare const inject: string[];
export declare const UI_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export declare const UI_EFFECTS: readonly ["original", "ios"];
export type UiEffect = (typeof UI_EFFECTS)[number];
export interface UiSettings {
    uiEffect: UiEffect;
}
export declare const UI_SETTINGS_SCHEMA: z<UiSettings>;
export interface Config {
    providers?: string[];
    defaultEffort?: Effort;
}
export declare const Config: z<Config>;
/**
 * Reconcile the generic adapter's public settings schema once. The adapter
 * remains the request owner; this plugin only declares capabilities the exact
 * self-hosted route was missing, so the native Model/Effort selector and
 * session persistence continue to work unchanged.
 */
export declare function apply(ctx: Context, config: Config): void;
export declare function isUiEffect(value: unknown): value is UiEffect;
