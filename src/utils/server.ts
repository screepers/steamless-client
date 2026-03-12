export const AWS_HOST = 'https://s3.amazonaws.com';
export interface ServerOptions {
    /** Whether to include the host in the final URL  */
    hostUrl?: boolean;
    /** Whether to include the backend in the final URL. If a string is passed, it'll be used as an override backend URL */
    backend?: boolean | string;
    /** Whether to add the subdomain to the public host */
    subdomain?: boolean;
    /** Whether to include the full path */
    path?: boolean;
}

/**
 * Enum for the available routes in the Screeps Client
 */
export enum Route {
    ROOT = '/',
    API = '/api',
    VERSION = '/api/version',
    ASSETS = '/assets',
    HISTORY = '/room-history',
    SOCKET = '/socket',
}

/**
 * Class to generate URLs for the Screeps Client
 */
export class Server {
    private host: string;
    private port: string;
    private subdomain: string;
    private protocol: string;
    private backendUrl: string;
    private path: string;

    static fromInfo(url: URL, backendUrl: string, subdomain = '') {
        return new this({
            host: url.hostname,
            port: url.port,
            protocol: url.protocol,
            subdomain,
            backendUrl,
        });
    }

    static fromRequest(hostUrl: URL, url: string) {
        const groups = /^\/\((?<backend>[^)]+)\)(?<endpoint>\/.*)$/.exec(url)?.groups;
        if (!groups) return null;
        const info = {
            backend: groups.backend.replace(/\/+$/, ''),
            endpoint: groups.endpoint,
        };

        if (info.backend.startsWith('https://screeps.com')) {
            // This is a "backend path outside of `()` origin" url, fix it up so the path stays with the backend
            const match = info.endpoint.match(/^\/(season|ptr)/);
            if (match) {
                info.backend += match[0];
                info.endpoint = info.endpoint.slice(match[0].length);
            }
        }
        const { protocol, hostname, port } = hostUrl;
        const dot = hostname.indexOf('.');
        const subdomain = hostname.slice(0, dot);
        const host = hostname.slice(dot + 1);
        return new this({
            host,
            port,
            protocol,
            subdomain,
            backendUrl: info.backend,
            path: info.endpoint,
        });
    }

    private constructor({
        host,
        port,
        protocol,
        path,
        backendUrl,
        subdomain,
    }: {
        host: string;
        port: string;
        protocol?: string;
        backendUrl: string;
        subdomain?: string;
        path?: string;
    }) {
        this.protocol = protocol ?? 'http:';
        this.host = host;
        this.port = port;
        this.subdomain = subdomain ?? '';
        this.backendUrl = backendUrl;
        this.path = path ?? '';
    }

    /**
     * Debug helper that logs the whole server configuration
     */
    dump(arg: string) {
        console.info(arg, {
            protocol: this.protocol,
            host: this.host,
            port: this.port,
            subdomain: this.subdomain,
            backendUrl: this.backendUrl,
            path: this.path,
            isOfficial: this.isOfficial,
            isSeason: this.isSeason,
            isPtr: this.isPtr,
        });
    }

    get isOfficial() {
        return this.backendUrl.startsWith('https://screeps.com');
    }

    get isSeason() {
        return this.backendUrl.startsWith('https://screeps.com/season');
    }

    get isPtr() {
        return this.backendUrl.startsWith('https://screeps.com/ptr');
    }

    /**
     * Returns the server backend this object refers to
     */
    get backend() {
        return this._getBackendUrl({ backend: true });
    }

    /**
     * Returns the path part of the backend URL
     */
    get backendPath() {
        return this.backend !== 'file' ? new URL(this.backend).pathname : '/';
    }

    /**
     * Returns the endpoint path this object refers to
     */
    get endpoint() {
        return this.getPath({ backend: false, path: true });
    }

    /**
     * Build a complete server url for a Screeps server
     */
    getPublicUrl(opts?: Pick<ServerOptions, 'backend' | 'subdomain' | 'hostUrl'>) {
        const subdomain = this.subdomain && opts?.subdomain !== false ? `${this.subdomain}.` : '';
        const port =
            this.port &&
            ((this.protocol === 'http:' && this.port !== '80') || (this.protocol === 'https:' && this.port !== '443'))
                ? `:${this.port}`
                : '';
        const domain = opts?.hostUrl !== false ? `${this.protocol}//${subdomain}${this.host}${port}/` : '/';
        const backend = opts?.backend !== false ? `(${this._getBackendUrl(opts)})` : '';
        return `${domain}${backend}`;
    }

    /**
     * Returns the actual server backend we're connecting to
     */
    private _getBackendUrl(opts?: Pick<ServerOptions, 'backend'>) {
        return opts?.backend !== false ? (typeof opts?.backend === 'string' ? opts.backend : this.backendUrl) : '';
    }

    /**
     * Get the path corresponding to the server
     */
    getPath(opts?: Pick<ServerOptions, 'backend' | 'path'>) {
        return (opts?.backend !== false ? this._getBackendUrl(opts) : '') + (opts?.path !== false ? this.path : '');
    }

    /**
     * Get the path for a specific route
     */
    getRoute(route: Route, opts?: Pick<ServerOptions, 'backend' | 'path'>) {
        return this.getPath(opts) + route;
    }

    /**
     * Get the URL for a specific route
     */
    getURL(route: Route, opts?: ServerOptions) {
        return `${this.getPublicUrl(opts)}${this.getRoute(route, { ...opts, backend: false })}`;
    }
}
