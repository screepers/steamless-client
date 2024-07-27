declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        angular: any;
    }
}

export interface Server {
    type: string;
    name: string;
    url: string;
    api: string;
    subdomain?: string;
}

export interface ServerError extends Error {
    errno?: number;
    code?: string;
    syscall?: string;
    address?: string;
    port?: number;
}
