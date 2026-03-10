import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'portal-info',
    match: (url: string) => url === 'components/game/room/properties/portal.html',
    async apply(src: string) {
        // Fix the portal stability info showing only if it's an intershard portal
        // Additionally, expose the stable date in the inspector
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
