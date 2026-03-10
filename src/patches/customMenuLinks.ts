import { customMenuLinks } from '../inject/customMenuLinks';
import { Route, Server } from '../utils/server';
import { generateScriptTag } from '../utils/utils';
import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'custom-menu-links',
    match: (url: string) => url === 'index.html',
    async apply(src: string, server: Server) {
        const { backend, isOfficial } = server;
        // Client app menu links
        const seasonLink = isOfficial
            ? server.getURL(Route.ROOT, { backend: 'https://screeps.com/season', path: false })
            : server.getURL(Route.ROOT, { path: false });
        const ptrLink = isOfficial
            ? server.getURL(Route.ROOT, { backend: 'https://screeps.com/ptr', path: false })
            : undefined;
        const changeServerLink = server.getURL(Route.ROOT, { subdomain: false, backend: false, path: false });

        // Inject startup script
        const header = '<title>Screeps</title>';
        const replaceHeader = [
            header,
            generateScriptTag(customMenuLinks, { backend, seasonLink, ptrLink, changeServerLink }),
        ].join('\n');
        src = applyPatch(src, header, replaceHeader);
        return src;
    },
};

export default patch;
