import * as pg from "pg";
import { SingletonPool } from "singleton-pool";
import { DatabaseNotificationClient } from "./database-notification-client";

// tslint:disable-next-line:no-empty-interface
export interface DatabaseNotificationArgs {
}

export class DatabaseNotificationPool extends SingletonPool<
    DatabaseNotificationClient,
    DatabaseNotificationArgs> {

    constructor(pool: pg.Pool) {
        super(
            () => DatabaseNotificationClient.create(pool),
            () => [],
        );
    }
}
