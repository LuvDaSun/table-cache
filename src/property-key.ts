export function toPropertyKey(value: any): PropertyKey {
    const type = typeof value;
    switch (type) {
        case "string":
        case "number":
        case "symbol":
            return value;

        default: throw new Error(`${type} is not a string or a number`);
    }
}
