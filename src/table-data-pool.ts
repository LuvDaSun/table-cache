import { TableDescriptor } from "table-access";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { ObjectPool } from "./object-pool";
import { getSymbolForObject } from "./object-symbol";
import { TableDataClient } from "./table-data-client";

export interface TableDataArg {
    descriptor: TableDescriptor<any>;
}

export class TableDataPool extends ObjectPool<
    TableDataClient<any>,
    TableDataArg> {

    constructor(
        databaseNotificationPool: DatabaseNotificationPool,
        channelNotificationPool: ChannelNotificationPool,
        channel: string,
    ) {
        super(
            ({ descriptor }) => TableDataClient.create<any>(
                databaseNotificationPool,
                channelNotificationPool,
                channel,
                descriptor,
            ),
            ({ descriptor }) => [getSymbolForObject(descriptor)],
        );
    }
}
