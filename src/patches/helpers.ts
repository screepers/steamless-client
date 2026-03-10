import { Args } from 'clientApp';
import { Server } from 'utils/server';

interface PatchBase {
    match: (url: string) => boolean;
    apply(source: string, server: Server, args: Args): Promise<string>;
}

export type Patch = { id: string } & PatchBase;
export type MultiPatch = { id: string; patches: PatchBase[] };

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
