import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'token-auth',
    description: 'Enable token auth usage',
    match: (url) => url === 'components/profile/account/account.html',
    async apply(src) {
        src = applyPatch(
            src,
            /<a class='account-option' ng-if='isOffServer\(\)' ng:href="#!{{'top\.account-auth-tokens' \| routeSegmentUrlStateless}}">/g,
            "<a class='account-option' ng-if='isOffServer() || Top.hasFeature(\"auth-tokens\")' ng:href=\"#!{{'top.account-auth-tokens' | routeSegmentUrlStateless}}\">",
        );

        return src;
    },
};

export default patch;
