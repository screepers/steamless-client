import { applyPatch, Patch } from './helpers';
import { Server } from 'utils/server';

const patch: Patch = {
    id: 'broken-replays',
    description: 'Workaround some data problems with history files',
    match: (url: string) => url === 'vendor/renderer/renderer.js',
    async apply(src: string, _server: Server) {
        // The server sometimes sends completely broken objects which break the viewer
        // https://discord.com/channels/860665589738635336/1337213532198142044
        src = applyPatch(
            src,
            't.forEach(t=>{null!==t.x&&null!==t.y&&(e(t)&&(i[t.x][t.y]=t,a=!0),o[t.x][t.y]=!1)})',
            't.forEach((t)=>{!(null===t.x||undefined===t.x)&&!(null===t.y||undefined===t.y)&&(e(t)&&((i[t.x][t.y]=t),(a=!0)),(o[t.x][t.y]=!1));});',
        );
        return src;
    },
};

export default patch;
