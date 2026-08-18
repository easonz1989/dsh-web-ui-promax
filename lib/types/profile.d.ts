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
