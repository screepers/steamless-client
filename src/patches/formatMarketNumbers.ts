import { applyPatch, Patch } from './helpers';

const patch: Patch = {
    id: 'format-market-numbers',
    match: (url: string) => url === 'app2/main.js',
    async apply(src: string) {
        // Replace some of the number formatting in the market pages

        // # All orders
        // Price + std on resource tiles: ./src2/app/market.module/resource-price.component/resource-price.component.pug
        src = applyPatch(src, /{{ data\.avgPrice }}/g, '{{ data.avgPrice.toLocaleString() }}');
        src = applyPatch(src, /{{ data\.stddevPrice }}/g, '{{ data.stddevPrice.toLocaleString() }}');

        // # Resource info dialog
        // Buying/selling tables, ./src2/app/market.module/table-orders/table-orders.component.pug
        src = applyPatch(src, /{{ order\.price\.toFixed\(3\) }}/g, '{{ order.price.toLocaleString() }}');
        src = applyPatch(src, /{{ order\.amount \| number }}/g, '{{ order.amount.toLocaleString() }}');
        src = applyPatch(
            src,
            /{{ order\.remainingAmount \| number }}/g,
            '{{ order.remainingAmount.toLocaleString() }}',
        );

        // Price history, ./src2/app/market.module/table-price-history/table-price-history.component.pug
        src = applyPatch(
            src,
            /{{ order.transactions\| number:'1\.0-3' }}/g,
            '{{ order.transactions.toLocaleString() }}',
        );
        src = applyPatch(src, /{{ order\.volume \| number:'1\.0-3'}}/g, '{{ order.volume.toLocaleString() }}');
        src = applyPatch(src, /{{ order\.avgPrice }}/g, '{{ order.avgPrice.toLocaleString() }}');
        src = applyPatch(src, /{{ order\.stddevPrice\.toFixed\(3\) }}/g, '{{ order.stddevPrice.toLocaleString() }}');

        // # My orders, ./src2/app/market.module/table-my-orders/table-my-orders.component.pug
        // There's also an `order.price` here, but it's been handled above
        src = applyPatch(src, /{{ order\.totalAmount \| number }}/g, '{{ order.totalAmount.toLocaleString() }}');

        // # History, ./src2/app/market.module/table-history/table-history.component.pug
        src = applyPatch(src, /{{ transaction\.tick }}/g, '{{ transaction.tick.toLocaleString() }}');
        src = applyPatch(src, /{{ transaction\.change\.toFixed\(3\) }}/g, '{{ transaction.change.toLocaleString() }}');
        src = applyPatch(
            src,
            /{{ transaction\.balance\.toFixed\(3\) }}/g,
            '{{ transaction.balance.toLocaleString() }}',
        );
        return src;
    },
};

export default patch;
