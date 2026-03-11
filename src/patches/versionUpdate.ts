import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'update-native-client',
    description: 'Clarify the version updated pop up',
    match: (url: string) => url === 'components/common/dlg-version-updated/dlg-version-updated.html',
    async apply(src: string) {
        src = applyPatch(
            src,
            /<span>New update is available<\/span>/,
            '<span>Update available; launch the client through Steam.</span>',
        );
        return src;
    },
};

export default patch;
