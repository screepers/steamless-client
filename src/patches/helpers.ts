import { Args } from '../clientApp.js';
import { Server } from '../utils/server.js';

interface Patcher {
    match: (url: string) => boolean;
    apply(source: string, server: Server, args: Args): Promise<string>;
}

interface PatchBase {
    /** Identifier for the patch */
    id: string;
    /** A short description; used by --list_patches */
    description: string;
    /** Whether this patch is disabled by default */
    disabled?: true;
}

export type Patch = PatchBase & Patcher;
export type MultiPatch = PatchBase & { patches: Patcher[] };

export type AnyPatch = Patch | MultiPatch;

export class PatchError extends Error {
    original: string | RegExp;
    constructor(original: string | RegExp) {
        super('failed to apply patch!');
        this.original = original;
    }
}

export function applyPatch(data: string, original: string | RegExp, replace: string) {
    const repl = data.replace(original, replace);
    if (data.localeCompare(repl) === 0) {
        throw new PatchError(original);
    }
    return repl;
}
