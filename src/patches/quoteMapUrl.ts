import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'quote-map-url',
    description: 'Quote the CSS url() of the world map tiles so the (backend) path survives the CSS parser',
    match: (url: string) => url === 'components/game/world-map/world-map.html',
    async apply(src: string) {
        // The three `map-sector` templates build their tile background as an unquoted `url(...)`:
        //   'background-image': 'url('+WorldMap.mapUrl.base+sector.name+'.png?'+WorldMap.mapUrl.query+')'
        // `fix-config` rewrites the CDN base to our proxy form `/(https://backend)/assets/map/…`, and an
        // unquoted url-token can't hold parentheses — it ends at the first `)`, so the CSS parser drops the
        // whole declaration. No background, no request, no error. Quoting the url fixes it.
        //
        // This only bites servers that report the `official-like` feature (xxscreeps), since `fix-config`
        // rewrites the official branch of the client's mapUrl ternary; the private server branch builds its
        // url from `options.host`/`options.port` and never contains parentheses.
        //
        // Angular's expression lexer understands `\'` escapes, so the quotes go in as escaped literals.
        src = applyPatch(src, /'url\('\+/g, "'url(\\''+");
        src = applyPatch(src, /\+'\)'/g, "+'\\')'");
        return src;
    },
};

export default patch;
