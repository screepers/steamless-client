interface GameObject {
    _id?: string;
    type?: string;
    x?: number;
    y?: number;
    progress?: number;
    invaderHarvested?: number;
    energy?: number;
    hits?: number;
    actionLog?: {
        upgradeController?: { x: number; y: number };
        harvest?: { x: number; y: number };
        build?: unknown;
        repair?: { x: number; y: number };
        attack?: unknown;
        rangedAttack?: unknown;
        rangedMassAttack?: unknown;
        heal?: unknown;
        rangedHeal?: unknown;
    };
}

type TickData = {
    [objectId: string]: GameObject | null;
};

interface GameEvent {
    type: string;
    timeStamp: number;
    error: boolean;
    edata: {
        flags: string;
        gameTime: number;
        info: { mode: 'world' };
        objects: TickData;
        visual: string;
    };
}

declare global {
    interface Window {
        audioDebug: boolean;
    }
}

// eslint-disable-next-line
declare var angular: any;
// eslint-disable-next-line
declare var _: any;

export async function addScreepsAudio() {
    window.audioDebug = false;
    function log(...args: unknown[]) {
        if (window.audioDebug) {
            console.warn(...args);
        }
    }

    log('Adding Screeps Audio');

    /**
     * Polls every 50 milliseconds for a given condition
     */
    async function waitFor(condition: () => boolean, pollInterval = 50, timeoutAfter?: number) {
        // Track the start time for timeout purposes
        const startTime = Date.now();

        while (true) {
            if (typeof timeoutAfter === 'number' && Date.now() > startTime + timeoutAfter) {
                throw new Error('Condition not met before timeout');
            }

            const result = await condition();
            if (result) {
                return result;
            }

            await new Promise((r) => setTimeout(r, pollInterval));
        }
    }

    // this audio is under CC or whatever - but would be good to have it fully legal
    // we load it bunch of times, to have "fixed" memory usage and allow multiple-overlapping playbacks.
    // there is some cleaner way to do this probably

    const soundEffects: { [soundEffect: string]: { url: string; volume: number; buffer?: AudioBuffer } } = {
        // https://freesound.org/people/zagalo75/sounds/642314/
        move: { url: 'https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg', volume: 0.6 },
        // https://freesound.org/people/The-Sacha-Rush/sounds/657818/
        repair: { url: 'https://cdn.freesound.org/previews/657/657818_685248-lq.ogg', volume: 0.7 },
        // https://freesound.org/people/monosfera/sounds/789972/
        upgrade: { url: 'https://cdn.freesound.org/previews/789/789972_3625175-lq.ogg', volume: 0.3 },
        // https://freesound.org/people/iut_Paris8/sounds/683923/
        damage: { url: 'https://cdn.freesound.org/previews/683/683923_907124-lq.ogg', volume: 1.0 },
        // https://freesound.org/people/FunnyVoices/sounds/709053/
        harvest: { url: 'https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg', volume: 0.5 },
        // https://freesound.org/people/lulyc/sounds/346116/
        heal: { url: 'https://cdn.freesound.org/previews/346/346116_6051514-lq.ogg', volume: 0.6 },
    };

    // XXX: would work better if we kept track of the average tick length
    let tickTime = 2000;
    let lastReceivedUpdate: number | undefined;

    const audioCtx = new AudioContext();

    async function playSoundEffect(sound: keyof typeof soundEffects) {
        const effect = soundEffects[sound];
        if (!effect) return;
        if (!effect.buffer) {
            const res = await fetch(effect.url);
            const buf = await res.arrayBuffer();
            effect.buffer = await audioCtx.decodeAudioData(buf);
        }

        const audio = audioCtx.createBufferSource();
        audio.buffer = effect.buffer;

        const gain = audioCtx.createGain();
        gain.gain.value = effect.volume;

        audio.connect(gain).connect(audioCtx.destination);

        // We're gonna use our tick length estimate to "scatter" the sound effects around at random.
        // This should help in not having overlap like crazy, making them way too loud.
        const soundOffset = Math.round(tickTime * Math.random());

        setTimeout(() => {
            log(`playing ${sound} at ${effect.volume} (offset: ${soundOffset})`);
            audio.start();
        }, soundOffset);
        return;
    }

    function isSoundEnabled() {
        return sessionStorage.getItem('screeps-audio.enabled') === 'true';
    }
    function setSoundEnabled(enabled: boolean) {
        sessionStorage.setItem('screeps-audio.enabled', `${enabled}`);
    }

    async function injectUI() {
        log('waiting to inject UI…');
        await waitFor(() => !!document.getElementsByClassName('room-controls-content')?.[0]);

        const roomControls = document.getElementsByClassName('room-controls-content')[0];
        log('injecting UI');

        const SOUND_EFFECT_BUTTON_ID = 'audio-button';

        let audioButton = document.getElementById(SOUND_EFFECT_BUTTON_ID) as HTMLButtonElement;
        if (!audioButton) {
            const soundButtonHTML = `<button id='${SOUND_EFFECT_BUTTON_ID}' class='md-fab md-button ng-scope md-ink-ripple' type='button' aria-label='Sound Effects' tooltip-append-to-body='true' tooltip-placement='bottom' uib-tooltip='Sound Effects'>
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" width="32px">
                <path fill="${isSoundEnabled() ? '#3f72b5ff' : '#adadadff'}" d="M275.5 96l-96 96h-96v128h96l96 96V96zm51.46 27.668l-4.66 17.387c52.066 13.95 88.2 61.04 88.2 114.945 0 53.904-36.134 100.994-88.2 114.945l4.66 17.387C386.81 372.295 428.5 317.962 428.5 256c0-61.963-41.69-116.295-101.54-132.332zm-12.425 46.365l-4.658 17.387C340.96 195.748 362.5 223.822 362.5 256s-21.54 60.252-52.623 68.58l4.658 17.387C353.402 331.552 380.5 296.237 380.5 256c0-40.238-27.098-75.552-65.965-85.967zm-12.424 46.363l-4.657 17.387C307.55 236.49 314.5 245.547 314.5 256s-6.95 19.51-17.047 22.217l4.658 17.387c17.884-4.792 30.39-21.09 30.39-39.604 0-18.513-12.506-34.812-30.39-39.604z"></path>
                </svg>
                </button>`;
            const soundButton = angular.element(soundButtonHTML);
            soundButton.appendTo(roomControls);
            audioButton = document.getElementById(SOUND_EFFECT_BUTTON_ID) as HTMLButtonElement;
        }

        audioButton.addEventListener('click', () => {
            const enabled = !isSoundEnabled();
            setSoundEnabled(enabled);
            const icon = document.querySelector(`#${SOUND_EFFECT_BUTTON_ID} path`)!;
            if (enabled) {
                icon.setAttribute('fill', '#3f72b5ff');
            } else {
                icon.setAttribute('fill', '#adadadff');
            }
        });
    }

    function playSounds() {
        if (!isSoundEnabled()) return;
        for (const id in currentTickData?.objects) {
            const object = currentTickData.objects[id];
            const lastObject = lastTickData?.objects[id];
            if (!object) continue;

            if (object.type === 'creep' || object.type === 'powerCreep') {
                const lastPos = { x: lastObject?.x, y: lastObject?.y };
                const currPos = { x: object.x, y: object.y };
                if (lastPos.x !== currPos.x || lastPos.y !== currPos.y) {
                    playSoundEffect('move');
                }
            }

            if (object.actionLog?.upgradeController) {
                playSoundEffect('upgrade');
            } else if (object.actionLog?.harvest) {
                playSoundEffect('harvest');
            } else if (object.actionLog?.repair || object.actionLog?.build) {
                playSoundEffect('repair');
            } else if (object.actionLog?.heal) {
                playSoundEffect('heal');
            } else if (
                object.actionLog?.attack ||
                object.actionLog?.rangedAttack ||
                object.actionLog?.rangedMassAttack
            ) {
                playSoundEffect('damage');
            }
        }
    }

    let lastTickData: GameEvent['edata'] | undefined;
    let currentTickData: GameEvent['edata'] | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let currentTickDiff: GameEvent['edata'] | undefined;

    function onRoomTick(evt: GameEvent) {
        const currentUpdate = Date.now();
        if (lastReceivedUpdate !== undefined) {
            tickTime = (tickTime + (currentUpdate - lastReceivedUpdate)) / 2;
        }
        lastReceivedUpdate = currentUpdate;
        log('roomTick:', atob(evt.type), evt.timeStamp, tickTime);

        if (currentTickData) {
            currentTickData = _.merge(currentTickData, evt.edata);
        } else {
            currentTickData = evt.edata;
        }
        currentTickDiff = evt.edata;

        playSounds();

        lastTickData = structuredClone(currentTickData);
    }

    let currentSub: string | null = null;
    function subscribeSocket(path: string | null) {
        const Socket = angular.element(document.body).injector().get('Socket');
        if (currentSub === path) {
            return;
        } else if (path) {
            if (currentSub) {
                log(`already subscribed to ${currentSub}, unsubscribing`);
                lastTickData = undefined;
                currentTickData = undefined;
                currentTickDiff = undefined;
                Socket.off(currentSub);
                currentSub = null;
            }
            currentSub = path;
            log(`subscribing to ${path}`);
            Socket.on(currentSub, onRoomTick);
        } else {
            log(`unsubscribing from ${currentSub}`);
            lastTickData = undefined;
            currentTickData = undefined;
            currentTickDiff = undefined;
            Socket.off(currentSub);
            currentSub = null;
        }
    }

    let currentRoom: string | undefined;
    document.addEventListener('readystatechange', async () => {
        await waitFor(() => !!angular.element(document.body).injector());

        const rootScope = angular.element(document.body).scope();
        rootScope.$watch(
            () => window.location.hash,
            async function () {
                try {
                    const $routeParams = angular.element(document.body).injector().get('$routeParams');
                    if ($routeParams.room) {
                        if (currentRoom === $routeParams.room) return;
                        currentRoom = $routeParams.room;

                        await waitFor(() => !!angular.element('.room.ng-scope').scope());
                        const Room = angular.element('.room.ng-scope').scope().Room;

                        injectUI();

                        subscribeSocket(`room:${Room.shardName}/${Room.roomName}`);
                    } else {
                        subscribeSocket(null);
                    }
                } catch (e) {
                    console.error(e);
                }
            },
        );
    });
}
