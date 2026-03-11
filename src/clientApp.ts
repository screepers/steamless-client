import views from '@ladjs/koa-views';
import { Command } from 'commander';
import chalk from 'chalk';
import { createReadStream, promises as fs } from 'fs';
import httpProxy from 'http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import JSZip from 'jszip';
import Koa from 'koa';
import koaConditionalGet from 'koa-conditional-get';
import path from 'path';
import { Transform } from 'stream';
import { URL, fileURLToPath } from 'url';
import { AWS_HOST, Server } from './utils/server';
import { handleProxyError, handleServerError, logError } from './utils/errors';
import { getScreepsPath } from './utils/gamePath';
import { getCommunityPages, getServerListConfig, mimeTypes } from './utils/utils';
import { applyPatches, checkPatches, hasPatches, listPatches } from 'patches';

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

export interface Args {
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
    list_patches: boolean;
    patch: Set<string>;
    no_patch: Set<string>;
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
        .option(
            '--port <number>',
            `Changes the port. (default: ${defaultPort})`,
            (val) => parseInt(val, 10),
            defaultPort,
        )
        .option(
            '--public_hostname <hostname>',
            'The hostname that clients can use to access the client; useful when running in a container.',
        )
        .option(
            '--public_port <number>',
            'The port that clients can use to access the client; useful when running in a container.',
            (val) => parseInt(val, 10),
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
        .option(
            '--patch <patch-name>',
            'Enable application of patch named patch-name',
            (value, previous) => {
                previous.add(value);
                return previous;
            },
            new Set<string>(),
        )
        .option(
            '--no_patch <patch-name>',
            'Disable application of patch named patch-name',
            (value, previous) => {
                previous.add(value);
                return previous;
            },
            new Set<string>(),
        )
        .option('--list_patches', 'Show the full list of patches', false)
        .option('--debug', 'Display verbose errors for development.', false);

    program.parse();
    return program.opts();
})();

if (argv.list_patches) {
    listPatches();
    process.exit(0);
}
checkPatches(argv.patch, argv.no_patch);

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
const awsProxy = createProxyMiddleware({ target: AWS_HOST, changeOrigin: true });

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

    const { endpoint } = server;

    // We do this to not get caught in the server-side redirect
    const urlPath = endpoint === '/' ? 'index.html' : endpoint.substring(1);

    const file = zip.files[urlPath];
    if (!file) return next();

    // Check cached response based on zip file modification
    context.lastModified = lastModified;
    if (context.fresh) return;

    // Rewrite various payloads
    context.body = await (async function () {
        if (hasPatches(urlPath)) {
            let src = await file.async('text');
            src = await applyPatches(urlPath, src, server, argv);
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
