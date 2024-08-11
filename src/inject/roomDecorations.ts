type AnyObject = Record<PropertyKey, unknown>;
type AnyProps = string | AnyObject | AnyProps[];

/**
 * This function is injected into the client to modify room decorations.
 */
export function roomDecorations(backend: string, awsHost: string) {
    if (!backend.includes('screeps.com')) {
        return;
    }

    // Recursive function to remove AWS host from room decoration URLs
    const removeAWSHost = (obj: AnyProps): AnyProps => {
        if (typeof obj === 'string') {
            return obj.replace(awsHost, '');
        } else if (Array.isArray(obj)) {
            return obj.map(removeAWSHost) as AnyProps;
        } else if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = removeAWSHost(obj[key] as AnyProps);
                }
            }
        }
        return obj;
    };

    const onRoomUpdate = () => {
        const roomInterval = setInterval(() => {
            const roomElement = document.querySelector('.room.ng-scope');
            if (window.angular && roomElement) {
                clearInterval(roomInterval);
                const connection = window.angular.element(document.body).injector().get('Connection');
                const roomScope = window.angular.element(roomElement).scope();
                connection.onRoomUpdate(roomScope, () => {
                    // Modify room decorations to avoid CORS errors
                    roomScope.Room.decorations = removeAWSHost(roomScope.Room.decorations);
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
