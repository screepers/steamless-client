import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'high-performance-webgl',
    description: 'Forces WebGL canvas to use high-performance mode.',
    disabled: true,
    match: (url: string) => url === 'vendor/renderer/renderer.js',
    async apply(src: string) {
        src = applyPatch(src, 's.options.powerPreference', '"high-performance"');
        return src;
    },
};
export default patch;
