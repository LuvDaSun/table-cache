import * as assert from "assert";
import { Disposable, DisposableComposition } from "using-disposable";
import { destroyIn, getIn, setIn } from "./deep";

export type ObjectFactory<
    TObject extends Disposable,
    TArg extends object> =
    (arg: TArg) => TObject | PromiseLike<TObject>;

export type KeyFactory<
    TArg extends object> =
    (args: TArg) => PropertyKey[];

interface ObjectPoolCacheItem<TObject extends Disposable> {
    proxy: TObject;
    leaseKeys: Set<symbol>;
}

export class ObjectPool<
    TObject extends Disposable,
    TArg extends object> extends DisposableComposition {
    private cache: any;

    constructor(
        private objectFactory: ObjectFactory<TObject, TArg>,
        private keyFactory: KeyFactory<TArg>,
    ) {
        super();
    }

    public async lease(arg: TArg): Promise<TObject> {
        const cacheKey = this.keyFactory(arg);
        const cachePath = ["cache", ...cacheKey];
        let cacheItem: ObjectPoolCacheItem<TObject> | null = getIn(this, cachePath, null);
        const leaseKey = Symbol();
        if (cacheItem === null) {
            const instance = await this.objectFactory(arg);
            this.registerDisposable(instance);
            const dispose = async () => {
                if (cacheItem === null) throw new Error(`cacheItem is null`);
                cacheItem.leaseKeys.delete(leaseKey);
                if (cacheItem.leaseKeys.size > 0) return;
                destroyIn(this, cachePath, true);
                await instance.dispose();
                this.deregisterDisposable(instance);
            };
            const proxyHandler: ProxyHandler<TObject> = {
                get: (target: TObject, propertyKey: PropertyKey, receiver: any): any => {
                    if (propertyKey !== "dispose") return Reflect.get(target, propertyKey, receiver);
                    return dispose;
                },
            };
            const proxy = new Proxy(instance, proxyHandler);

            cacheItem = {
                proxy,
                leaseKeys: new Set<symbol>(),
            };
            setIn(this, cachePath, cacheItem, true);
        }
        cacheItem.leaseKeys.add(leaseKey);
        return cacheItem.proxy;
    }

}
