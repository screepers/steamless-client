declare global {
    interface Window {
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

export interface CodeStore {
    timestamp: number;
}
