import type { Context } from '@deepseek-ai/cordis';
export declare const UI_EFFECTS: readonly ["ios"];
export type UiEffect = (typeof UI_EFFECTS)[number];
type ModelSelection = {
    provider: string;
    model: string;
    reasoningEffort?: string;
};
type Reasoning = {
    efforts: Array<{
        id: string;
        name: string;
    }>;
    defaultEffort?: string;
};
type Model = {
    id: string;
    reasoning?: Reasoning;
};
type Group = {
    id: string;
    models: Model[];
};
type DirectoryState = {
    current: ModelSelection | null;
    groups: Group[];
    status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error';
    error: string | null;
};
export declare const name = "dsh-web-ui-promax";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
export declare function isUiEffect(value: unknown): value is UiEffect;
export declare function applyUiEffect(root: {
    dataset: DOMStringMap;
}, effect: UiEffect): void;
export declare function currentReasoning(state: DirectoryState): {
    selection: ModelSelection;
    reasoning: Reasoning;
    effectiveEffort?: string;
} | undefined;
export {};
