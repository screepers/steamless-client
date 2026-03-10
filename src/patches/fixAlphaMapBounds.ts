import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'fix-alpha-map-bounds',
    match: (url: string) => url === 'app2/main.js',
    async apply(src: string) {
        // Bounds fix for the alpha map
        // ./node_modules/@screeps/map/dist/constants.js
        src = applyPatch(src, /exports\.MIN_SCALE = \.4;/, 'exports.MIN_SCALE = .3');

        // ./src2/app/world-map.module/world-map-size.resolver.ts
        src = applyPatch(
            src,
            /resolve\({ width: width, height: height }\);/,
            "resolve(shard !== 'shardSeason' ? { width: width, height: height } : { width: 512, height: 512 });",
        );
        return src;
    },
};
export default patch;
