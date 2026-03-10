import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'terrain-tiles-profile-view',
    match: (url: string) => url === 'components/profile/profile.html',
    async apply(src: string) {
        // Looks like a bug in the client; `isShards()` returns true whether there's any shards on the server,
        // and that appears to be always true. Switch to `isMultiShard()` since that one checks if there's more
        // than one shard, which is always false on a private server. Otherwise, we will tack on the shardName,
        // which in the case of a private server, isn't even the shard's actual name but `rooms`, leading to a
        // broken URL.
        src = applyPatch(
            src,
            `<img ng:src="{{Profile.mapUrl}}{{isShards() ? shardName+'/' : ''}}{{roomName}}.png">`,
            `<img ng:src="{{Profile.mapUrl}}{{isMultiShard() ? shardName+'/' : ''}}{{roomName}}.png">`,
        );
        return src;
    },
};

export default patch;
