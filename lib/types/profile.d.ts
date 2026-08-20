export type Effort = 'off' | 'medium' | 'high' | 'max';
export interface ModelProfile {
    id?: unknown;
    [key: string]: unknown;
}
export interface ProviderProfile {
    models?: unknown;
    reasoning?: unknown;
    [key: string]: unknown;
}
export interface PromotedProvider {
    profile: ProviderProfile;
    changed: boolean;
}
export type ThinkingFormat = 'openai' | 'deepseek' | 'openrouter' | 'together' | 'zai' | 'qwen';
export declare const REASONING_EFFORTS: Readonly<{
    off: "none";
    medium: "medium";
    high: "high";
    max: "max";
}>;
export declare const REASONING_COMPAT: Readonly<{
    thinkingFormat: "deepseek";
    supportsReasoningEffort: true;
}>;
/**
 * Add native Harness reasoning metadata to one already-declared model while
 * preserving every endpoint, credential, capacity and unrelated model field.
 */
export declare function promoteProvider(source: ProviderProfile, modelId: string, defaultEffort: Effort): PromotedProvider;
/**
 * Add reasoning controls to every declared model on one generic local route.
 * Explicit `reasoningEfforts: false` remains authoritative. Existing model or
 * provider dialect settings win; otherwise the dialect is inferred from the
 * provider id, model id, and endpoint rather than hard-coded to DeepSeek.
 */
export declare function promoteAllProviderModels(source: ProviderProfile, providerId: string, defaultEffort: Effort): PromotedProvider;
export declare function inferThinkingFormat(providerId: string, source: ProviderProfile, model: ModelProfile): ThinkingFormat;
