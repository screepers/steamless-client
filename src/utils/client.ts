type Options = {
    full?: boolean;
    prefix?: boolean;
    base?: boolean;
};

/**
 * Enum for the available routes in the Screeps Client
 */
export enum Route {
    ROOT = '/',
    API = '/api',
    ASSETS = '/assets',
    HISTORY = '/room-history',
    SOCKET = '/socket',
}

/**
 * Class to generate URLs for the Screeps Client
 */
export class Client {
    private host: string;
    private protocol: string;
    private basePath: string;
    private prefix: string;

    constructor({ host, protocol, prefix, backend }: { host: string; protocol?: string; backend: string; prefix?: string }) {
        this.host = host;
        this.protocol = protocol || 'http';
        this.basePath = `/(${backend})`;
        this.prefix = prefix || '';
    }

    getHost = (opts?: Options) => this.host + (opts?.base !== false ? this.basePath : '');

    getBasePath = (opts?: Options) => (opts?.full ? this.basePath : '');

    getPath = (route: Route, opts?: Options) =>
        this.getBasePath(opts) + (opts?.prefix !== false ? this.prefix : '') + route;

    getURL = (route: Route, opts?: Options) =>
        `${this.protocol}://${this.getHost(opts)}${this.getPath(route, { ...opts, full: false })}`;
}
