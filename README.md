## Screepers Steamless Client

### Overview

The Screepers Steamless Client is a web proxy for the [Screeps World](https://store.steampowered.com/app/464350/Screeps/) game client. It allows you to run Screeps in your web browser and works with macOS, Linux and Windows setups.

## Requirements

- Node.js v20+
- Screeps World (installed using Steam)

## Installation

### Run with NPX

Install the latest version in a temporary location and run the client:

```sh
npx screepers-steamless-client
```

### Install Globally with NPM

Install the latest version globally with npm and run the client:

```sh
npm install -g screepers-steamless-client
screepers-steamless-client
```

### Run with Docker Compose

Use Docker Compose to run the client. Create a `compose.yaml` file in an empty folder or update an existing one by adding the `client` entry under `services`.

```yaml
services:
  client:
    image: node:20
    command: >
      npx screepers-steamless-client
      --package /screeps.nw
      --host 0.0.0.0
    volumes:
      - ${SCREEPS_NW_PATH:?"Missing screeps nw file"}:/screeps.nw
    ports:
      - 8080:8080
    restart: unless-stopped
```

Create a `.env` file with the following content. Replace the path with the actual path to your Screeps `package.nw` file.

```bash
SCREEPS_NW_PATH="~/Library/Application Support/Steam/steamapps/common/Screeps/package.nw"
```

Run the Docker container:

```bash
docker compose up
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

- `-h` , `--help` &mdash; Display the help message.
- `-v` , `--version` &mdash; Display the version number.
- `--package` &mdash; Path to the Screeps package.nw file. Use this if the path isn't automatically detected.
- `--host` &mdash; Changes the host address. (default: localhost)
- `--port` &mdash; Changes the port. (default: 8080)
- `--backend` &mdash; Set the backend url. When provided, the app will directly proxy this server and disable the server list page.
- `--internal_backend` &mdash; Set the backend's internal url. Requires --backend to be set. When provided, the app will use this url to connect to the server while still using its --backend name externally.
- `--server_list` &mdash; Path to a custom server list json config file.
- `--beautify` &mdash; Formats .js files loaded in the client for debugging.
- `--debug` &mdash; Display verbose errors for development.

## Examples

### `--package`

If the Screeps package.nw is not automatically detected, you can provide the path to the Screeps package.nw file.

```sh
npx screepers-steamless-client --package ~/screeps/package.nw
```

### `--backend`

Proxy a specific server and disable the server list page.

```sh
npx screepers-steamless-client --backend http://localhost:21025
```

### `--internal_backend`

Specify the internal backend for container environments when using the `--backend` option.

```sh
npx screepers-steamless-client --backend http://localhost:21025 --internal_backend http://screeps:21025
```

### `--server_list`

Customize your server list by copying the [server_list.json](settings/server_list.json) file and making your changes.

Run the client with your custom server list:

```sh
npx screepers-steamless-client --server_list ./custom_server_list.json
```

## Development Scripts

- `npm start` &mdash; Build and start the client app.
- `npm run build` &mdash; Build the client app to dist.
- `npm run dev` &mdash; Build and watch for changes (hot reload).
- `npm run format` &mdash; Format the src using Prettier.
- `npm run lint` &mdash; Lint the src using ESLint.

## Tips

This client uses "guest mode" by default in [xxscreeps](https://github.com/laverdet/xxscreeps/), providing a read-only view of the server when not signed in. To sign in with your Steam account, select "Sign Out" first, then click the Steam icon to sign in and play as normal.

![Safari Example](./docs/safari.png)
