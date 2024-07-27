import chalk from 'chalk';
import path from 'path';
import fetch from 'node-fetch';
import { existsSync, promises as fs } from 'fs';
import { fileURLToPath, URL } from 'url';
import { type Client, Route } from './client';
import { ServerError, Server } from './types';
import { ServerResponse } from 'http';

export const mimeTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.map': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
} as const;

/**
 * Log a message to the console with error styling.
 */
export function logError(...args: unknown[]) {
    console.error('❌', chalk.bold.red('Error'), ...args);
}

const serverErrors: Record<PropertyKey, string> = {
    EADDRINUSE: 'The port is already in use by another application.',
    ECONNREFUSED: 'Connection refused by the target server.',
    ETIMEDOUT: 'The request to the target server timed out.',
    EHOSTUNREACH: 'The target server is unreachable.',
    ENOTFOUND: 'DNS lookup failed. The target server could not be found.',
    EACCES: 'Permission denied. Please check your privileges.',
    EADDRNOTAVAIL: 'The specified address is not available.',
    ECONNRESET: 'Connection reset by peer.',
    ENETUNREACH: 'Network is unreachable.',
};

/**
 * Log proxy errors to the console with error styling.
 */
export function handleProxyError(err: ServerError, res: ServerResponse) {
    const message = serverErrors[err.code!] ?? 'An unknown error occurred.';
    const target = `${err.address ?? ''}${err.port ? `:${err.port}` : ''}`;
    logError(message, chalk.dim(target));

    // Return a plain text response instead of json so the client will stop loading.
    res.writeHead(500, { 'Content-Type': 'plain/text' });
    res.end(['Error:', message, target].join(' '));
}

/**
 * Log server errors to the console with error styling.
 */
export function handleServerError(err: ServerError) {
    const message = serverErrors[err.code!] ?? err.code ?? 'An unknown error occurred.';
    const target = `${err.address ?? ''}${err.port ? `:${err.port}` : ''}`;
    logError(message, chalk.dim(target));
}

/**
 * Check if the server is running an official-like version of the Screeps server (xxscreeps).
 */
export async function isOfficialLikeVersion(client: Client) {
    try {
        const versionUrl = `${client.getURL(Route.API, { backend: true })}/version`;
        const response = await fetch(versionUrl);
        const version = (await response.json()) as { serverData?: { features?: { name: string }[] } } | undefined;
        return version?.serverData?.features?.some(({ name }) => name.toLowerCase() === 'official-like') ?? false;
    } catch (err) {
        return false;
    }
}

/**
 * Extract the backend and endpoint from a URL.
 */
export function extractBackend(url: string, backend?: string) {
    if (backend) {
        return {
            backend: backend.replace(/\/+$/, ''),
            endpoint: url,
        };
    }
    const groups = /^\/\((?<backend>[^)]+)\)(?<endpoint>\/.*)$/.exec(url)?.groups;
    if (groups) {
        return {
            backend: groups.backend.replace(/\/+$/, ''),
            endpoint: groups.endpoint,
        };
    }
}

/**
 * Utility to trim the local subdomain from a host string.
 */
export function trimLocalSubdomain(host: string): string {
    const parts = host.split('.');
    const localhostIndex = parts.findIndex((p) => p.includes('localhost'));
    if (localhostIndex !== -1) {
        host = parts[localhostIndex];
    }
    return host;
}

/**
 * Utility to generate a script tag with arguments for a function.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function generateScriptTag(func: Function, args: { [key: string]: unknown }) {
    const scriptContent = func.toString();
    const firstBraceIndex = scriptContent.indexOf('{');
    const extractedContent = scriptContent.substring(firstBraceIndex + 1, scriptContent.length - 1);

    const argStrings = Object.entries(args).map(([key, value]) => {
        return `const ${key} = ${JSON.stringify(value)};`;
    });

    return ['<script>', '(function() {', ...argStrings, extractedContent, '})();', '</script>'].join('\n');
}

/**
 * Utility to get the server list configuration.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getServerListConfig(host: string, port: number, serverListPath?: string) {
    if (!serverListPath) {
        const serverListFile = 'server_list.json';
        serverListPath = path.join(__dirname, `../settings/${serverListFile}`);
        if (!existsSync(serverListPath)) {
            serverListPath = path.join(__dirname, serverListFile);
        }
    }

    const serverConfig: Server[] = JSON.parse(await fs.readFile(serverListPath, 'utf-8'));
    const serverTypes = Array.from(new Set(serverConfig.map((server) => server.type)));
    const serverList = serverTypes.map((type) => {
        const serversOfType = serverConfig
            .filter((server) => server.type === type)
            .map((server) => {
                const subdomain = host === 'localhost' && server.subdomain ? `${server.subdomain}.` : '';
                const { origin, pathname } = new URL(server.url);
                const urlpath = pathname.endsWith('/') ? pathname : `${pathname}/`;

                const url = `http://${subdomain}${host}:${port}/(${origin})${urlpath}`;
                const api = `http://${host}:${port}/(${origin})${urlpath}api/version`;
                return { ...server, url, api };
            });

        return {
            name: type.charAt(0).toUpperCase() + type.slice(1),
            logo: type === 'official' ? `http://${host}:${port}/(file)/logotype.svg` : undefined,
            servers: serversOfType,
        };
    });

    return serverList;
}
