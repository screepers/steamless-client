import { applyPatch, Patch } from './helpers.js';

const patch: Patch = {
    id: 'portal-info',
    description: 'Show more information about portals in the object inspector (stability, stable date).',
    match: (url: string) => url === 'components/game/room/properties/portal.html',
    async apply(src: string) {
        const unstableDateInfo =
            "<div ng-if='Room.selectedObject.unstableDate'>\n" +
            '<label>Stable until:</label>\n' +
            "<span id='screepers-stable-date' data-unstabledate='{{Room.selectedObject.unstableDate}}'/>\n" +
            '<script>\n' +
            'setTimeout(() => {\n' +
            "\tconst dateField = document.getElementById('screepers-stable-date');\n" +
            '\tif (!dateField) return;\n' +
            "\tconst date = dateField.getAttribute('data-unstabledate');\n" +
            '\tconst unstableStamp = parseInt(date, 10)\n' +
            '\tdateField.innerText = new Date(unstableStamp).toLocaleString()\n' +
            '}, 20);\n' +
            '</script>\n' +
            '</div>\n';
        src = applyPatch(
            src,
            "<div ng-if='Room.selectedObject.destination &amp;&amp; Room.selectedObject.destination.shard'>",
            unstableDateInfo + "<div ng:if='!Room.selectedObject.unstableDate'>",
        );
        src = applyPatch(src, 'portal is stable yet', 'portal is stable');
        return src;
    },
};
export default patch;
