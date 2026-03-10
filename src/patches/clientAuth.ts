import { Args } from '../clientApp';
import { clientAuth } from '../inject/clientAuth';
import { Server } from '../utils/server';
import { generateScriptTag } from '../utils/utils';
import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'client-auth',
    match: (url: string) => url === 'index.html',
    async apply(src: string, server: Server, argv: Args) {
        const { backend } = server;

        // Inject startup script
        const header = '<title>Screeps</title>';
        const replaceHeader = [header, generateScriptTag(clientAuth, { backend, guest: argv.guest })].join('\n');
        src = applyPatch(src, header, replaceHeader);
        return src;
    },
};

export default patch;
