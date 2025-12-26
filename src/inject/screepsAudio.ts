
export function addScreepsAudio() {
    console.log('Adding Screeps Audio')
    let pTickData:any = undefined

    // this audio is under CC or whatever - but would be good to have it fully legal
    // we load it bunch of times, to have "fixed" memory usage and allow multiple-overlapping playbacks.
    // there is some cleaner way to do this probably

    // https://freesound.org/people/The-Sacha-Rush/sounds/657818/
    const repairAudio = [
        new Audio('https://cdn.freesound.org/previews/657/657818_685248-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/657/657818_685248-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/657/657818_685248-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/657/657818_685248-lq.ogg'),
    ]

    // https://freesound.org/people/zagalo75/sounds/642314/
    const moveAudio = [
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/642/642314_11167166-lq.ogg'),
    ]
    
    // https://freesound.org/people/monosfera/sounds/789972/
    const upgradeAudio = [new Audio('https://cdn.freesound.org/previews/789/789972_3625175-lq.ogg')]

    // https://freesound.org/people/iut_Paris8/sounds/683923/
    const damagedAudio = [
        new Audio('https://cdn.freesound.org/previews/683/683923_907124-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/683/683923_907124-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/683/683923_907124-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/683/683923_907124-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/683/683923_907124-lq.ogg')
    ]

    // https://freesound.org/people/ani_music/sounds/219619/
    const healAudio = [
        new Audio('https://cdn.freesound.org/previews/219/219619_3008343-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/219/219619_3008343-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/219/219619_3008343-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/219/219619_3008343-lq.ogg'),
    ]

    // https://freesound.org/people/FunnyVoices/sounds/709053/
    const harvestAudio = [
        new Audio('https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg'),
        new Audio('https://cdn.freesound.org/previews/709/709053_12187251-lq.ogg'),
    ]

    // we need to "hack" websocket constructor,
    // to get access to websocket set-up by "original" screeps code (that is used to render game i.e)
    // this needs to be loaded at-the-top, before "standard" code
    var ws = window.WebSocket;
    // @ts-ignore
    window.WebSocket = function (a, b) {
    var that = b ? new ws(a, b) : new ws(a);
    that.addEventListener("open", console.info.bind(console, "socket open"));
    that.addEventListener("close", console.info.bind(console, "socket close"));
    that.addEventListener("message", (m) => {
        // we skip all non-game-data websocket messages
        if(!m.data) {
            return
        } 
        if(m.data.includes('/console') || m.data.includes('/resources')) {
            return
        }
        // this part here is in preparation for using between-ticks game data (at some point)
        // also makes it cheaper for searching for specific data later, since there is lot-less data to go through in case of visuals

        // make parsing easier
        let tickDataString = m.data.replace(/\\"/g, '"');
        // remove visuals
        tickDataString = tickDataString.split('"visual"')[0]

        // split roomname data from front
        tickDataString = tickDataString.split('{"objects":')[1]

        // add back part of json
        tickDataString = '{"objects":'+ tickDataString
        // console.log(tickDataString)
        // remove comma
        tickDataString = tickDataString.slice(0, -1)
        // console.log(tickDataString)
        // add missing parenthesis so this is valid json
        tickDataString += '}'
        console.log(tickDataString)


        /**
         *   naive way of generating sound effect,based on only object delta obtained from websocket
        */
        // repair sounds - repair action log
        // const repairCount = (tickDataString.match(/repair/g) || []).length;
        // if(repairCount) {
        //     console.log(`repairCount: ${repairCount}`)
        //     for(let i = 0; i < Math.min(repairAudio.length, repairCount); i++) {
        //         setTimeout(() => {
        //             repairAudio[i].load()
        //             repairAudio[i].play()
        //         }, Math.random()*300);
        //     }
        // }
        // harvest sounds - invader harvested changesinceaction log is not sure
        // const harvestCount = (tickDataString.match(/invaderHarvested/g) || []).length;
        // if(harvestCount) {
        //     console.log(`harvestCount: ${harvestCount}`)
        //     for(let i = 0; i < Math.min(harvestAudio.length, harvestCount); i++) {
        //         setTimeout(() => {
        //             harvestAudio[i].load()
        //             harvestAudio[i].play()
        //         }, Math.random()*300);
        //     }
        // }
        // // upgrade sounds - change of controller progress
        // const upgrade = (tickDataString.match(/progress/g) || []).length;
        // if(upgrade) {
        //     console.log(`upgrade: ${upgrade}`)
        //     upgradeAudio[0].load()
        //     upgradeAudio[0].play()
        // }
        // move sounds - change of room-objects coords
        const moveCount = Math.max((tickDataString.match(/"x"/g) || []).length, (tickDataString.match(/"y"/g) || []).length);
        
        if(moveCount) {
            console.log(`moveCount: ${moveCount}`)
            for(let i = 0; i < Math.min(moveAudio.length, moveCount); i++) {
                setTimeout(() => {
                    moveAudio[i].load()
                    moveAudio[i].play()
                }, Math.random()*300);
            }
        }

        const healedCount = (tickDataString.match(/"healed"/g) || []).length
        if(healedCount) {
            console.log(`healedCount: ${healedCount}`)
            for(let i = 0; i < Math.min(healAudio.length, healedCount); i++) {
                setTimeout(() => {
                    healAudio[i].load()
                    healAudio[i].play()
                }, Math.random()*300);
            }
        }

        /**
         * Better way of generating sounds by comparing tick data across 2 ticks
         */

        const currentTickDataObj = JSON.parse(tickDataString).objects
        if(!pTickData) {
            pTickData = JSON.parse(tickDataString).objects
            return
        }
        
        let harvestIndex = 0;   // so every source has own harvest-sound
        let repairIndex = 0;    // so "almost" every repair has own sound

        const changedObjects = Object.keys(currentTickDataObj)
        for(const id of changedObjects) {

            // controller being upgraded sound (max 1)
            if(currentTickDataObj[id].progress && pTickData[id] && pTickData[id]?.progress) {
                if(currentTickDataObj[id].progress > pTickData[id].progress) {
                    console.log(`controller upgraded ${pTickData[id].progress} -> ${currentTickDataObj[id].progress}`)
                    upgradeAudio[0].load()
                    upgradeAudio[0].play()
                }
            continue
            }

            // source energy harvested sound (max 3 in SK rooms)
            if(currentTickDataObj[id].invaderHarvested && currentTickDataObj[id].energy && pTickData[id]?.energy) {
                if(currentTickDataObj[id].energy < pTickData[id].energy) {
                    console.log(`Source ${id} harvested`)
                    setTimeout(() => {
                        harvestAudio[Math.min(harvestIndex, 3)].load()
                        harvestAudio[Math.min(harvestIndex, 3)].play()
                    }, Math.random()*300);
                    harvestIndex++;
                }
                continue
            }

            // repair / dmg sounds
            if(currentTickDataObj[id].hits && pTickData[id]?.hits) {
                if(currentTickDataObj[id].hits > pTickData[id].hits) {
                    console.log(`Object ${id} repaired/healed`)
                    setTimeout(() => {
                        repairAudio[Math.min(repairIndex, repairAudio.length)].load()
                        repairAudio[Math.min(repairIndex, repairAudio.length)].play()
                    }, Math.random()*300);
                    repairIndex++;
                }
                if(currentTickDataObj[id].hits < pTickData[id].hits) {
                    console.log(`Object ${id} damaged`)
                    setTimeout(() => {
                        damagedAudio[Math.min(repairIndex, damagedAudio.length)].load()
                        damagedAudio[Math.min(repairIndex, damagedAudio.length)].play()
                    }, Math.random()*300);
                    repairIndex++;
                }
            }
        }
        pTickData = currentTickDataObj


    });
    return that;
    };

    window.WebSocket.prototype=ws.prototype; 

}
