import { applyPatch, MultiPatch } from './helpers.js';

const patch: MultiPatch = {
    id: 'worldMapNewTab',
    description: 'Patch buttons to support ctrl/meta-click open in new tab',
    patches: [
        {
            match: (url) => url === 'components/game/room/room.html',
            async apply(source) {
                source = applyPatch(source, /(<md:button class='md-raised' ng-click='Room\.goToMap\()/, '$1$event');
                return source;
            },
        },
        {
            match: (url: string) => url === 'build.min.js',
            async apply(src: string) {
                function patchFunc(u: string, v: { url: (arg: string) => void; $$absUrl: string }) {
                    /* eslint-disable-next-line prefer-rest-params */
                    const event: PointerEvent = arguments[0];
                    if (event.ctrlKey || event.metaKey) {
                        const prefix = v.$$absUrl.substring(0, v.$$absUrl.indexOf('#!') + 2);
                        const url = prefix + u;
                        window.open(url, '_blank');
                    } else {
                        v.url(u);
                    }
                }
                const patch = patchFunc
                    .toString()
                    .split('\n')
                    .slice(2, -1)
                    .map((s) => s.replace(/^\s+/, ''))
                    .join('');
                src = applyPatch(
                    src,
                    /v\.url\((f\.getSegmentUrl\("top\.game-world-map"\)\+"\?pos="\+\(o\+\.5\)\+","\+\(r\+\.5\))\)/,
                    'let u = $1;' + patch.toString().replaceAll('$', () => '$$'),
                );
                return src;
            },
        },
    ],
};

export default patch;

// this.goToMap=function(){
//     var e = w.roomNameToXY(b.room),
//         t=_slicedToArray(e,2),
//         o=t[0],
//         r=t[1];
//     let u = f.getSegmentUrl("top.game-world-map")+"?pos="+(o+.5)+","+(r+.5);
//     const event = arguments[0];
//     if (event.ctrlKey || event.metaKey) {
//         window.open(u);
//     } else {
//         v.url(u);
//     }
