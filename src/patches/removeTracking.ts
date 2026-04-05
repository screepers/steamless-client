import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'remove-tracking',
    description: '(Core) Remove tracking pixels',
    match: (url: string) => url === 'index.html',
    async apply(src: string) {
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*xsolla[^>]*<\/script>/g,
            '<script>xnt = new Proxy(() => xnt, { get: () => xnt })</script>',
        );
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*facebook[^>]*<\/script>/g,
            '<script>fbq = new Proxy(() => fbq, { get: () => fbq })</script>',
        );
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*google[^>]*<\/script>/g,
            '<script>ga = new Proxy(() => ga, { get: () => ga })</script>',
        );
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*mxpnl[^>]*<\/script>/g,
            '<script>mixpanel = new Proxy(() => mixpanel, { get: () => mixpanel })</script>',
        );
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*twttr[^>]*<\/script>/g,
            '<script>twttr = new Proxy(() => twttr, { get: () => twttr })</script>',
        );
        src = applyPatch(
            src,
            /<script[^>]*>[^>]*onRecaptchaLoad[^>]*<\/script>/g,
            '<script>function onRecaptchaLoad(){}</script>',
        );
        return src;
    },
};

export default patch;
