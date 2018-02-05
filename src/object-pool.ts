import * as assert from "assert";
import { destroyIn, getIn, setIn } from "deepkit";
import { Disposable, DisposableComposition } from "using-disposable";

export type ObjectFactory<
    TObject extends Disposable,
    TArg extends object> =
    (arg: TArg) => TObject | PromiseLike<TObject>;

export type KeyFactory<
    TArg extends object> =
    (args: TArg) => PropertyKey[];

interface ObjectPoolCacheItem<TObject extends Disposable> {
    instance: TObject;
    proxies: Set<TObject>;
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
        let instance: TObject;
        if (cacheItem === null) {
            instance = await this.objectFactory(arg);
            this.registerDisposable(instance);
            cacheItem = {
                instance,
                proxies: new Set<TObject>(),
            };
            setIn(this, cachePath, cacheItem, true);
        }
        else {
            instance = cacheItem.instance;
        }
        const dispose = async () => {
            if (cacheItem === null) throw new Error(`cacheItem is null`);
            cacheItem.proxies.delete(proxy);
            if (cacheItem.proxies.size > 0) return;
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
        cacheItem.proxies.add(proxy);
        return proxy;
    }

}
