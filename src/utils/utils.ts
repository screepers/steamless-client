import { existsSync, promises as fs } from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { Server, Route } from './server';
import { ServerInfo } from './types';

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
export async function isOfficialLikeVersion(server: Server) {
    try {
        const versionUrl = server.getURL(Route.VERSION, { path: false });
        const response = await fetch(versionUrl);
        const version = (await response.json()) as { serverData?: { features?: { name: string }[] } } | undefined;
        return version?.serverData?.features?.some(({ name }) => name.toLowerCase() === 'official-like') ?? false;
    } catch (_err) {
        return false;
    }
}

/**
 * Utility to generate a script tag with arguments for a function.
 */
export function generateScriptTag(func: { toString(): string }, args: { [key: string]: unknown }) {
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
    publicUrl: URL,
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

    const serverConfig: ServerInfo[] = JSON.parse(await fs.readFile(serverListPath, 'utf-8'));
    const serverTypes = Array.from(new Set(serverConfig.map((server) => server.type)));
    const serverList = serverTypes.map((type) => {
        const serversOfType = serverConfig
            .filter((info) => info.type === type)
            .map((info) => {
                const server = Server.fromInfo(publicUrl, info.url, useSubdomains ? info.subdomain : '');
                return {
                    ...info,
                    url: server.getURL(Route.ROOT),
                    // We skip the subdomain here to keep CORS happy
                    api: server.getURL(Route.VERSION, { subdomain: false }),
                };
            });

        return {
            name: type.charAt(0).toUpperCase() + type.slice(1),
            logo: type === 'official' ? `${publicUrl.toString()}(file)/logotype.svg` : undefined,
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
        { title: "Lord Greywether's blog", url: 'https://jonwinsley.com/categories/screeps' },
    ];
}
