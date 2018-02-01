import * as pg from "pg";
import { ChannelNotificationClient } from "./channel-notification-client";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { ObjectPool } from "./object-pool";

export interface ChannelNotificationArgs {
    channel: string;
}

export class ChannelNotificationPool extends ObjectPool<
    ChannelNotificationClient,
    ChannelNotificationArgs> {

    constructor(pool: DatabaseNotificationPool) {
        super(
            ({ channel }) =>
                ChannelNotificationClient.create(pool, channel),
            ({ channel }) => [channel],
        );
    }
}
