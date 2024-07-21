export class ClientPath {
    private host: string;
    private port: number;
    private basePath: string;
    private prefix: string;

    constructor({
        host,
        backend,
        port,
        server,
        prefix,
    }: {
        host: string;
        port: number;
        backend: string;
        server: string;
        prefix?: string;
    }) {
        this.host = host;
        this.port = port;
        this.basePath = backend ? '' : `/(${server})`;
        this.prefix = prefix || '';
    }

    getPath = (path: string = '') => `${this.prefix}${path}`;
    getHost = () => `${this.host}:${this.port}${this.basePath}`;
    getURL = (path: string = '') => `http://${this.getHost()}${this.getPath(path)}`;
    getRoomHistoryURL = () => this.getURL('/room-history');
    getAssetsURL = () => this.getURL('/assets');
}
