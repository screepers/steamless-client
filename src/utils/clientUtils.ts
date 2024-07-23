import chalk from 'chalk';
import path from 'path';
import { existsSync, promises as fs } from 'fs';
import { fileURLToPath, URL } from 'url';
import fetch from 'node-fetch';
import { type Client, Route } from './client';
import { Server } from './types';

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
