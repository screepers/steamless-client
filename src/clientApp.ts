import views from '@ladjs/koa-views';
import { Command } from 'commander';
import chalk from 'chalk';
import { createReadStream, promises as fs } from 'fs';
import httpProxy from 'http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jsBeautify from 'js-beautify';
import JSZip from 'jszip';
import Koa from 'koa';
import koaConditionalGet from 'koa-conditional-get';
import path from 'path';
import { Transform } from 'stream';
import { URL, fileURLToPath } from 'url';
import { clientAuth } from './inject/clientAuth';
import { customMenuLinks } from './inject/customMenuLinks';
import { roomDecorations } from './inject/roomDecorations';
import { Server, Route, ServerOptions } from './utils/server';
import { handleProxyError, handleServerError, logError } from './utils/errors';
import { getScreepsPath } from './utils/gamePath';
import {
    generateScriptTag,
    getCommunityPages,
    getServerListConfig,
    isOfficialLikeVersion,
    mimeTypes,
    applyPatch,
} from './utils/utils';

// Get the app directory and version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.resolve(rootDir, 'package.json');
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const version = packageJson.version || '1.0.0';
const arrow = '\u2192';
const localhost = 'localhost';
const defaultPort = 8080;
const awsHost = 'https://s3.amazonaws.com';

interface Args {
    package?: string;
    host: string;
    port: number;
    public_hostname?: string;
    public_port?: number;
    public_tls: boolean;
    use_subdomains: boolean;
    internal_backend?: string;
    server_list?: string;
    guest: boolean;
    beautify: boolean;
    debug: boolean;
}

// Parse program arguments
const argv: Args = (() => {
    const program = new Command();
    program
        .name('screepers-steamless-client')
        .description('Web proxy for the Screeps World game client.')
        .version(version, '-v, --version', 'Display version number')
        .option(
            '--package <path>',
            "Path to the Screeps package.nw file. Use this if the path isn't automatically detected.",
        )
        .option('--host <address>', `Changes the host address. (default: ${localhost})`, localhost)
        .option('--port <number>', `Changes the port. (default: ${defaultPort})`, parseInt, defaultPort)
        .option(
            '--public_hostname <hostname>',
            'The hostname that clients can use to access the client; useful when running in a container.',
        )
        .option(
            '--public_port <number>',
            'The port that clients can use to access the client; useful when running in a container.',
            parseInt,
        )
        .option('--public_tls', 'Whether the public address should use TLS; useful when running in a container.', false)
        .option('--use_subdomains', 'Whether the server links should use subdomains off of the public address.', false)
        .option(
            '--internal_backend <url>',
            'Set the internal backend url when running the Screeps server in a local container.',
        )
        .option('--server_list <path>', 'Path to a custom server list json config file.')
        .option('--guest', 'Enable guest mode for xxscreeps.', false)
        .option('--beautify', 'Formats .js files loaded in the client for debugging.', false)
        .option('--debug', 'Display verbose errors for development.', false);

    program.parse();
    return program.opts();
})();

/** The URL Steamless is listening at (possibly within a container) */
const hostURL = (() => {
    const url = new URL('http://example.com');
    url.protocol = argv.public_tls ? 'https' : 'http';
    url.host = argv.host === '0.0.0.0' ? localhost : argv.host;
    url.port = `${argv.port}`;
    return url;
})();

/** The public URL Steamless is listening at */
const publicURL =
    (() => {
        if (!argv.public_hostname || !argv.public_port) return null;
        const url = new URL('http://example.com');
        url.protocol = argv.public_tls ? 'https' : 'http';
        url.host = argv.public_hostname;
        url.port = `${argv.public_port}`;
        return url;
    })() ?? hostURL;

const urlFromRequest = (host: string | undefined): URL => {
    if (host) {
        const url = new URL('http://example.com');
        url.protocol = argv.public_tls ? 'https' : 'http';
        url.host = host;
        return url;
    }
    return publicURL;
};

const getProxyTarget = (backend: string) =>
    argv.internal_backend && backend.includes(localhost) ? argv.internal_backend : backend;

// Log welcome message
console.log('🧩', chalk.yellowBright(`Screepers Steamless Client v${version}`));

// Create proxy
const proxy = httpProxy.createProxyServer({ changeOrigin: true });
proxy.on('error', (err, _req, res) => handleProxyError(err, res, argv.debug));
const awsProxy = createProxyMiddleware({ target: awsHost, changeOrigin: true });

// Locate and read `package.nw`
const readPackageData = async () => {
    const pkgPath = argv.package ?? (await getScreepsPath());
    try {
        if (pkgPath) {
            console.log('📦', chalk.dim('Package', arrow), chalk.gray(pkgPath));
            return Promise.all([fs.readFile(pkgPath), fs.stat(pkgPath)]);
        }
    } catch {
        if (argv.package) {
            logError(`Could not find the Screeps "package.nw" at the path provided.`);
        } else {
            logError('Use the "--package" argument to specify the path to the Screeps "package.nw" file.');
        }
    }
    return process.exit(1);
};

const [data, stat] = await readPackageData();

// Read package zip metadata
const zip = new JSZip();
await zip.loadAsync(new Uint8Array(data));

// HTTP header is only accurate to the minute
const lastModified = stat.mtime;

// Set up web server
const koa = new Koa();
const { host, port } = argv;
const server = koa.listen(port, host);
server.on('error', (err) => handleServerError(err, argv.debug));
server.on('listening', () => {
    console.log('🌐', chalk.dim('Ready', arrow), chalk.white(hostURL));
    if (publicURL !== hostURL) {
        console.log('🌐', chalk.dim('Public', arrow), chalk.white(publicURL));
    }
});

// Get system path for public files dir
const indexFile = 'index.ejs';

// Setup views for rendering ejs files
koa.use(views(path.join(__dirname, '../views'), { extension: 'ejs' }));

// Serve client assets directly from steam package
koa.use(koaConditionalGet());

// Proxy requests to AWS host to avoid CORS issues
koa.use(async (ctx, next) => {
    if (ctx.url.startsWith('/static.screeps.com')) {
        await awsProxy(ctx.req, ctx.res, next);
        ctx.respond = false;
    }
    return next();
});

// Render the index.ejs file and pass the serverList variable
koa.use(async (context, next) => {
    if (['/', 'index.html'].includes(context.path)) {
        const communityPages = getCommunityPages();
        const useSubdomains = (publicURL ?? hostURL).hostname == 'localhost' || argv.use_subdomains;
        const serverList = await getServerListConfig(__dirname, publicURL, useSubdomains, argv.server_list);
        await context.render(indexFile, { serverList, communityPages });
    }

    return next();
});

// Public files to serve
const publicFiles = [
    { file: 'public/favicon.png', type: 'image/png' },
    { file: 'public/style.css', type: 'text/css' },
    { file: 'dist/serverStatus.js', type: 'text/javascript' },
];

// Serve public files
koa.use((context, next) => {
    const urlPath = context.path.substring(1);
    for (const { file, type } of publicFiles) {
        if (urlPath === file) {
            context.type = type;
            context.body = createReadStream(path.join(rootDir, file));
            return;
        }
    }

    return next();
});

// Serve client assets
koa.use(async (context, next) => {
    const server = Server.fromRequest(urlFromRequest(context.header.host), context.path);
    if (!server) return;

    const { backend, endpoint, isOfficial, backendPath } = server;

    // We do this to not get caught in the server-side redirect
    const urlPath = endpoint === '/' ? 'index.html' : endpoint.substring(1);

    const file = zip.files[urlPath];
    if (!file) return next();

    // Check cached response based on zip file modification
    context.lastModified = lastModified;
    if (context.fresh) return;

    // Rewrite various payloads
    context.body = await (async function () {
        if (urlPath === 'index.html') {
            let src = await file.async('text');

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
                generateScriptTag(clientAuth, { backend, guest: argv.guest }),
                generateScriptTag(roomDecorations, { backend, awsHost }),
                generateScriptTag(customMenuLinks, { backend, seasonLink, ptrLink, changeServerLink }),
            ].join('\n');
            src = applyPatch(src, header, replaceHeader);

            // Remove tracking pixels
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*xsolla[^>]*<\/script>/g,
                '<script>xnt = new Proxy(() => xnt, { get: () => xnt })</script>',
            );
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*facebook[^>]*<\/script>/g,
                '<script>fbq = new Proxy(() => fbq, { get: () => fbq })</script>',
            );
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*google[^>]*<\/script>/g,
                '<script>ga = new Proxy(() => ga, { get: () => ga })</script>',
            );
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*mxpnl[^>]*<\/script>/g,
                '<script>mixpanel = new Proxy(() => mixpanel, { get: () => mixpanel })</script>',
            );
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*twttr[^>]*<\/script>/g,
                '<script>twttr = new Proxy(() => twttr, { get: () => twttr })</script>',
            );
            src = applyPatch(
                src,
                /<script[^>]*>[^>]*onRecaptchaLoad[^>]*<\/script>/g,
                '<script>function onRecaptchaLoad(){}</script>',
            );
            return src;
        } else if (urlPath === 'config.js') {
            let src = await file.async('text');
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

            const prefixValue = backendPath?.substring(1) || '';
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
        } else if (context.path.endsWith('.js')) {
            let src = await file.async('text');

            if (urlPath.startsWith('app2/main.')) {
                // Modify getData() to fetch from the correct API path
                src = applyPatch(src, /fetch\(apiUrl \+ "version"\)/g, 'fetch(window.CONFIG.API_URL+"version")');
                // Remove fetch to forum RSS feed
                src = applyPatch(src, /fetch\(RSS_FORUM_URL\)/g, 'Promise.resolve()');
                // Remove AWS host from rewards URL
                src = applyPatch(src, /https:\/\/s3\.amazonaws\.com/g, '');
                // Replace some of the number formatting in the market pages

                // # All orders
                // Price + std on resource tiles: ./src2/app/market.module/resource-price.component/resource-price.component.pug
                src = applyPatch(src, /{{ data\.avgPrice }}/g, '{{ data.avgPrice.toLocaleString() }}');
                src = applyPatch(src, /{{ data\.stddevPrice }}/g, '{{ data.stddevPrice.toLocaleString() }}');

                // # Resource info dialog
                // Buying/selling tables, ./src2/app/market.module/table-orders/table-orders.component.pug
                src = applyPatch(src, /{{ order\.price\.toFixed\(3\) }}/g, '{{ order.price.toLocaleString() }}');
                src = applyPatch(src, /{{ order\.amount \| number }}/g, '{{ order.amount.toLocaleString() }}');
                src = applyPatch(
                    src,
                    /{{ order\.remainingAmount \| number }}/g,
                    '{{ order.remainingAmount.toLocaleString() }}',
                );

                // Price history, ./src2/app/market.module/table-price-history/table-price-history.component.pug
                src = applyPatch(
                    src,
                    /{{ order.transactions\| number:'1\.0-3' }}/g,
                    '{{ order.transactions.toLocaleString() }}',
                );
                src = applyPatch(src, /{{ order\.volume \| number:'1\.0-3'}}/g, '{{ order.volume.toLocaleString() }}');
                src = applyPatch(src, /{{ order\.avgPrice }}/g, '{{ order.avgPrice.toLocaleString() }}');
                src = applyPatch(
                    src,
                    /{{ order\.stddevPrice\.toFixed\(3\) }}/g,
                    '{{ order.stddevPrice.toLocaleString() }}',
                );

                // # My orders, ./src2/app/market.module/table-my-orders/table-my-orders.component.pug
                // There's also an `order.price` here, but it's been handled above
                src = applyPatch(
                    src,
                    /{{ order\.totalAmount \| number }}/g,
                    '{{ order.totalAmount.toLocaleString() }}',
                );

                // # History, ./src2/app/market.module/table-history/table-history.component.pug
                src = applyPatch(src, /{{ transaction\.tick }}/g, '{{ transaction.tick.toLocaleString() }}');
                src = applyPatch(
                    src,
                    /{{ transaction\.change\.toFixed\(3\) }}/g,
                    '{{ transaction.change.toLocaleString() }}',
                );
                src = applyPatch(
                    src,
                    /{{ transaction\.balance\.toFixed\(3\) }}/g,
                    '{{ transaction.balance.toLocaleString() }}',
                );

                // Bounds fix for the alpha map
                // ./node_modules/@screeps/map/dist/constants.js
                src = applyPatch(src, /exports\.MIN_SCALE = \.4;/, 'exports.MIN_SCALE = .3');

                // ./src2/app/world-map.module/world-map-size.resolver.ts
                src = applyPatch(
                    src,
                    /resolve\({ width: width, height: height }\);/,
                    "resolve(shard !== 'shardSeason' ? { width: width, height: height } : { width: 512, height: 512 });",
                );

                // Fix alpha map decoration loads to AWS by sending them through the proxy set up for the injected roomDecorations CORS fix
                // getTextureByUrl() in ./node_modules/@screeps/map/dist/utils.js
                src = applyPatch(
                    src,
                    /const img = await loadImage\(url\);/,
                    "const img = await loadImage(url.replace('https://s3.amazonaws.com/static.screeps.com/', '/static.screeps.com/'));",
                );
            } else if (urlPath.startsWith('vendor/renderer/renderer.js')) {
                // Modify renderer to remove AWS host from loadElement()
                src = applyPatch(
                    src,
                    /\(this\.data\.src=this\.url\)/g,
                    `(this.data.src=this.url.replace("${awsHost}",""))`,
                );
                // Remove AWS host from image URLs
                src = applyPatch(src, /src=t,/g, `src=t.replace("${awsHost}",""),`);

                // The server sometimes sends completely broken objects which break the viewer
                // https://discord.com/channels/860665589738635336/1337213532198142044
                src = applyPatch(
                    src,
                    't.forEach(t=>{null!==t.x&&null!==t.y&&(e(t)&&(i[t.x][t.y]=t,a=!0),o[t.x][t.y]=!1)})',
                    't.forEach((t)=>{!(null===t.x||undefined===t.x)&&!(null===t.y||undefined===t.y)&&(e(t)&&((i[t.x][t.y]=t),(a=!0)),(o[t.x][t.y]=!1));});',
                );
            } else if (urlPath === 'build.min.js') {
                // Load backend info from underlying server
                const backendURL = new URL(backend);
                const isOfficialLike = isOfficial || (await isOfficialLikeVersion(server));
                // Look for server options payload in build information
                for (const match of src.matchAll(/\boptions=\{/g)) {
                    for (let i = match.index!; i < src.length; ++i) {
                        if (src.charAt(i) === '}') {
                            try {
                                const payload = src.substring(match.index!, i + 1);
                                const _holder = new Function(payload);
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
                            } catch (err) {}
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
                    /"http:\/\/"\+([^\.]+)\.options\.host/g,
                    '$1.options.protocol+"//"+$1.options.host',
                );

                // Remove the default-to-place-spawn behavior when you're not spawned in
                src = applyPatch(
                    src,
                    'h.get("user/world-status").then(function(t){"empty"==t.status&&(P.selectedAction.action="spawn",',
                    'h.get("user/world-status").then(function(t){"empty"==t.status&&(',
                );

                // The server sometimes sends completely broken objects which break the viewer
                // https://discord.com/channels/860665589738635336/1337213532198142044
                // https://github.com/screeps/engine/blob/master/src/processor/intents/_create-energy.js#L49
                // In this case, objects that were bulk-inserted this tick have an id that's a number
                // This breaks because the for…in loop makes `o` a string, which the `_.find` call sees as different
                // 'function U(e,t){for(var o in t){t[o]&&(t[o]._id=""+t[o]._id);var r=t[o],n=_.find(e,{_id:o});n?null!==r',
                src = applyPatch(
                    src,
                    'function U(e,t){for(var o in t){var r=t[o],n=_.find(e,{_id:o});n?null!==r',
                    'function U(e,t){for(var o in t){t[o]&&typeof t[o]._id!=="string"&&(t[o]._id=""+o);var r=t[o],n=_.find(e,{_id:o});n?null!==r',
                );
            }
            return argv.beautify ? jsBeautify(src) : src;
        } else if (urlPath === 'components/profile/profile.html') {
            let src = await file.async('text');

            // Looks like a bug in the client; `isShards()` returns true whether there's any shards on the server,
            // and that appears to be always true. Switch to `isMultiShard()` since that one checks if there's more
            // than one shard, which is always false on a private server. Otherwise, we will tack on the shardName,
            // which in the case of a private server, isn't even the shard's actual name but `rooms`, leading to a
            // broken URL.
            src = applyPatch(
                src,
                `<img ng:src="{{Profile.mapUrl}}{{isShards() ? shardName+'/' : ''}}{{roomName}}.png">`,
                `<img ng:src="{{Profile.mapUrl}}{{isMultiShard() ? shardName+'/' : ''}}{{roomName}}.png">`,
            );

            return src;
        } else if (urlPath === 'components/game/room/properties/portal.html') {
            let src = await file.async('text');

            // Fix the portal stability info showing only if it's an intershard portal
            // Additionally, expose the stable date in the inspector
            const unstableDateInfo =
                "<div ng-if='Room.selectedObject.unstableDate'>\n" +
                '<label>Stable until:</label>\n' +
                "<span id='screepers-stable-date' data-unstabledate='{{Room.selectedObject.unstableDate}}'/>\n" +
                '<script>\n' +
                'setTimeout(() => {\n' +
                "\tconst dateField = document.getElementById('screepers-stable-date');\n" +
                '\tif (!dateField) return;\n' +
                "\tconst date = dateField.getAttribute('data-unstabledate');\n" +
                '\tconst unstableStamp = parseInt(date, 10)\n' +
                '\tdateField.innerText = new Date(unstableStamp).toLocaleString()\n' +
                '}, 20);\n' +
                '</script>\n' +
                '</div>\n';
            src = applyPatch(
                src,
                "<div ng-if='Room.selectedObject.destination &amp;&amp; Room.selectedObject.destination.shard'>",
                unstableDateInfo + "<div ng:if='!Room.selectedObject.unstableDate'>",
            );
            src = applyPatch(src, 'portal is stable yet', 'portal is stable');
            return src;
        } else {
            // JSZip doesn't implement their read stream correctly and it causes EPIPE crashes. Pass it
            // through a no-op transform stream first to iron that out.
            const stream = new Transform();
            stream._transform = function (chunk, encoding, done) {
                this.push(chunk, encoding);
                done();
            };
            file.nodeStream().pipe(stream);
            return stream;
        }
    })();

    // Set content type
    const extension = (/\.[^.]+$/.exec(urlPath.toLowerCase())?.[0] ?? '.html') as keyof typeof mimeTypes;
    context.set('Content-Type', mimeTypes[extension] ?? 'text/html');

    // Set cache for resources that change occasionally
    if (context.request.query.bust) {
        context.set('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 1 week
    }
});

// Proxy API requests to Screeps server
koa.use((context, next) => {
    if (context.header.upgrade) {
        context.respond = false;
        return;
    }

    const server = Server.fromRequest(urlFromRequest(context.header.host), context.url);
    if (server) {
        const { backend, endpoint } = server;

        context.respond = false;
        context.req.url = endpoint;
        if (endpoint.startsWith('/api/auth')) {
            const returnUrl = encodeURIComponent(backend);
            const separator = endpoint.endsWith('?') ? '' : endpoint.includes('?') ? '&' : '?';
            context.req.url = `${endpoint}${separator}returnUrl=${returnUrl}`;
        }
        // XXX: this still needs to move
        const target = getProxyTarget(backend);
        proxy.web(context.req, context.res, { target });
        return;
    }
    return next();
});

// Proxy WebSocket requests
server.on('upgrade', (req, socket, head) => {
    const server = Server.fromRequest(urlFromRequest(req.headers.host), req.url!);

    if (server && req.headers.upgrade?.toLowerCase() === 'websocket') {
        req.url = server.endpoint;
        const target = getProxyTarget(server.backend);
        proxy.ws(req, socket, head, { target });
        socket.on('error', (err) => {
            if (argv.debug) logError(err);
        });
    } else {
        socket.end();
    }
});

// Clean up on exit
const cleanup = () => process.exit(1);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => server.close());
