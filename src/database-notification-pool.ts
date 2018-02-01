import * as pg from "pg";
import { DatabaseNotificationClient } from "./database-notification-client";
import { ObjectPool } from "./object-pool";

// tslint:disable-next-line:no-empty-interface
export interface ChannelNotificationArgs {
}

export class DatabaseNotificationPool extends ObjectPool<
    DatabaseNotificationClient,
    ChannelNotificationArgs> {

    constructor(pool: pg.Pool) {
        super(
            () => DatabaseNotificationClient.create(pool),
            () => [],
        );
    }
}
