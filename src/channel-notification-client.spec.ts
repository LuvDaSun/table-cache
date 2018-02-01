import * as test from "blue-tape";
import { Channel } from "go-channel";
import { DatabaseTestContext } from "table-access";
import { using } from "using-disposable";
import { ChannelNotificationClient } from "./channel-notification-client";
import { DatabaseNotificationPool } from "./database-notification-pool";

test("ChannelNotificationClient", t =>
    using(DatabaseTestContext.create(""), ({ pool }) =>
        using(new DatabaseNotificationPool(pool), databaseNotificationPool =>
            using(
                ChannelNotificationClient.create(databaseNotificationPool, "one"),
                async channelNotificationClient => {
                    const ch = new Channel();
                    channelNotificationClient.listen(payload => ch.send(payload));

                    await pool.query(`NOTIFY one;`);
                    t.deepEqual(
                        await ch.receive(),
                        null,
                    );

                    await pool.query(`SELECT pg_notify('one', '{"a":"b"}');`);
                    t.deepEqual(
                        await ch.receive(),
                        { a: "b" },
                    );

                },
            ),
        ),
    ),
);
