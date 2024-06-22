## Screepers Steamless Client

### Overview

The Screepers Steamless Client is a web proxy that allows you to run [Screeps: World](https://store.steampowered.com/app/464350/Screeps/), a game purchased via Steam, directly in your browser. It overcomes compatibility issues with the official Screeps client on many macOS devices. This client uses the Screeps files installed with Steam and enables gameplay on official and private servers across macOS, Linux, and Windows using the browser of your choice.

### Installation & Usage

```sh
npm install -g screepers-steamless-client
npx screepers-steamless-client
```

Access the client at http://localhost:8080/. This address can be changed with the `--host` and `--port` arguments.

If the `--backend` argument is used, this URL will directly proxy the backend server. This disables the server list page.

If not using the `--backend` argument, you can use the format `http://localhost:8080/(SERVER_ADDRESS)/` to access different servers. Note that you can only log in to one server at a time.

- For the official server: http://localhost:8080/(https://screeps.com)/

- For a local server on port 21025: http://localhost:8080/(http://localhost:21025)/

Steam OpenId support is required on your local server. Enable it with [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth). For [xxscreeps](https://github.com/laverdet/xxscreeps/) servers, it's enabled by default.

### Command Line Arguments

- `--backend`: Specifies the backend URL. If provided, the entire URL is used as the endpoint.
- `--internal_backend`: Specifies the internal backend URL. If provided, this URL is used to reference the internal endpoint.
- `--package`: Specifies the path to the Screeps client package.nw file. Only needed if the path isn't automatically detected.
- `--host`: Changes the host address. (default: `localhost`)
- `--port`: Changes the port. (default: `8080`)
- `--server_list`: Specifies the path to a custom server list json file to use for the Server List page.
- `--beautify`: Formats .js files loaded in the client for debugging.

### Examples

#### Package path

Specify the path to the Screeps client package.nw if not automatically detected:

```sh
npx screepers-steamless-client --package ~/Screeps/package.nw
```

#### Backend proxy

Proxy a server directly (disables the server list page):

```sh
npx screepers-steamless-client --backend https://screeps.com
npx screepers-steamless-client --backend http://localhost:21025
```

#### Docker compose

Example usage with Jomik's [screeps-server](https://github.com/Jomik/screeps-server). You can copy the `client` service into your docker-compose.yml file (into the `services` section and before `volumes` section)

```yaml
# docker-compose.yml
version: "3"
services:
  # ... existing services ...

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

#### Custom server list

Specify the path to your custom server list json file:

```sh
npx screepers-steamless-client --server_list ./custom_server_list.json
```

The custom server list json file should follow the same format as the provided [server_list.json](server_list.json). Each object in the json file should include a `type`, `name`, and `url`:
* `type`: This is used to organize servers into sections.
* `name`: This is the name of the server.
* `url`: This is used to create a link to the server.

```json
[
  {
    "type": "official",
    "name": "Official Server",
    "url": "https://screeps.com",
    "subdomain": "mmo"
  },
  {
    "type": "private",
    "name": "Local Server",
    "url": "http://localhost:21025",
    "subdomain": "private"
  }
]
```

### Development Scripts

This project includes several scripts for development purposes:

- `build`: Compiles to `dist`. Run this script with `npm run build`.
- `dev`: Compiles to `dist` and watches for changes. Run this script with `npm run dev`.
- `format`: Formats the `src` directory using Prettier. Run this script with `npm run format`.
- `lint`: Lints the `src` directory using ESLint. Run this script with `npm run lint`.
- `prepare`: Compiles to `dist`. This script is automatically run before the package is packed or published, and when installing git dependencies. Run this script with `npm run prepare`.

### Tips

This client uses "guest mode" by default in [xxscreeps](https://github.com/laverdet/xxscreeps/), providing a read-only view of the server when not signed in. To sign in with your Steam account, select "Sign Out" first, then click the Steam icon to sign in and play as normal.

![Safari Example](./docs/safari.png)
