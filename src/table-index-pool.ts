import { SingletonPool } from "singleton-pool";
import { IndexDescriptor, IndexDescriptorShardKey } from "./index-descriptor";
import { getSymbolForObject } from "./object-symbol";
import { toPropertyKey } from "./property-key";
import { TableDataPool } from "./table-data-pool";
import { TableIndexClient } from "./table-index-client";

export interface TableIndexArg {
    descriptor: IndexDescriptor<any, any, any>;
    shard: any;
}

export class TableIndexPool extends SingletonPool<
    TableIndexClient<any, any, any>,
    TableIndexArg> {

    constructor(
        tableDataPool: TableDataPool,
    ) {
        super(
            ({ descriptor, shard }) => TableIndexClient.create(
                tableDataPool,
                descriptor,
                shard,
            ),
            ({ descriptor, shard }) => [
                getSymbolForObject(descriptor),
                ...resolveIndexDescriptorShardKey(shard, descriptor.shardKey),
            ],
        );
    }
}

function resolveIndexDescriptorShardKey<TShard>(
    shard: TShard,
    shardKey?: IndexDescriptorShardKey<TShard>,
): PropertyKey[] {
    if (shardKey === undefined) {
        return Object.keys(shard).
            sort().
            map(k => k as keyof TShard).
            map(key => toPropertyKey(shard[key]));
    }
    if (typeof shardKey === "function") {
        return shardKey(shard);
    }
    if (Array.isArray(shardKey)) {
        return shardKey.map(key => String(shard[key]));
    }
    throw new Error(`invalid shardKey ${shardKey}`);
}
