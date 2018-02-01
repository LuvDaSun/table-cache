import * as test from "blue-tape";
import { Channel } from "go-channel";
import { DatabaseTestContext, TableDescriptor } from "table-access";
import { using } from "using-disposable";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { IndexDescriptor } from "./main";
import { TableDataPool } from "./table-data-pool";
import { TableIndexClient } from "./table-index-client";

const sql = `
CREATE FUNCTION public.notify_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
BEGIN
    PERFORM pg_notify(TG_ARGV[0], json_build_object(
        'op', TG_OP,
        'schema', TG_TABLE_SCHEMA,
        'table', TG_TABLE_NAME,
        'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    )::text);

    RETURN NEW;
END;
$BODY$;

CREATE TABLE public.one(
    cluster INT NOT NULL,
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO public.one(cluster, name)
VALUES(100, 'one'), (200, 'two');

CREATE TRIGGER notify_trg
AFTER INSERT OR UPDATE OR DELETE
ON public.one
FOR EACH ROW
EXECUTE PROCEDURE public.notify_trg('row');
`;

interface OneTableRow {
    cluster: number;
    id: number;
    name: string;
}

const OneTableDescriptor: TableDescriptor<
    OneTableRow> = {
        schema: "public",
        table: "one",
    };

interface OneIndexState {
    [id: number]: OneTableRow;
}

interface OneIndexShard {
    cluster: number;
}

const OneIndexDescriptor: IndexDescriptor<
    OneTableRow,
    OneIndexState,
    OneIndexShard> = {
        schema: "public",
        table: "one",
        path: ["id"],
        makeRowFilter: ({ cluster }) => ({ cluster }),
        makeShardKey: ({ cluster }) => [cluster],
    };

test("TableDataClient", t =>
    using(DatabaseTestContext.create(sql), ({ pool }) =>
        using(new DatabaseNotificationPool(pool), dnp =>
            using(new ChannelNotificationPool(dnp), cnp =>
                using(new TableDataPool(dnp, cnp, "row"), tdp =>
                    using(
                        TableIndexClient.create(
                            tdp,
                            OneIndexDescriptor,
                            { cluster: 100 },
                        ),
                        async tic => {
                            const ch = new Channel();
                            tic.listen(patch => ch.send(patch));

                            t.deepEqual(tic.state, {
                                1: { cluster: 100, id: 1, name: "one" },
                            });

                            await pool.query(`
                            INSERT INTO public.one(cluster, name)
                            VALUES(100, 'three')
                            `);
                            t.deepEqual(
                                await ch.receive(),
                                {
                                    3: { cluster: 100, id: 3, name: "three" },
                                },
                            );

                            await pool.query(`
                            UPDATE public.one
                            SET name = 'four'
                            WHERE id = 1
                            `);
                            t.deepEqual(
                                await ch.receive(),
                                {
                                    1: { cluster: 100, id: 1, name: "four" },
                                },
                            );

                            await pool.query(`
                            DELETE FROM public.one
                            WHERE id = 1
                            `);
                            t.deepEqual(
                                await ch.receive(),
                                {
                                    1: null,
                                },
                            );

                            t.deepEqual(tic.state, {
                                1: null,
                                3: { cluster: 100, id: 3, name: "three" },
                            });

                            await pool.query(`
                            UPDATE public.one
                            SET cluster = 100
                            WHERE id = 2
                            `);
                            t.deepEqual(
                                await ch.receive(),
                                {
                                    2: { cluster: 100, id: 2, name: "two" },
                                },
                            );

                            await pool.query(`
                            UPDATE public.one
                            SET cluster = 200
                            WHERE id = 3
                            `);
                            t.deepEqual(
                                await ch.receive(),
                                {
                                    3: null,
                                },
                            );

                            t.deepEqual(tic.state, {
                                1: null,
                                2: { cluster: 100, id: 2, name: "two" },
                                3: null,
                            });

                        },
                    ),
                ),
            ),
        ),
    ),
);