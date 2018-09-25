import * as test from "blue-tape";
import { Channel } from "go-channel";
import { DatabaseTestContext } from "table-access";
import { using } from "dispose";
import { DatabaseNotificationClient } from "./database-notification-client";

test("DatabaseNotificationClient", t =>
    using(DatabaseTestContext.create(""), ({ pool }) =>
        using(
            DatabaseNotificationClient.create(pool),
            async dnc => {
                const ch = new Channel();
                dnc.listen((channel, payload) => ch.send({ channel, payload }));

                await dnc.client.query("LISTEN one;");

                await pool.query(`NOTIFY one;`);
                t.deepEqual(
                    await ch.receive(),
                    { channel: "one", payload: null },
                );

                await pool.query(`SELECT pg_notify('one', '{"a":"b"}');`);
                t.deepEqual(
                    await ch.receive(),
                    { channel: "one", payload: { a: "b" } },
                );

                await pool.query(`SELECT pg_notify('one', 'errr');`);
                t.deepEqual(
                    await ch.receive(),
                    { channel: "one", payload: null },
                );

            },
        ),
    ),
);
