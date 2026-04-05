import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'normalize-string-posix',
    description: 'Protect URL-like shenanigans',
    match: (url: string) => url === 'vendor/renderer/renderer.js',
    async apply(src: string) {
        // `normalizeStringPosix`, a Pixi function, gets passed our janky URLs
        // thinking they're paths. Protect the :// from them so those don't get folded
        // and break loading of user badges
        src = applyPatch(
            src,
            /if \(code === 47\) {/,
            'if (code === 47 && !(i > 0 && path2.charCodeAt(i - 1) === 58)) {',
        );
        return src;
    },
};

export default patch;
