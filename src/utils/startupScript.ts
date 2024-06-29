import { CodeStore } from './types';

declare global {
    interface Window {
        angular: any;
    }
}

// Convert the startup script method into a string
export function getStartupScript(backend: string) {
    const scriptContent = startupScript.toString();
    const firstBraceIndex = scriptContent.indexOf('{');
    const extractedContent = scriptContent.substring(firstBraceIndex + 1, scriptContent.length - 1);
    return ['<script>', `const backend = '${JSON.stringify(backend)}';`, extractedContent, '</script>'].join('\n');
}

// This script is injected into the client index.html header
function startupScript(backend: string) {
    if (localStorage.backendDomain && localStorage.backendDomain !== backend) {
        const keysToPreserve = ['game.room.displayOptions', 'game.world-map.displayOptions2', 'game.editor.hidden'];
        for (const key of Object.keys(localStorage)) {
            if (!keysToPreserve.includes(key)) {
                localStorage.removeItem(key);
            }
        }
    }
    localStorage.backendDomain = backend;
    if (
        (localStorage.auth === 'null' && localStorage.prevAuth === 'null') ||
        60 * 60 * 1000 < Date.now() - localStorage.lastToken ||
        (localStorage.prevAuth !== '"guest"' && (localStorage.auth === 'null' || !localStorage.auth))
    ) {
        localStorage.auth = '"guest"';
    }
    localStorage.tutorialVisited = 'true';
    localStorage.placeSpawnTutorialAsked = '1';
    localStorage.tipTipOfTheDay = '-1';
    localStorage.prevAuth = localStorage.auth;
    localStorage.lastToken = Date.now();
    (function () {
        let auth = localStorage.auth;
        setInterval(() => {
            if (auth !== localStorage.auth) {
                auth = localStorage.auth;
                localStorage.lastToken = Date.now();
            }
        }, 1000);
    })();
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

    // Client abuse
    (() => {
        // Disable decorations
        const disableDecorations = () => {
            const intervalId = setInterval(() => {
                const roomElement = document.querySelector('.room.ng-scope');

                if (window.angular && roomElement) {
                    clearInterval(intervalId);

                    const connection = window.angular.element(document.body).injector().get('Connection');
                    const roomScope = window.angular.element(roomElement).scope();
                    connection.onRoomUpdate(roomScope, () => {
                        roomScope.Room.decorations = [];
                    });
                }
            }, 100);
        };
        disableDecorations();

        // Re-initialize when the route changes
        const eventIntervalId = setInterval(() => {
            const gameElement = document.querySelector('.game.ng-scope');

            if (window.angular && gameElement) {
                clearInterval(eventIntervalId);

                const $rootScope = window.angular.element(gameElement).injector().get('$rootScope');
                $rootScope.$on('$routeChangeSuccess', disableDecorations);
            }
        }, 100);
    })();
}
