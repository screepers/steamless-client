/**
 * This function is injected into the client to remove room decorations (and avoid CORS errors).
 */
export function removeDecorations(backend: string) {
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
