import { Patch } from './helpers';
import jsBeautify from 'js-beautify';
import { Server } from 'utils/server';
import { Args } from 'clientApp';

const patch: Patch = {
    id: 'beautify',
    description: 'Beautify all Javascript files as they are served',
    match: (url: string) => url.endsWith('.js'),
    async apply(src: string, _server: Server, argv: Args) {
        return argv.beautify ? jsBeautify(src) : src;
    },
};

export default patch;
