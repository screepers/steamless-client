import { existsSync, promises as fs } from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { URL } from 'url';
import { Route, type Client } from './client';
import { Server } from './types';
import { logError } from './errors';

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
 * Check if the server is running an official-like version of the Screeps server (xxscreeps).
 */
export async function isOfficialLikeVersion(client: Client) {
    try {
        const versionUrl = `${client.getURL(Route.API)}/version`;
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
export function extractBackend(url: string) {
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
export async function getServerListConfig(
    dirname: string,
    protocol: string,
    host: string,
    port: number,
    useSubdomains: boolean,
    serverListPath?: string,
) {
    if (!serverListPath) {
        const serverListFile = 'server_list.json';
        serverListPath = path.join(dirname, `../settings/${serverListFile}`);
        if (!existsSync(serverListPath)) {
            serverListPath = path.join(dirname, serverListFile);
        }
    }

    const serverConfig: Server[] = JSON.parse(await fs.readFile(serverListPath, 'utf-8'));
    const serverTypes = Array.from(new Set(serverConfig.map((server) => server.type)));
    const serverList = serverTypes.map((type) => {
        const serversOfType = serverConfig
            .filter((server) => server.type === type)
            .map((server) => {
                const subdomain = useSubdomains && server.subdomain ? `${server.subdomain}.` : '';
                const { origin, pathname } = new URL(server.url);
                const urlpath = pathname.endsWith('/') ? pathname : `${pathname}/`;

                const protocolPort = protocol == 'https' ? 443 : 80;
                const hostport = port == protocolPort ? host : `${host}:${port}`;

                const url = `${protocol}://${subdomain}${hostport}/(${origin})${urlpath}`;
                const api = `${protocol}://${hostport}/(${origin})${urlpath}api/version`;
                return { ...server, url, api };
            });

        return {
            name: type.charAt(0).toUpperCase() + type.slice(1),
            logo: type === 'official' ? `${protocol}://${host}:${port}/(file)/logotype.svg` : undefined,
            servers: serversOfType,
        };
    });

    return serverList;
}

export function getCommunityPages(): { title: string; url: string }[] {
    return [
        { title: 'Screeps Wiki', url: 'https://wiki.screepspl.us/index.php/Screeps_Wiki' },
        { title: 'Community Grafana', url: 'https://pandascreeps.com/' },
        {
            title: "MarvinTMB's videos",
            url: 'https://www.youtube.com/playlist?list=PLGlzrjCmziEj7hQZSwcmkXkMXgkQXUQ6C',
        },
        {
            title: "Atanner's videos",
            url: 'https://www.youtube.com/watch?v=N7KMOG8C5vA&list=PLw9di5JwI6p-HUP0yPUxciaEjrsFb2kR2',
        },
        { title: "Muon's blog", url: 'https://bencbartlett.com/blog/tag/screeps/' },
        { title: "Harabi's blog", url: 'https://sy-harabi.github.io/' },
    ];
}

export function applyPatch(data: string, original: string | RegExp, replace: string) {
    const repl = data.replace(original, replace);
    if (data.localeCompare(repl) === 0) {
        logError(`failed to apply patch! "${original}"`);
    }
    return repl;
}
