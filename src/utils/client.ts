type Options = {
    full?: boolean;
    prefix?: boolean;
    backend?: boolean;
    base?: boolean;
};

export enum Route {
    ROOT = '/',
    API = '/api',
    ASSETS = '/assets',
    HISTORY = '/room-history',
    SOCKET = '/socket',
    REGISTER = '/#!/register',
}

export class Client {
    private host: string;
    private basePath: string;
    private prefix: string;
    private internal?: string;
    private backend?: string;

    constructor({
        host,
        server,
        backend,
        internal,
        prefix,
    }: {
        host: string;
        server: string;
        backend?: string;
        internal?: string;
        prefix?: string;
    }) {
        this.host = host;
        this.basePath = backend ? '' : `/(${server})`;
        this.prefix = prefix || '';
        this.internal = internal;
        this.backend = backend;
    }

    getHost = (opts?: Options) => {
        const baseUrl = this.host + (opts?.base !== false ? this.basePath : '');
        return opts?.backend ? this.internal ?? this.backend ?? baseUrl : baseUrl;
    };
    getBasePath = (opts?: Options) => (opts?.full ? this.basePath : '');
    getPath = (route: Route, opts?: Options) =>
        this.getBasePath(opts) + (opts?.prefix !== false ? this.prefix : '') + route;
    getURL = (route: Route, opts?: Options) =>
        `http://${this.getHost(opts)}${this.getPath(route, { ...opts, full: false })}`;
}
