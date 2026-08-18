import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Effort } from './profile.ts';
export { promoteProvider, REASONING_COMPAT, REASONING_EFFORTS } from './profile.ts';
export type { Effort, ModelProfile, ProviderProfile, PromotedProvider } from './profile.ts';
export declare const name = "dsh-web-ui-promax";
export declare const inject: string[];
export interface Config {
    provider?: string;
    model?: string;
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
