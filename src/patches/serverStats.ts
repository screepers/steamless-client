import { applyPatch, MultiPatch } from './helpers.js';

const patch: MultiPatch = {
    id: 'server-stats',
    description: 'Enable stats viewing if the server supports it (needs screepsmod-stats installed)',
    disabled: true,
    patches: [
        {
            match: (url: string) => url === 'build.min.js',
            async apply(src: string) {
                // Add an hasFeature function to help with checking specific features from the HTML pages
                src = applyPatch(
                    src,
                    't.Math=Math,t.isOffServer',
                    't.Math=Math,t.hasFeature=function(feature){var f=m.get("Api").options.serverData.features;if(!f)return false;return f.some((feat)=>feat.name===feature);},t.isOffServer',
                );
                return src;
            },
        },
        {
            match: (url: string) => url === 'components/profile/profile.html',
            async apply(src: string) {
                src = applyPatch(
                    src,
                    "<div class='survival' ng-if='isOffServer()'>",
                    "<div class='survival' ng-if='isOffServer() || hasFeature(\"screepsmod-stats\")'>",
                );
                src = applyPatch(
                    src,
                    "<div class='stats-controls' ng-if='isOffServer()'>",
                    "<div class='stats-controls' ng-if='isOffServer() || hasFeature(\"screepsmod-stats\")'>",
                );
                src = applyPatch(
                    src,
                    "<app-profile-stats ng-if='isOffServer()' stats='Profile.data.stats'></app-profile-stats>",
                    "<app-profile-stats ng-if='isOffServer() || hasFeature(\"screepsmod-stats\")' stats='Profile.data.stats'></app-profile-stats>",
                );
                return src;
            },
        },
    ],
};

export default patch;
