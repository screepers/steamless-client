## Screepers Steamless Client

### Overview

The Screepers Steamless Client is a web proxy for the [Screeps World](https://store.steampowered.com/app/464350/Screeps/) game client. It allows you to run Screeps in your web browser and works with macOS, Linux and Windows setups.

## Requirements

- Node.js v20+
- Screeps World (installed using Steam)

## Installation

Option 1. Temporarily install and run the latest client app:

```sh
npx screepers-steamless-client
```

Option 2. Install globally and then run the client app:

```sh
npm install -g screepers-steamless-client
screepers-steamless-client
```

## Usage

View the server list page at http://localhost:8080/. This address can be changed with the `--host` and `--port` arguments.

Different servers can be accessed from the server list page, or using the url format `http://localhost:8080/(BACKEND_ADDRESS)/`

- For the official server: http://localhost:8080/(https://screeps.com)/

- For a local server on port 21025: http://localhost:8080/(http://localhost:21025)/

The server list page adds subdomains to localhost urls to keep auth tokens in separate local storage for multi server support.

Steam OpenId support is required on your local server. Enable it with [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth). For [xxscreeps](https://github.com/laverdet/xxscreeps/) servers, it's enabled by default.

## Arguments

All of the command line arguments are optional.

- `--package` &mdash; Used to set the path to the Screeps package.nw file. Use this if the path isn't automatically detected.
- `--host` &mdash; Changes the host address. (default: localhost)
- `--port` &mdash; Changes the port. (default: 8080)
- `--backend` &mdash; Used to configure a backend url. If provided, the client app proxies this endpoint and the server list page is disabled.
- `--internal_backend` &mdash; Used to configure an internal backend url. If provided, the client app uses this address to reference the internal server endpoint.
- `--server_list` &mdash; Used to set the path to a custom server list json config file.
- `--beautify` &mdash; Formats .js files loaded in the client for debugging.
- `--debug` &mdash; Display verbose errors for development.
- `-v` , `--version` &mdash; Display the version number.
- `-h` , `--help` &mdash; Display the help message.

## Argument Examples

### Screeps package.nw

If the Screeps package.nw is not automatically detected, you will need to set the path like this:

```sh
npx screepers-steamless-client --package ~/Screeps/package.nw
```

### Backend proxy

Proxy a server directly (disables the server list page).

```sh
npx screepers-steamless-client --backend http://localhost:21025
```

### Docker compose

Example usage with Jomik's [screeps-server](https://github.com/Jomik/screeps-server). You can add this `client` service into your existing docker-compose.yml:

```yaml
# docker-compose.yml
version: '3'
services:
  # ... existing services ...

  client:
    image: node:20
    command: >
      sh -c 'npx screepers-steamless-client
      --package /screeps.nw
      --host 0.0.0.0
      --internal_backend http://screeps:21025
      --backend http://localhost:21025'
    volumes:
      - ${SCREEPS_NW_PATH:?"Missing screeps nw file"}:/screeps.nw
    ports:
      - 8080:8080
    restart: unless-stopped
```

Set up the env variable `SCREEPS_NW_PATH` with the correct path to your Screeps package.nw (for example on macOS):

```bash
# .env
SCREEPS_NW_PATH="~/Library/Application Support/Steam/steamapps/common/Screeps/package.nw"
```

### Custom server list

Set the path to a custom server list json config file.

```sh
npx screepers-steamless-client --server_list ./custom_server_list.json
```

The custom server list json file should follow the same format as [server_list.json](settings/server_list.json). Each object in the json file should include a type, name, and url:
* `type` &mdash; This is used to organize servers into sections.
* `name` &mdash; This is the name of the server.
* `url` &mdash; This is used to create a link to the server.
* `subdomain` &mdash; This prefixes localhost urls for multi server support.

## Development Scripts

- `npm start` &mdash; Builds and starts the client app.
- `npm run build` &mdash; Builds the client app to dist.
- `npm run dev` &mdash; Builds and watches for changes (hot reloading).
- `npm run format` &mdash; Formats the src using Prettier.
- `npm run lint` &mdash; Lints the src using ESLint.

## Tips

This client uses "guest mode" by default in [xxscreeps](https://github.com/laverdet/xxscreeps/), providing a read-only view of the server when not signed in. To sign in with your Steam account, select "Sign Out" first, then click the Steam icon to sign in and play as normal.

![Safari Example](./docs/safari.png)
