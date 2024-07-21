export function getPrefixes(type: string) {
    return type === 'official' ? ['season', 'ptr'] : [];
}
