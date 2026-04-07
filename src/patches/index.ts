import { AnyPatch, PatchError } from './helpers.js';
import { Server } from '../utils/server.js';
import { Args } from '../clientApp.js';
import { logError } from '../utils/errors.js';
import chalk from 'chalk';

import beautify from './beautify.js';
import fixAlphaMapBounds from './fixAlphaMapBounds.js';
import clientAuth from './clientAuth.js';
import customMenuLinks from './customMenuLinks.js';
import fixConfig from './fixConfig.js';
import formatMarketNumbers from './formatMarketNumbers.js';
import highPerfWebGL from './highPerfWebGL.js';
import normalizeStringPosix from './normalizeStringPosix.js';
import placeSpawnDefaultOff from './placeSpawnDefaultOff.js';
import portalInfo from './portalInfo.js';
import quietConsole from './quietConsole.js';
import removeTracking from './removeTracking.js';
import serverStats from './serverStats.js';
import screepsAudio from './screepsAudio.js';
import stripAws from './stripAws.js';
import terrainTilesProfileView from './terrainTilesProfileView.js';
import versionUpdate from './versionUpdate.js';

const patches: AnyPatch[] = [
    fixConfig,
    stripAws,
    clientAuth,
    normalizeStringPosix,
    customMenuLinks,
    removeTracking,
    terrainTilesProfileView,
    placeSpawnDefaultOff,
    portalInfo,
    fixAlphaMapBounds,
    formatMarketNumbers,
    highPerfWebGL,
    serverStats,
    versionUpdate,
    screepsAudio,
    quietConsole,
    // Must be last
    beautify,
];

export function listPatches() {
    let msg = `List of supported patch ids:\n`;
    const maxIdLen = patches.reduce((len, patch) => (patch.id.length > len ? patch.id.length : len), 0);
    for (const patch of patches.sort((a, b) => a.id.localeCompare(b.id))) {
        msg += ` ${' '.padStart(maxIdLen - patch.id.length + 1, ' ')}${patch.id} - ${patch.description}${patch.disabled ? ' (disabled)' : ''}\n`;
    }
    console.log(msg);
}

export function checkPatches(yesPatch: Set<string>, noPatch: Set<string>) {
    const patchDiff = yesPatch.intersection(noPatch);
    if (patchDiff.size) {
        logError(`patch ids ${[...patchDiff].join(', ')} are in both --patch and --no_patch`);
        process.exit(1);
    }
    for (const id of [...yesPatch, ...noPatch]) {
        if (patches.find((p) => p.id === id)) continue;
        logError(`unknown patch id '${id}'`);
        process.exit(1);
    }
}

export function hasPatches(urlPath: string): boolean {
    return patches.some((patch) => {
        const subpatches = 'match' in patch ? [patch] : patch.patches;
        return subpatches.some((subpatch) => subpatch.match(urlPath));
    });
}

export async function applyPatches(urlPath: string, source: string, server: Server, argv: Args): Promise<string> {
    const debug = (...args: unknown[]) => {
        if (argv.debug) {
            console.log(chalk.dim(...args));
        }
    };

    for (const patch of patches) {
        if (argv.no_patch.has(patch.id)) {
            debug(`not applying patch '${patch.id}'`);
            continue;
        }
        if (patch.disabled) {
            if (!argv.patch.has(patch.id)) {
                continue;
            }
            debug(`applying disabled patch '${patch.id}'`);
        }
        debug(`applying patch '${patch.id}' to ${urlPath}…`);
        const patches = 'apply' in patch ? [patch] : patch.patches;
        let applied = false;
        let incomplete = false;
        for (const subpatch of patches) {
            if (!subpatch.match(urlPath)) {
                debug(`patch '${patch.id}' doesn't apply to ${urlPath}…`);
                continue;
            }
            try {
                debug(`applying '${patch.id} to ${urlPath}…`);
                source = await subpatch.apply(source, server, argv);
            } catch (e) {
                if (e instanceof PatchError) {
                    logError(`patch '${patch.id}' failed to apply to '${urlPath}': ${e.original}`);
                    incomplete = true;
                    if (argv.debug) {
                        // console.log(source);
                    }
                }
            }
            applied = true;
        }
        if (applied) {
            console.log(`${incomplete ? '⚠️ partially' : '✅'} applied patch '${patch.id}' to file ${urlPath}`);
        }
    }
    return source;
}
