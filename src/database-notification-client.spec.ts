import * as test from "blue-tape";
import { Channel } from "go-channel";
import { DatabaseTestContext } from "table-access";
import { using } from "using-disposable";
import { DatabaseNotificationClient } from "./database-notification-client";

test("DatabaseNotificationClient", t =>
    using(DatabaseTestContext.create(""), async ({ pool }) =>
        using(DatabaseNotificationClient.create(pool), async client => {
            const ch = new Channel();
            client.listen((channel, payload) => ch.send({ channel, payload }));

            await client.client.query("LISTEN one;");

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

        }),
    ),
);
