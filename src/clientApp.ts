import views from '@ladjs/koa-views';
import { ArgumentParser } from 'argparse';
import chalk from 'chalk';
import { createReadStream, existsSync, promises as fs } from 'fs';
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
import { Client, Route } from './utils/client';
import { handleProxyError, handleServerError, logError } from './utils/errors';
import { getScreepsPath } from './utils/gamePath';
import {
    extractBackend,
    generateScriptTag,
    getCommunityPages,
    getServerListConfig,
    isOfficialLikeVersion,
    mimeTypes,
    trimLocalSubdomain,
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

// Parse program arguments
const argv = (() => {
    const parser = new ArgumentParser({ description: 'Web proxy for the Screeps World game client.' });
    parser.add_argument('-v', '--version', { action: 'version', version: `v${version}` });
    parser.add_argument('--package', {
        nargs: '?',
        type: 'str',
        help: "Path to the Screeps package.nw file. Use this if the path isn't automatically detected.",
    });
    parser.add_argument('--host', {
        nargs: '?',
        type: 'str',
        default: localhost,
        help: `Changes the host address. (default: ${localhost})`,
    });
    parser.add_argument('--port', {
        nargs: '?',
        type: 'int',
        default: defaultPort,
        help: `Changes the port. (default: ${defaultPort})`,
    });
    parser.add_argument('--internal_backend', {
        nargs: '?',
        type: 'str',
        help: 'Set the internal backend url when running the Screeps server in a local container.',
    });
    parser.add_argument('--server_list', {
        nargs: '?',
        type: 'str',
        help: 'Path to a custom server list json config file.',
    });
    parser.add_argument('--guest', {
        action: 'store_true',
        default: false,
        help: 'Enable guest mode for xxscreeps.',
    });
    parser.add_argument('--beautify', {
        action: 'store_true',
        default: false,
        help: 'Formats .js files loaded in the client for debugging.',
    });
    parser.add_argument('--debug', {
        action: 'store_true',
        default: false,
        help: 'Display verbose errors for development.',
    });
    return parser.parse_args();
})();

const hostAddress = argv.host === '0.0.0.0' ? localhost : argv.host;

const getProxyTarget = (backend: string) =>
    argv.internal_backend && backend.includes(localhost) ? argv.internal_backend : backend;

// Log welcome message
console.log('🧩', chalk.yellowBright(`Screepers Steamless Client v${version}`));

// Create proxy
const proxy = httpProxy.createProxyServer({ changeOrigin: true });
proxy.on('error', (err, req, res) => handleProxyError(err, res, argv.debug));
const awsProxy = createProxyMiddleware({ target: awsHost, changeOrigin: true });

const exitOnPackageError = () => {
    if (argv.package) {
        logError(`Could not find the Screeps "package.nw" at the path provided.`);
    } else {
        logError('Use the "--package" argument to specify the path to the Screeps "package.nw" file.');
    }
    process.exit(1);
};

// Locate and read `package.nw`
const readPackageData = async () => {
    const pkgPath = argv.package ?? (await getScreepsPath());
    if (!pkgPath || !existsSync(pkgPath)) exitOnPackageError();
    console.log('📦', chalk.dim('Package', arrow), chalk.gray(pkgPath));
    return Promise.all([fs.readFile(pkgPath), fs.stat(pkgPath)]).catch(exitOnPackageError);
};

const [data, stat] = await readPackageData();

// Read package zip metadata
const zip = new JSZip();
await zip.loadAsync(data);

// HTTP header is only accurate to the minute
const lastModified = stat.mtime;

// Set up web server
const koa = new Koa();
const { host, port } = argv;
const server = koa.listen(port, host);
server.on('error', (err) => handleServerError(err, argv.debug));
server.on('listening', () =>
    console.log('🌐', chalk.dim('Ready', arrow), chalk.white(`http://${hostAddress}:${port}/`)),
);

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
        let serverList = await getServerListConfig(__dirname, hostAddress, port, argv.server_list);
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
    const info = extractBackend(context.path);
    if (!info) return;

    const isOfficial = info.backend === 'https://screeps.com';
    const prefix = isOfficial ? info.endpoint.match(/^\/(season|ptr)/)?.[0] : undefined;

    const endpointFilePath = prefix ? info.endpoint.replace(prefix, '') : info.endpoint;
    const urlPath = endpointFilePath === '/' ? 'index.html' : endpointFilePath.substring(1);

    const file = zip.files[urlPath];
    if (!file) return next();

    // Check cached response based on zip file modification
    context.lastModified = lastModified;
    if (context.fresh) return;

    const clientHost = context.header.host || `${hostAddress}:${port}`;

    const client = new Client({
        host: clientHost,
        prefix,
        backend: info.backend,
    });

    // Rewrite various payloads
    context.body = await (async function () {
        if (urlPath === 'index.html') {
            let src = await file.async('text');

            // Client app menu links
            const seasonLink =
                isOfficial && !prefix
                    ? `${client.getURL(Route.ROOT)}season/`
                    : client.getURL(Route.ROOT, { prefix: false });
            const ptrLink = isOfficial && !prefix ? `${client.getURL(Route.ROOT)}ptr/` : undefined;
            const changeServerLink = `http://${trimLocalSubdomain(clientHost)}/`;

            // Inject startup script
            const header = '<title>Screeps</title>';
            const replaceHeader = [
                header,
                generateScriptTag(clientAuth, { backend: info.backend, guest: argv.guest }),
                generateScriptTag(roomDecorations, { backend: info.backend, awsHost }),
                generateScriptTag(customMenuLinks, { backend: info.backend, seasonLink, ptrLink, changeServerLink }),
            ].join('\n');
            src = src.replace(header, replaceHeader);

            // Remove tracking pixels
            src = src.replace(
                /<script[^>]*>[^>]*xsolla[^>]*<\/script>/g,
                '<script>xnt = new Proxy(() => xnt, { get: () => xnt })</script>',
            );
            src = src.replace(
                /<script[^>]*>[^>]*facebook[^>]*<\/script>/g,
                '<script>fbq = new Proxy(() => fbq, { get: () => fbq })</script>',
            );
            src = src.replace(
                /<script[^>]*>[^>]*google[^>]*<\/script>/g,
                '<script>ga = new Proxy(() => ga, { get: () => ga })</script>',
            );
            src = src.replace(
                /<script[^>]*>[^>]*mxpnl[^>]*<\/script>/g,
                '<script>mixpanel = new Proxy(() => mixpanel, { get: () => mixpanel })</script>',
            );
            src = src.replace(
                /<script[^>]*>[^>]*twttr[^>]*<\/script>/g,
                '<script>twttr = new Proxy(() => twttr, { get: () => twttr })</script>',
            );
            src = src.replace(
                /<script[^>]*>[^>]*onRecaptchaLoad[^>]*<\/script>/g,
                '<script>function onRecaptchaLoad(){}</script>',
            );
            return src;
        } else if (urlPath === 'config.js') {
            let src = await file.async('text');
            const opts = { full: true };

            // Replace API_URL, HISTORY_URL, WEBSOCKET_URL, and PREFIX in the server config
            const apiPath = client.getPath(Route.API, opts);
            src = src.replace(/(API_URL = ')[^']*/, `$1${apiPath}/`);

            const historyPath = client.getPath(Route.HISTORY, opts);
            src = src.replace(/(HISTORY_URL = ')[^']*/, `$1${historyPath}/`);

            const socketPath = client.getPath(Route.SOCKET, opts);
            src = src.replace(/(WEBSOCKET_URL = ')[^']*/, `$1${socketPath}/`);

            const prefixValue = prefix?.substring(1) || '';
            src = src.replace(/(PREFIX: ')[^']*/, `$1${prefixValue}`);

            const ptrValue = prefix === '/ptr' ? 'true' : 'false';
            src = src.replace(/(PTR: )[^,]*/, `$1${ptrValue}`);

            const debugValue = argv.debug ? 'true' : 'false';
            src = src.replace(/(DEBUG: )[^,]*/, `$1${debugValue}`);

            return src;
        } else if (context.path.endsWith('.js')) {
            let src = await file.async('text');

            if (urlPath.startsWith('app2/main.')) {
                // Modify getData() to fetch from the correct API path
                src = src.replace(/fetch\(t\+"version"\)/g, 'fetch(window.CONFIG.API_URL+"version")');
                // Remove fetch to forum RSS feed
                src = src.replace(/fetch\("https:\/\/screeps\.com\/forum\/.+\.rss"\)/g, 'Promise.resolve()');
                // Remove AWS host from rewards URL
                src = src.replace(/https:\/\/s3\.amazonaws\.com/g, '');
            } else if (urlPath.startsWith('vendor/renderer/renderer.js')) {
                // Modify renderer to remove AWS host from loadElement()
                src = src.replace(
                    /\(this\.data\.src=this\.url\)/g,
                    `(this.data.src=this.url.replace("${awsHost}",""))`,
                );
                // Remove AWS host from image URLs
                src = src.replace(/src=t,/g, `src=t.replace("${awsHost}",""),`);

                // The server sometimes sends completely broken objects which break the viewer
                // https://discord.com/channels/860665589738635336/1337213532198142044
                src = src.replace(
                    't.forEach(t=>{null!==t.x&&null!==t.y&&(e(t)&&(i[t.x][t.y]=t,a=!0),o[t.x][t.y]=!1)})',
                    't.forEach((t)=>{!(null===t.x||undefined===t.x)&&!(null===t.y||undefined===t.y)&&(e(t)&&((i[t.x][t.y]=t),(a=!0)),(o[t.x][t.y]=!1));});',
                );
            } else if (urlPath === 'build.min.js') {
                // Load backend info from underlying server
                const backend = new URL(info.backend);
                const isOfficialLike = isOfficial || (await isOfficialLikeVersion(client));
                // Look for server options payload in build information
                for (const match of src.matchAll(/\boptions=\{/g)) {
                    for (let i = match.index!; i < src.length; ++i) {
                        if (src.charAt(i) === '}') {
                            try {
                                const payload = src.substring(match.index!, i + 1);
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const holder = new Function(payload);
                                if (payload.includes('apiUrl')) {
                                    // Inject host, port, and official
                                    src = `${src.substring(0, i)},
                                        host: ${JSON.stringify(backend.hostname)},
                                        protocol: "${backend.protocol}",
                                        port: ${backend.port || (backend.protocol === 'https:' ? '443' : '80')},
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
                    src = src.replace(
                        /http:\/\/"\+s\.options\.host\+":"\+s\.options\.port\+"\/room-history/g,
                        client.getURL(Route.HISTORY),
                    );

                    // Replace official CDN with local assets
                    src = src.replace(/https:\/\/d3os7yery2usni\.cloudfront\.net/g, `${info.backend}/assets`);
                }

                // Replace URLs with local client paths
                src = src.replace(/https:\/\/screeps\.com\/a\//g, client.getURL(Route.ROOT));

                // Fix the hardcoded protocol in URLs
                src = src.replace(/"http:\/\/"\+([^\.]+)\.options\.host/g, '$1.options.protocol+"//"+$1.options.host');

                // Remove the default-to-place-spawn behavior when you're not spawned in
                src = src.replace(
                    'h.get("user/world-status").then(function(t){"empty"==t.status&&(P.selectedAction.action="spawn",',
                    'h.get("user/world-status").then(function(t){"empty"==t.status&&(',
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
            src = src.replace(
                `<img ng:src="{{Profile.mapUrl}}{{isShards() ? shardName+'/' : ''}}{{roomName}}.png">`,
                `<img ng:src="{{Profile.mapUrl}}{{isMultiShard() ? shardName+'/' : ''}}{{roomName}}.png">`,
            );

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

    const info = extractBackend(context.url);
    if (info) {
        context.respond = false;
        context.req.url = info.endpoint;
        if (info.endpoint.startsWith('/api/auth')) {
            const returnUrl = encodeURIComponent(info.backend);
            const separator = info.endpoint.endsWith('?') ? '' : info.endpoint.includes('?') ? '&' : '?';
            context.req.url = `${info.endpoint}${separator}returnUrl=${returnUrl}`;
        }
        const target = getProxyTarget(info.backend);
        proxy.web(context.req, context.res, { target });
        return;
    }
    return next();
});

// Proxy WebSocket requests
server.on('upgrade', (req, socket, head) => {
    const info = extractBackend(req.url!);
    if (info && req.headers.upgrade?.toLowerCase() === 'websocket') {
        req.url = info.endpoint;
        const target = getProxyTarget(info.backend);
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
