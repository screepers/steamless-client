import { CodeStore } from './types';

declare global {
    interface Window {
        angular: any;
    }
}

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
            const code = JSON.parse(localStorage['users.code.activeWorld']);
            localStorage['users.code.activeWorld'] = JSON.stringify(
                code.sort((a: CodeStore, b: CodeStore) => b.timestamp - a.timestamp).slice(0, 2),
            );
        } catch (err) {
            delete localStorage['users.code.activeWorld'];
        }
    }

    // Send the user to map after login from /register
    addEventListener('message', () => {
        setTimeout(() => {
            if (localStorage.auth && localStorage.auth !== '"guest"' && document.location.hash === '#!/register') {
                document.location.hash = '#!/';
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

    const onRouteChange = () => {
        const gameInterval = setInterval(() => {
            const gameElement = document.querySelector('.game.ng-scope');
            if (window.angular && gameElement) {
                clearInterval(gameInterval);
                const $rootScope = window.angular.element(gameElement).injector().get('$rootScope');
                $rootScope.$on('$routeChangeSuccess', onRoomUpdate);
            }
        }, 100);
    };
    onRouteChange();
}
