export function generateScriptTag(func: Function, args: { [key: string]: any }) {
    const scriptContent = func.toString();
    const firstBraceIndex = scriptContent.indexOf('{');
    const extractedContent = scriptContent.substring(firstBraceIndex + 1, scriptContent.length - 1);

    const argStrings = Object.entries(args).map(([key, value]) => {
        return `const ${key} = ${JSON.stringify(value)};`;
    });

    return ['<script>', '(function() {', ...argStrings, extractedContent, '})();', '</script>'].join('\n');
}

export function clientStartup(backend: string) {
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

export function removeRoomDecorations(backend: string) {
    if (!backend.includes('screeps.com')) {
        return;
    }

    const onRoomUpdate = () => {
        const roomInterval = setInterval(() => {
            const roomElement = document.querySelector('.room.ng-scope');
            if (window.angular && roomElement) {
                clearInterval(roomInterval);
                const connection = window.angular.element(document.body).injector().get('Connection');
                const roomScope = window.angular.element(roomElement).scope();
                connection.onRoomUpdate(roomScope, () => {
                    // Remove room decorations
                    roomScope.Room.decorations = [];
                });
            }
        }, 100);
    };
    onRoomUpdate();

    const gameInterval = setInterval(() => {
        const gameElement = document.querySelector('.game.ng-scope');
        if (window.angular && gameElement) {
            clearInterval(gameInterval);
            const $rootScope = window.angular.element(gameElement).injector().get('$rootScope');
            $rootScope.$on('$routeChangeSuccess', onRoomUpdate);
        }
    }, 100);
}

export function modifyClientAppMenu(backend: string, seasonLink: string, ptrLink?: string, serverListLink?: string) {
    const appMenuSelector = 'app-menu.--ui';

    function updateAppMenu() {
        const appMenu = document.querySelector(appMenuSelector);

        if (backend.includes('screeps.com')) {
            const switchLinks = ['https://screeps.com/season/#!/seasons/chronicle', 'https://screeps.com/a/'];

            appMenu?.querySelectorAll('a[href]').forEach((link) => {
                const href = link.getAttribute('href');
                if (href && switchLinks.includes(href)) {
                    link.setAttribute('href', seasonLink);
                    link.setAttribute('target', '_self');
                }
            });
        }

        const removeLinks = ['screeps.com/forum', 'twitter.com', 'mailto:'];

        appMenu?.querySelectorAll('a[href]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href?.includes('github.com/screeps/screeps')) {
                link.setAttribute('href', 'https://github.com/screepers/steamless-client');
                return;
            }

            if (href?.includes('screeps.com/ptr')) {
                if (ptrLink) {
                    link.setAttribute('href', ptrLink);
                    const label = link.querySelector('div div');
                    if (label) label.textContent = 'PTR';
                } else {
                    link.remove();
                }
                return;
            }

            if (href?.includes('facebook.com')) {
                if (serverListLink) {
                    link.setAttribute('href', serverListLink);
                    link.setAttribute('target', '_self');
                    link.querySelector('svg use')?.setAttribute('xlink:href', '#symbol-menu-change-server');
                    const label = link.querySelector('div div');
                    if (label) label.textContent = 'Change Server';
                } else {
                    link.remove();
                }
                return;
            }

            if (href && removeLinks.some((text) => href.includes(text))) {
                link.remove();
                return;
            }
        });
    }

    const observer = new MutationObserver((mutationsList) => {
        let shouldUpdate = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target as HTMLElement;
                if (target.classList.contains('--visible')) {
                    shouldUpdate = true;
                    break;
                }
            } else if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        const links = element.querySelectorAll('a[href*="facebook.com"]');
                        if (links.length) {
                            shouldUpdate = true;
                            return;
                        }
                    }
                });
                if (shouldUpdate) break;
            }
        }
        if (shouldUpdate) {
            updateAppMenu();
        }
    });

    const targetInterval = setInterval(() => {
        const targetNode = document.querySelector(appMenuSelector);
        if (targetNode) {
            observer.observe(targetNode, {
                attributes: true,
                childList: true,
                subtree: true,
            });
            clearInterval(targetInterval);
        }
    }, 100);
}
