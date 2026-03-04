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

    constructor({
        host,
        protocol,
        prefix,
        backend,
    }: {
        host: string;
        protocol?: string;
        backend: string;
        prefix?: string;
    }) {
        this.host = host;
        this.protocol = protocol || 'http';
        this.basePath = `/(${backend})`;
        this.prefix = prefix || '';
    }

    getHost = (opts?: { base?: boolean }) => this.host + (opts?.base !== false ? this.basePath : '');

    getBasePath = (opts?: { full?: boolean }) => (opts?.full ? this.basePath : '');

    getPath = (route: Route, opts?: { full: boolean; prefix?: boolean }) =>
        this.getBasePath(opts) + (opts?.prefix !== false ? this.prefix : '') + route;

    getURL = (route: Route, opts?: { base?: boolean; full?: boolean; prefix?: boolean }) =>
        `${this.protocol}://${this.getHost(opts)}${this.getPath(route, { ...opts, full: false })}`;
}
