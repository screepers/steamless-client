#!/usr/bin/env node
import httpProxy from 'http-proxy';
import Koa from 'koa';
import koaConditionalGet from 'koa-conditional-get';
import views from '@ladjs/koa-views';
import jsBeautify from 'js-beautify';
import JSZip from 'jszip';
import chalk from 'chalk';
import path from 'path';
import { ArgumentParser } from 'argparse';
import { createReadStream, existsSync, promises as fs } from 'fs';
import { fileURLToPath, URL } from 'url';
import { ServerResponse } from 'http';
import { Transform } from 'stream';
import { Client, Route } from './utils/client';
import { getScreepsPath } from './utils/gamePath';
import {
    logError,
    isOfficialLikeVersion,
    trimLocalSubdomain,
    generateScriptTag,
    getServerListConfig,
    extractBackend,
    mimeTypes,
    handleProxyError,
    handleServerError,
} from './utils/clientUtils';
import { clientAuth } from './inject/clientAuth';
import { removeDecorations } from './inject/removeDecorations';
import { customMenuLinks } from './inject/customMenuLinks';

// Get the app directory and version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.resolve(rootDir, 'package.json');
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const version = packageJson.version || '1.0.0';
const arrow = '\u2192';

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 8080;

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
        default: DEFAULT_HOST,
        help: `Changes the host address. (default: ${DEFAULT_HOST})`,
    });
    parser.add_argument('--port', {
        nargs: '?',
        type: 'int',
        default: DEFAULT_PORT,
        help: `Changes the port. (default: ${DEFAULT_PORT})`,
    });
    parser.add_argument('--backend', {
        nargs: '?',
        type: 'str',
        help: 'Set the backend url. When provided, the app will directly proxy this server and disable the server list page.',
    });
    parser.add_argument('--internal_backend', {
        nargs: '?',
        type: 'str',
        help: "Set the backend's internal url. Requires --backend to be set. When provided, the app will use this url to connect to the server while still using its --backend name externally.",
    });
    parser.add_argument('--server_list', {
        nargs: '?',
        type: 'str',
        help: 'Path to a custom server list json config file.',
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

const hostAddress = argv.host === '0.0.0.0' ? DEFAULT_HOST : argv.host;

// Log welcome message
console.log('🧩', chalk.yellowBright(`Screepers Steamless Client v${version}`));

// Create proxy
const proxy = httpProxy.createProxyServer({ changeOrigin: true });
proxy.on('error', (err, _req, res) => handleProxyError(err, res as ServerResponse, argv.debug));

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

// Render the index.ejs file and pass the serverList variable
koa.use(async (context, next) => {
    if (argv.backend) return next(); // Skip if backend is specified

    if (['/', 'index.html'].includes(context.path)) {
        const serverList = await getServerListConfig(hostAddress, port, argv.server_list);
        if (serverList.length) {
            await context.render(indexFile, { serverList });
            return;
        }
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
    if (argv.backend) return next(); // Skip if backend is specified

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
    const info = extractBackend(context.path, argv.backend);
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
        backend: argv.backend,
        server: info.backend,
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
            const serverListLink = argv.backend ? undefined : `http://${trimLocalSubdomain(clientHost)}/`;

            // Inject startup script
            const header = '<title>Screeps</title>';
            const replaceHeader = [
                header,
                generateScriptTag(clientAuth, { backend: info.backend }),
                generateScriptTag(removeDecorations, { backend: info.backend }),
                generateScriptTag(customMenuLinks, { backend: info.backend, seasonLink, ptrLink, serverListLink }),
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

            return src;
        } else if (context.path.endsWith('.js')) {
            let src = await file.async('text');
            if (urlPath === 'build.min.js') {
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
                                        port: ${backend.port || '80'},
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
                src = src.replace(/https:\/\/screeps.com\/a\//g, client.getURL(Route.ROOT));
            }
            return argv.beautify ? jsBeautify(src) : src;
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

    // We can safely cache explicitly-versioned resources forever
    if (context.request.query.bust) {
        context.set('Cache-Control', 'public,max-age=31536000,immutable');
    }
});

// Proxy API requests to Screeps server
koa.use((context, next) => {
    if (context.header.upgrade) {
        context.respond = false;
        return;
    }

    const info = extractBackend(context.url, argv.backend);
    if (info) {
        context.respond = false;
        context.req.url = info.endpoint;
        if (info.endpoint.startsWith('/api/auth')) {
            const returnUrl = encodeURIComponent(info.backend);
            const separator = info.endpoint.endsWith('?') ? '' : info.endpoint.includes('?') ? '&' : '?';
            context.req.url = `${info.endpoint}${separator}returnUrl=${returnUrl}`;
        }
        proxy.web(context.req, context.res, {
            target: argv.internal_backend ?? info.backend,
        });
        return;
    }
    return next();
});

// Proxy WebSocket requests
server.on('upgrade', (req, socket, head) => {
    const info = extractBackend(req.url!, argv.backend);
    if (info && req.headers.upgrade?.toLowerCase() === 'websocket') {
        req.url = info.endpoint;
        proxy.ws(req, socket, head, {
            target: argv.internal_backend ?? info.backend,
        });
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
