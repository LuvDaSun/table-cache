import { TableDescriptor } from "table-access";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { IndexDescriptor, IndexDescriptorShardKey } from "./index-descriptor";
import { ObjectPool } from "./object-pool";
import { getSymbolForObject } from "./object-symbol";
import { toPropertyKey } from "./property-key";
import { TableDataPool } from "./table-data-pool";
import { TableIndexClient } from "./table-index-client";

export interface TableIndexArg {
    descriptor: IndexDescriptor<any, any, any>;
    shard: any;
}

export class TableIndexPool extends ObjectPool<
    TableIndexClient<any, any, any>,
    TableIndexArg> {

    constructor(
        tableCachePool: TableDataPool,
    ) {
        super(
            ({ descriptor, shard }) => TableIndexClient.create(
                tableCachePool,
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
