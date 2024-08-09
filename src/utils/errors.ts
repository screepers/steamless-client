import chalk from 'chalk';
import { ServerResponse } from 'http';
import type { Socket } from 'net';
import { ServerError } from './types';

const errorCodes: Record<PropertyKey, string> = {
    EADDRINUSE: 'The port is already in use by another application.',
    ECONNABORTED: 'The connection was aborted.',
    ECONNREFUSED: 'Connection refused by the target server.',
    ETIMEDOUT: 'The request to the target server timed out.',
    EHOSTUNREACH: 'The target server is unreachable.',
    ENOTFOUND: 'DNS lookup failed. The target server could not be found.',
    EACCES: 'Permission denied. Please check your privileges.',
    EADDRNOTAVAIL: 'The specified address is not available.',
    ECONNRESET: 'Connection reset by peer.',
    ENETUNREACH: 'Network is unreachable.',
    EAI_AGAIN: 'DNS lookup timed out.',
    EPIPE: 'Broken pipe.',
};

function getErrorDescription(err: ServerError) {
    const message = errorCodes[err.code!] ?? 'Unknown error occurred.';
    return [err.code, message].join(': ');
}

/**
 * Log a message to the console with error styling.
 */
export function logError(...args: unknown[]) {
    console.error('❌', chalk.bold.red('Error'), ...args);
}

/**
 * Log proxy errors to the console with error styling.
 */
export function handleProxyError(err: ServerError, res: ServerResponse | Socket, debug?: boolean) {
    handleServerError(err, debug);

    if (res instanceof ServerResponse && err.code === 'ECONNREFUSED') {
        // Return a plain/text response so the client will stop loading.
        res.writeHead(500, { 'Content-Type': 'plain/text' });
        res.end(String(err));
    }
}

/**
 * Log server errors to the console with error styling.
 */
export function handleServerError(err: ServerError, debug?: boolean) {
    const message = getErrorDescription(err);
    const target = `${err.address ?? ''}${err.port ? `:${err.port}` : ''}`;
    logError(message, chalk.dim(target), ...(debug ? ['\n', err] : []));
}
