import { AnyPatch, PatchError } from './helpers';
import { Server } from 'utils/server';
import { Args } from 'clientApp';
import { logError } from 'utils/errors';
import chalk from 'chalk';

import beautify from './beautify';
import brokenReplays from './brokenReplays';
import fixAlphaMapBounds from './fixAlphaMapBounds';
import clientAuth from './clientAuth';
import customMenuLinks from './customMenuLinks';
import fixConfig from './fixConfig';
import formatMarketNumbers from './formatMarketNumbers';
import placeSpawnDefaultOff from './placeSpawnDefaultOff';
import portalInfo from './portalInfo';
import removeTracking from './removeTracking';
import stripAws from './stripAws';
import terrainTilesProfileView from './terrainTilesProfileView';

const patches: AnyPatch[] = [
    fixConfig,
    stripAws,
    clientAuth,
    customMenuLinks,
    removeTracking,
    terrainTilesProfileView,
    placeSpawnDefaultOff,
    brokenReplays,
    portalInfo,
    fixAlphaMapBounds,
    formatMarketNumbers,
    // Must be last
    beautify,
];

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
