import { Args } from '../clientApp.js';
import { clientAuth } from '../inject/clientAuth.js';
import { Server } from '../utils/server.js';
import { generateScriptTag } from '../utils/utils.js';
import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'client-auth',
    description: 'Manage settings in local storage and xxscreeps guest auth',
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
