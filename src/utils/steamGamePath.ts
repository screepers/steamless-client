import Registry from 'winreg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { error } from './log';

export async function getScreepsPath() {
    const steamPath = await getSteamPath();
    if (!steamPath) return null;

    const screepsPath = path.join(steamPath, 'steamapps', 'common', 'Screeps', 'package.nw');
    if (fs.existsSync(screepsPath)) {
        return screepsPath;
    }
    return null;
}

async function getSteamPath() {
    switch (process.platform) {
        case 'linux': {
            // WSL support (very basic, checks for Steam in the default location)
            if (process.env.WSL_DISTRO_NAME) {
                const steamPath = path.join('/mnt/c', 'Program Files (x86)', 'Steam');
                if (fs.existsSync(steamPath)) {
                    return steamPath;
                }
                return null;
            }

            // Linux, checks for Steam in common locations in the home directory
            for (const dir of [
                ['.steam', 'root'], // symlink usually pointing to the Steam directory (most common)
                ['.steam', 'steam'], // ubuntu's multiverse repository
                ['.local', 'share', 'Steam'], // steam.deb on steampowered website
                ['.var', 'app', 'com.valvesoftware.Steam', '.steam'], // flatpak
                ['snap', 'steam'], // snapcraft
            ]) {
                const steamPath = path.join(os.homedir(), ...dir);
                if (fs.existsSync(steamPath)) {
                    return steamPath;
                }
            }
            return null;
        }

        case 'win32': {
            // Windows, check registry for Steam path
            let steamPath = await getSteamPathFromWinReg();
            if (steamPath && fs.existsSync(steamPath)) {
                return steamPath;
            }

            // Windows fallback method (very basic, checks for Steam in the default location)
            const programFilesPath = process.env['PROGRAMFILES(X86)'] || path.join('C:', 'Program Files (x86)');
            steamPath = path.join(programFilesPath, 'Steam');
            if (fs.existsSync(steamPath)) {
                return steamPath;
            }
            return null;
        }

        case 'darwin': {
            // MacOS, checks for Steam in the default location
            const steamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
            if (fs.existsSync(steamPath)) {
                return steamPath;
            }
            return null;
        }
    }

    error('Unsupported operating system.');
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
