import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'quiet-console',
    disabled: true,
    description: "Nop out the console.logs that dump the Game's console into DevTools",
    match: (url: string) => url === 'build.min.js',
    async apply(src: string) {
        src = applyPatch(
            src,
            /\(e\.messages\.log\.forEach\(function\(e\){return window\.console\.log\(e\)}\)/,
            '(e.messages.log.forEach(function(e){return undefined})',
        );
        src = applyPatch(
            src,
            /e\.messages\.results\.forEach\(function\(e\){return window\.console\.log\(e\)}\)/,
            'e.messages.results.forEach(function(e){return undefined})',
        );
        src = applyPatch(src, /e\.error&&window\.console\.error\(e\.error\)/, 'e.error&&undefined');
        return src;
    },
};

export default patch;
