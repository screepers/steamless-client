import { addScreepsAudio } from '../inject/screepsAudio.js';
import { generateScriptTag } from '../utils/utils.js';
import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'screeps-audio',
    description: 'Make the game play some audio effects',
    disabled: true,
    match: (url: string) => url === 'index.html',
    async apply(src: string) {
        const header = '<title>Screeps</title>';
        const replaceHeader = [header, generateScriptTag(addScreepsAudio, {})].join('\n');
        src = applyPatch(src, header, replaceHeader);
        return src;
    },
};

export default patch;
