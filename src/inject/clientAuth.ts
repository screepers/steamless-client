/**
 * This function is injected into the client to manage settings in local storage.
 */
export function clientAuth(backend: string) {
    // Clear the local storage if the backend domain has changed
    if (localStorage.backendDomain && localStorage.backendDomain !== backend) {
        const keysToPreserve = ['game.room.displayOptions', 'game.world-map.displayOptions2', 'game.editor.hidden'];
        for (const key of Object.keys(localStorage)) {
            if (!keysToPreserve.includes(key)) {
                localStorage.removeItem(key);
            }
        }
    }

    // Set the backend domain
    localStorage.backendDomain = backend;

    // Set the auth token to guest if it's not set or if it's been more than an hour since the last token was set
    if (
        (localStorage.auth === 'null' && localStorage.prevAuth === 'null') ||
        60 * 60 * 1000 < Date.now() - localStorage.lastToken ||
        (localStorage.prevAuth !== '"guest"' && (localStorage.auth === 'null' || !localStorage.auth))
    ) {
        localStorage.auth = '"guest"';
    }

    // Set the client to skip tutorials and tip of the day
    localStorage.tutorialVisited = 'true';
    localStorage.placeSpawnTutorialAsked = '1';
    localStorage.tipTipOfTheDay = '-1';

    // Set the last token to the current time
    localStorage.prevAuth = localStorage.auth;
    localStorage.lastToken = Date.now();

    // Update the last token if the auth token changes
    let auth = localStorage.auth;
    setInterval(() => {
        if (auth !== localStorage.auth) {
            auth = localStorage.auth;
            localStorage.lastToken = Date.now();
        }
    }, 1000);

    // The client will just fill this up with data until the application breaks.
    if (localStorage['users.code.activeWorld']?.length > 1024 * 1024) {
        try {
            type Store = { timestamp: number };
            const code = JSON.parse(localStorage['users.code.activeWorld']);
            localStorage['users.code.activeWorld'] = JSON.stringify(
                code.sort((a: Store, b: Store) => b.timestamp - a.timestamp).slice(0, 2),
            );
        } catch (err) {
            delete localStorage['users.code.activeWorld'];
        }
    }

    addEventListener('message', () => {
        setTimeout(() => {
            if (localStorage.auth) {
                const isGuestOrNull = localStorage.auth === '"guest"' || localStorage.auth === 'null';
                const basePath = `/(${backend})/`;
                if (isGuestOrNull && document.location.pathname === `${basePath}season/`) {
                    // Season players must log in to the main server without the /season prefix in the URL
                    // This is because the official client does not support logging in through the season server
                    document.location.pathname = basePath;
                } else if (!isGuestOrNull && document.location.hash === '#!/register') {
                    // Redirect the user to map after registration
                    document.location.hash = '#!/';
                }
            }
        });
    });
}
