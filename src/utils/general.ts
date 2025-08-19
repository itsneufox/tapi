export function hasAtLeastOne<T extends object>(repo: T, keys: (keyof T)[]): boolean {
    return keys.some(
        k => repo[k] !== undefined && repo[k] !== null && repo[k] !== ""
    );
};

export function hasTwoOrMore<T extends object>(obj: T, keys: (keyof T)[]): boolean {
    return keys
        .map(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== "")
        .filter(Boolean).length >= 2;
}