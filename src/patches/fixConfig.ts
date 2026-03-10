import { Args } from 'clientApp';
import { Route, Server, ServerOptions } from 'utils/server';
import { isOfficialLikeVersion } from 'utils/utils';
import { applyPatch, MultiPatch } from './helpers';

const patch: MultiPatch = {
    id: 'fix-config',
    patches: [
        {
            match: (url: string) => url === 'config.js',
            async apply(src: string, server: Server, argv: Args) {
                const opts: ServerOptions = { backend: true, path: false };

                // Replace API_URL, HISTORY_URL, WEBSOCKET_URL, and PREFIX in the server config
                const apiPath = server.getURL(Route.API, opts);
                src = applyPatch(src, /(API_URL = ')[^']*/, `$1${apiPath}/`);

                const historyPath = server.getURL(Route.HISTORY, {
                    ...opts,
                    // Season actually shares history storage with MMO, so just override
                    backend: server.isSeason ? 'https://screeps.com/' : undefined,
                });
                src = applyPatch(src, /(HISTORY_URL = ')[^']*/, `$1${historyPath}/`);

                const socketPath = server.getURL(Route.SOCKET, opts);
                src = applyPatch(src, /(WEBSOCKET_URL = ')[^']*/, `$1${socketPath}/`);

                const prefixValue = server.backendPath?.substring(1) || '';
                if (prefixValue) {
                    src = applyPatch(src, /(PREFIX: ')[^']*/, `$1${prefixValue}`);
                }

                const ptrValue = server.isPtr ? 'true' : 'false';
                if (server.isPtr) {
                    src = applyPatch(src, /(PTR: )[^,]*/, `$1${ptrValue}`);
                }

                const debugValue = argv.debug ? 'true' : 'false';
                if (argv.debug) {
                    src = applyPatch(src, /(DEBUG: )[^,]*/, `$1${debugValue}`);
                }

                return src;
            },
        },
        {
            match: (url: string) => url === 'app2/main.js',
            async apply(src: string) {
                // Modify getData() to fetch from the correct API path
                src = applyPatch(src, /fetch\(apiUrl \+ "version"\)/g, 'fetch(window.CONFIG.API_URL+"version")');
                // Remove fetch to forum RSS feed
                src = applyPatch(src, /fetch\(RSS_FORUM_URL\)/g, 'Promise.resolve()');
                return src;
            },
        },
        {
            match: (url) => url === 'build.min.js',
            async apply(src, server) {
                const { backend, isOfficial } = server;
                // Load backend info from underlying server
                const backendURL = new URL(backend);
                const isOfficialLike = isOfficial || (await isOfficialLikeVersion(server));
                // Look for server options payload in build information
                for (const match of src.matchAll(/\boptions=\{/g)) {
                    for (let i = match.index!; i < src.length; ++i) {
                        if (src.charAt(i) === '}') {
                            try {
                                const payload = src.substring(match.index!, i + 1);
                                if (payload.includes('apiUrl')) {
                                    // Inject host, port, and official
                                    src = `${src.substring(0, i)},
                                                    host: ${JSON.stringify(backendURL.hostname)},
                                                    protocol: "${backendURL.protocol}",
                                                    port: ${backendURL.port || (backendURL.protocol === 'https:' ? '443' : '80')},
                                                    official: ${isOfficialLike},
                                                } ${src.substring(i + 1)}`;
                                }
                                break;
                            } catch {
                                //
                            }
                        }
                    }
                }
                if (!isOfficial) {
                    // Replace room-history URL
                    src = applyPatch(
                        src,
                        /http:\/\/"\+s\.options\.host\+":"\+s\.options\.port\+"\/room-history/g,
                        server.getURL(Route.HISTORY, { path: false }),
                    );

                    // Replace official CDN with local assets
                    src = applyPatch(src, /https:\/\/d3os7yery2usni\.cloudfront\.net/g, `${backendURL}/assets`);
                }

                // Replace URLs with local client paths
                src = applyPatch(src, /https:\/\/screeps\.com\/a\//g, server.getURL(Route.ROOT, { path: false }));

                // Fix the hardcoded protocol in URLs
                src = applyPatch(
                    src,
                    /"http:\/\/"\+([^.]+)\.options\.host/g,
                    '$1.options.protocol+"//"+$1.options.host',
                );
                return src;
            },
        },
    ],
};

export default patch;
