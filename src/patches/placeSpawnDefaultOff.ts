import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'place-spawn-default-off',
    description: "Remove the default-to-place-spawn behavior when you're not spawned in",
    match: (url: string) => url === 'build.min.js',
    async apply(src: string) {
        src = applyPatch(
            src,
            'h.get("user/world-status").then(function(t){"empty"==t.status&&(P.selectedAction.action="spawn",',
            'h.get("user/world-status").then(function(t){"empty"==t.status&&(',
        );
        return src;
    },
};

export default patch;
