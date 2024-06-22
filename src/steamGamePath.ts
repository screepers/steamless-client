import Registry from 'winreg';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function getSteamPathFromWinReg(): Promise<string> {
    return new Promise((resolve, reject) => {
        const regKey = new Registry({
            hive: Registry.HKCU,
            key: '\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
        });

        return regKey.get('InstallPath', (err, item) => {
            if (err) {
                reject(err);
            } else {
                resolve(item.value);
            }
        });
    });
}

async function getSteamPath() {
    switch (process.platform) {
        case 'linux': {
            // WSL support (very basic, only checks for Steam in the default location)
            if (process.env.WSL_DISTRO_NAME) {
                const steamPath = path.join('/mnt/c/', 'Program Files (x86)', 'Steam');
                if (fs.existsSync(steamPath)) {
                    return steamPath;
                }
                return null;
            }

            // Other linux distributions, check common Steam locations
            [
                ['.steam', 'root'],
                ['.steam', 'steam'],
                ['.local', 'share', 'Steam'],
            ].forEach((steamFolders) => {
                const steamPath = path.join(os.homedir(), ...steamFolders);
                if (fs.existsSync(steamPath)) {
                    return steamPath;
                }
            });
            return null;
        }

        case 'win32': {
            // Windows, check registry for Steam path
            const steamPath = await getSteamPathFromWinReg();
            if (fs.existsSync(steamPath)) {
                return steamPath;
            }
            return null;
        }

        case 'darwin': {
            // MacOS, check default Steam location
            const steamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
            if (fs.existsSync(steamPath)) {
                return steamPath;
            }
            return null;
        }

        default:
            throw new Error('Unsupported operating system');
    }
}

export async function getScreepsPath() {
    const steamPath = await getSteamPath();
    if (!steamPath) return null;

    const screepsPath = path.join(steamPath, 'steamapps', 'common', 'Screeps', 'package.nw');
    if (fs.existsSync(screepsPath)) {
        return screepsPath;
    }
    return null;
}
