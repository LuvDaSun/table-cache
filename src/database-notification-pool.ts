import * as pg from "pg";
import { DatabaseNotificationClient } from "./database-notification-client";
import { ObjectPool } from "./object-pool";

// tslint:disable-next-line:no-empty-interface
export interface DatabaseNotificationArgs {
}

export class DatabaseNotificationPool extends ObjectPool<
    DatabaseNotificationClient,
    DatabaseNotificationArgs> {

    constructor(pool: pg.Pool) {
        super(
            () => DatabaseNotificationClient.create(pool),
            () => [],
        );
    }
}
