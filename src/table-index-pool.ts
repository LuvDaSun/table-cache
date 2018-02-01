import { TableDescriptor } from "table-access";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { IndexDescriptor } from "./index-descriptor";
import { ObjectPool } from "./object-pool";
import { getSymbolForObject } from "./object-symbol";
import { TableDataPool } from "./table-data-pool";
import { TableIndexClient } from "./table-index-client";

export interface TableIndexArg {
    descriptor: IndexDescriptor<any, any, any>;
    shard: object;
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
                ...descriptor.makeShardKey(shard),
            ],
        );
    }
}
