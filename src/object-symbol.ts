const objectMap = new WeakMap<object, symbol>();

export function getSymbolForObject(obj: object) {
    let sym = objectMap.get(obj);
    if (sym === undefined) {
        sym = Symbol();
        objectMap.set(obj, sym);
    }
    return sym;
}
