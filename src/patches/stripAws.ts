import { generateScriptTag } from 'utils/utils';
import { AWS_HOST, Server } from '../utils/server';
import { applyPatch, MultiPatch } from './helpers';
import { roomDecorations } from 'inject/roomDecorations';

const patch: MultiPatch = {
    id: 'strip-aws',
    description: '(Core) Replace references to AWS',
    patches: [
        {
            match: (url: string) => url === 'index.html',
            async apply(src: string, server: Server) {
                const { backend } = server;
                const header = '<title>Screeps</title>';
                const replaceHeader = [header, generateScriptTag(roomDecorations, { backend, AWS_HOST })].join('\n');
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
        {
            match: (url: string) => url === 'vendor/renderer/renderer.js',
            async apply(src: string) {
                // Modify renderer to remove AWS host from loadElement()
                src = applyPatch(
                    src,
                    /\(this\.data\.src=this\.url\)/g,
                    `(this.data.src=this.url.replace("${AWS_HOST}",""))`,
                );
                // Remove AWS host from image URLs
                src = applyPatch(src, /src=t,/g, `src=t.replace("${AWS_HOST}",""),`);
                return src;
            },
        },
    ],
};

export default patch;
