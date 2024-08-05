import Registry from 'winreg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logError } from './errors';

/**
 * Get the path to the Screeps game files.
 */
export async function getScreepsPath() {
    const { env, platform } = process;

    switch (platform) {
        case 'darwin': {
            // MacOS, checks for screeps in the default Steam location
            const steamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
            return getScreepsPackagePath(steamPath);
        }

        case 'linux': {
            // WSL support, checks for screeps in the default Steam location on the Windows host
            if (env.WSL_DISTRO_NAME) {
                const mountPath = '/mnt';
                const mountDrives = fs.readdirSync(mountPath).filter((name) => name.length === 1);
                for (const drive of mountDrives) {
                    const steamPath = path.join(mountPath, drive, 'Program Files (x86)', 'Steam');
                    const screepsPath = getScreepsPackagePath(steamPath);
                    if (screepsPath) {
                        return screepsPath;
                    }
                }
                return null;
            }

            // Linux, checks for screeps in common Steam locations within the user's home directory
            for (const dir of [
                ['.steam', 'root', 'steam'], // steam root symlink
                ['.steam', 'steam'], // ubuntu's multiverse repository
                ['.local', 'share', 'Steam'], // steam.deb on steampowered site
                ['.var', 'app', 'com.valvesoftware.Steam', '.steam'], // flatpak
                ['snap', 'steam'], // snapcraft
            ]) {
                const steamPath = path.join(os.homedir(), ...dir);
                const screepsPath = getScreepsPackagePath(steamPath);
                if (screepsPath) {
                    return screepsPath;
                }
            }
            return null;
        }

        case 'win32': {
            // Windows, checks for screeps in Steam location from the Windows registry
            let steamPath = await getSteamPathFromWinReg();
            if (steamPath) {
                const screepsPath = getScreepsPackagePath(steamPath);
                if (screepsPath) {
                    return screepsPath;
                }
            }

            // Windows fallback, checks for screeps in the default Steam location
            const programFilesPath =
                env['PROGRAMFILES(X86)'] || path.join(env.SystemDrive || 'C:', 'Program Files (x86)');
            steamPath = path.join(programFilesPath, 'Steam');
            return getScreepsPackagePath(steamPath);
        }
    }

    logError(`Unsupported operating system '${platform}'.`);
    return null;
}

/**
 * Returns the path to the Screeps package.nw in the given Steam directory if it exists.
 */
function getScreepsPackagePath(steamPath: string) {
    const screepsPath = path.join(steamPath, 'steamapps', 'common', 'Screeps', 'package.nw');
    if (fs.existsSync(screepsPath)) {
        return screepsPath;
    }
    return null;
}

/**
 * Get the Steam installation path from the Windows registry.
 */
async function getSteamPathFromWinReg(): Promise<string | null> {
    return new Promise((resolve) => {
        const regKey = new Registry({
            hive: Registry.HKLM,
            key: '\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
        });
        return regKey.get('InstallPath', (err, item) => resolve(err ? null : item.value));
    });
}
