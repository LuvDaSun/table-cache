import { SingletonPool } from "singleton-pool";
import { ChannelNotificationClient } from "./channel-notification-client";
import { DatabaseNotificationPool } from "./database-notification-pool";

export interface ChannelNotificationArgs {
    channel: string;
}

export class ChannelNotificationPool extends SingletonPool<
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
