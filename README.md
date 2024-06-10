## Screepers Steamless Client

### Overview

The Screepers Steamless Client is a package that allows you to run the [Screeps](https://screeps.com/) game client in your browser. It's designed for users who have purchased [Screeps](https://store.steampowered.com/app/464350/Screeps/) on Steam. The official Screeps client, which uses an older version of [NW.js](https://nwjs.io/), lacks support for many macOS devices. This client serves the Screeps files installed via Steam, enabling you to run Screeps in your browser on macOS, Linux, and Windows.

### Installation & Usage

```sh
npm install -g screepers-steamless-client
npx screepers-steamless-client
```

Access the client at http://localhost:8080/. This address can be changed with the `--host` and `--port` arguments.

If the `--backend` argument is used, this URL will directly proxy the backend server. This disables the server list page.

If not using the `--backend` argument, you can use the format `http://localhost:8080/(SERVER_ADDRESS)/` to access different servers. Note that you can only log in to one server at a time.

-   For the official server: http://localhost:8080/(https://screeps.com)/

-   For a local server on port 21025: http://localhost:8080/(http://localhost:21025)/

Steam OpenId support is required on your local server. Enable it with [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth). For [xxscreeps](https://github.com/laverdet/xxscreeps/) servers, it's enabled by default.

### Command Line Arguments

-   `--backend`: Specifies the backend URL. If provided, the entire URL is used as the endpoint.
-   `--internal_backend`: Specifies the internal backend URL. If provided, this URL is used to reference the internal endpoint.
-   `--package`: Specifies the path to the Screeps client package.nw file. Only needed if the path isn't automatically detected.
-   `--host`: Changes the host address. (default: `localhost`)
-   `--port`: Changes the port. (default: `8080`)
-   `--beautify`: Formats .js files loaded in the client for debugging.

### Examples

Set the path to the Screeps client package.nw file (only if not automatically detected):

```sh
npx screepers-steamless-client --package ~/Screeps/package.nw
```

Proxy a server directly (server list disabled):

```sh
npx screepers-steamless-client --backend https://screeps.com
npx screepers-steamless-client --backend http://localhost:21025
```

Example usage with Jomik's [screeps-server](https://github.com/Jomik/screeps-server).

```yaml
# docker-compose.yml
version: '3'
services:
    client:
        image: node:16
        command: sh -c 'npx screepers-steamless-client --package /screeps.nw --host 0.0.0.0 --internal_backend http://screeps:21025 --backend http://localhost:21025'
        volumes:
            - ${SCREEPS_NW_PATH:?"Missing screeps nw file"}:/screeps.nw
        ports:
            - 8080:8080
        restart: unless-stopped
```

```bash
# .env
SCREEPS_NW_PATH="~/Library/Application Support/Steam/steamapps/common/Screeps/package.nw"
```

### Tips

This client uses "guest mode" by default in [xxscreeps](https://github.com/laverdet/xxscreeps/), providing a read-only view of the server when not signed in. To sign in with your Steam account, select "Sign Out" first, then click the Steam icon to sign in and play as normal.

![Safari Example](./docs/safari.png)
