import Registry from 'winreg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { error } from './log';

export async function getScreepsPath() {
    const { env, platform } = process;

    switch (platform) {
        case 'darwin': {
            // MacOS, checks for Steam in the default location
            const steamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
            return findScreepsPath(steamPath);
        }

        case 'linux': {
            // WSL support (very basic, checks for Steam in the default location)
            if (env.WSL_DISTRO_NAME) {
                const steamPath = path.join('/mnt/c', 'Program Files (x86)', 'Steam');
                return findScreepsPath(steamPath);
            }

            // Linux, checks for Steam in common locations in the home directory
            for (const dir of [
                ['.steam', 'root', 'steam'], // steam root symlink
                ['.steam', 'steam'], // ubuntu's multiverse repository
                ['.local', 'share', 'Steam'], // steam.deb on steampowered site
                ['.var', 'app', 'com.valvesoftware.Steam', '.steam'], // flatpak
                ['snap', 'steam'], // snapcraft
            ]) {
                const steamPath = path.join(os.homedir(), ...dir);
                const screepsPath = findScreepsPath(steamPath);
                if (screepsPath) {
                    return screepsPath;
                }
            }
            return null;
        }

        case 'win32': {
            // Windows, check registry for Steam path
            let steamPath = await getSteamPathFromWinReg();
            if (steamPath) {
                const screepsPath = findScreepsPath(steamPath);
                if (screepsPath) {
                    return screepsPath;
                }
            }

            // Windows fallback method (very basic, checks for Steam in the default location)
            const programFilesPath = env['PROGRAMFILES(X86)'] || path.join('C:', 'Program Files (x86)');
            steamPath = path.join(programFilesPath, 'Steam');
            return findScreepsPath(steamPath);
        }
    }

    error(`Unsupported operating system '${platform}'.`);
    return null;
}

export function findScreepsPath(steamPath: string) {
    const screepsPath = path.join(steamPath, 'steamapps', 'common', 'Screeps', 'package.nw');
    if (fs.existsSync(screepsPath)) {
        return screepsPath;
    }
    return null;
}

async function getSteamPathFromWinReg(): Promise<string | null> {
    return new Promise((resolve) => {
        const regKey = new Registry({
            hive: Registry.HKLM,
            key: '\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
        });
        return regKey.get('InstallPath', (err, item) => resolve(err ? null : item.value));
    });
}
