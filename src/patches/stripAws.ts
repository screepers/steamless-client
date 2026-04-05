import { generateScriptTag } from '../utils/utils.js';
import { AWS_HOST, Server } from '../utils/server.js';
import { applyPatch, MultiPatch } from './helpers.js';
import { roomDecorations } from '../inject/roomDecorations.js';

const patch: MultiPatch = {
    id: 'strip-aws',
    description: '(Core) Replace references to AWS',
    patches: [
        {
            match: (url: string) => url === 'index.html',
            async apply(src: string, server: Server) {
                const { backend } = server;
                const header = '<title>Screeps</title>';
                const replaceHeader = [header, generateScriptTag(roomDecorations, { backend, awsHost: AWS_HOST })].join(
                    '\n',
                );
                src = applyPatch(src, header, replaceHeader);
                return src;
            },
        },
        {
            match: (url: string) => url === 'app2/main.js',
            async apply(src: string) {
                // Remove AWS host from rewards URL
                src = applyPatch(src, /https:\/\/s3\.amazonaws\.com/g, '');

                // Fix alpha map decoration loads to AWS by sending them through the proxy set up for the injected roomDecorations CORS fix
                // getTextureByUrl() in ./node_modules/@screeps/map/dist/utils.js
                src = applyPatch(
                    src,
                    /const img = await loadImage\(url\);/,
                    `const img = await loadImage(url.replace('${AWS_HOST}/static.screeps.com/', '/static.screeps.com/'));`,
                );
                return src;
            },
        },
    ],
};

export default patch;
