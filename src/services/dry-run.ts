import { Context } from 'effect';

/** True only when provided by the dry-run apply layer. */
export const DryRun = Context.GenericTag<boolean>('DryRun');
