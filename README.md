## Screepers Steamless Client

### Overview

The Screepers Steamless Client is a web proxy for the [Screeps World](https://store.steampowered.com/app/464350/Screeps/) game client. It allows you to run Screeps in your web browser and works with macOS, Linux and Windows setups.

## Requirements

- Node.js v20+ or Docker Compose v3+
- Screeps World purchased and installed via Steam

Steam and the game do not necessarily need to be installed on the same system on which you will deploy the proxy.
**However**, the game should be legally purchased by you and installed on a system you own.
Not only does this support the developers, but it allows you to keep your proxy up-to-date,
as the client receives regular updates automatically via Steam. Copying the client binary
from another system will require you to repeat that process each time the client is updated.

## Installation

### Run with NPX

Run the latest version with npx without installing:

```sh
npx screepers-steamless-client
```

### Install Globally with NPM

Install the latest version globally with npm and run the client:

```sh
npm install -g screepers-steamless-client
screepers-steamless-client
```

### Install or Run with Docker Compose

Use Docker Compose to run the client.

1. Clone this repository

2. Locate the Screeps `package.nw` file from the Steam installation of Screeps. If you are unsure of where to find it, you can right click the game from your Steam library and select the "Browse local files" option.

3. Create a `.env` file in the repo root directory and set `SCREEPS_NW_PATH` to the path of `package.nw`:

    1. If you have Screeps installed on your local machine via Steam, you can reference it directly. For example, on macOS:
        ```bash
        SCREEPS_NW_PATH="~/Library/Application Support/Steam/steamapps/common/Screeps/package.nw"
        ```

    2. If Steam and/or Screeps is not installed locally, you can copy `package.nw` from a remote system and place it in the `vendor` subdirectory:
        ```sh
        SCREEPS_NW_PATH="./vendor/package.nw"
        ```

4. If you want to allow remote connections, add the following line to `.env`:
    ```sh
    SCREEPS_PROXY_HOST="0.0.0.0"
    ```

5. Run `docker compose up`

Alternatively, you can run the container without cloning the repo by using the NPX run approach from a container. This makes it easier to integrate with existing Docker Compose configurations (ex: alongside a Screeps server launcher).

If your deployment includes a Screeps server, make sure to use the `--internal_backend` argument in the command to reference the Screeps server container address.

Example:
```yaml
services:
  client:
    image: "node:20"
    volumes:
      - ${SCREEPS_NW_PATH:?"SCREEPS_NW_PATH not set"}:/screeps.nw
      # Defines a volume for the NPM cache to speed up startup
      # when the container is recreated
      - client-npm-cache:/root/.npm
    command: >
      npx screepers-steamless-client
      --package /screeps.nw
      --host 0.0.0.0
      --internal_backend http://screeps:21025
    ports:
      - "${SCREEPS_PROXY_HOST:-127.0.0.1}:8080:8080/tcp"
    depends_on:
      - screeps
    restart: unless-stopped

  # Additional services defined here...

volumes:
  client-npm-cache:
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
- `--public_hostname` &mdash; The hostname that clients can use to access the client; useful when running in a container. (default: `--host` value)
- `--public_port` &mdash; The port that clients can use to access the client; useful when running in a container. (default: `--port` value)
- `--public_tls` &mdash; Whether the public address should use TLS; useful when running in a container. (default: false)
- `--use_subdomains` &mdash; Whether the server links should use subdomains off of the public address. (default: false)
- `--internal_backend` &mdash; Set the internal backend url when running the Screeps server in a local container. This will convert requests to a localhost backend to use the container name where the Screeps server is running.
- `--server_list` &mdash; Path to a custom server list json config file.
- `--beautify` &mdash; Formats .js files loaded in the client for debugging.
- `--guest` &mdash; Enable guest mode for xxscreeps.
- `--debug` &mdash; Display verbose errors for development.

## Examples

### `--package`

If the Screeps package.nw is not automatically detected, you can provide the path to the Screeps package.nw file.

```sh
npx screepers-steamless-client --package ~/screeps/package.nw
```

### `--internal_backend`

When running a Screeps server in a Docker container, you can configure the server to redirect requests made to localhost to an internal backend url.

```sh
npx screepers-steamless-client --internal_backend http://screeps:21025
```

### `--server_list`

Customize your server list by copying the [server_list.json](settings/server_list.json) file and making your changes.

Run the client with your custom server list:

```sh
npx screepers-steamless-client --server_list ./custom_server_list.json
```

### Behind a reverse proxy

You can run the steamless client behind a reverse proxy (such as in a container) by specifying the public-facing hostname and port. This will ensure that the generated links use the public-facing address instead of the internal bind address.

```sh
npx screepers-steamless-client --public_hostname screeps-client.example.com --public_port 443 --public_tls --use_subdomains
```

## Development Scripts

- `npm start` &mdash; Build and start the client app.
- `npm run build` &mdash; Build the client app to dist.
- `npm run dev` &mdash; Build and watch for changes (hot reload).
- `npm run format` &mdash; Format the src using Prettier.
- `npm run lint` &mdash; Lint the src using ESLint.

## Tips

This client has an optional "guest mode" for [xxscreeps](https://github.com/laverdet/xxscreeps/) that can be enabled with `--guest` and provides a read-only view of the server when not signed in. To sign in with your Steam account, select "Sign Out" first, then click the Steam icon to sign in and play as normal.

![Safari Example](./docs/safari.png)
