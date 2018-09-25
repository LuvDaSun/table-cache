import * as test from "blue-tape";
import { using } from "dispose";
import { Channel } from "go-channel";
import { PgContext } from "pg-context";
import { TableDescriptor } from "table-access";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";
import { TableDataClient } from "./table-data-client";

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
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO public.one(name)
VALUES('one'), ('two');

CREATE TRIGGER notify_trg
AFTER INSERT OR UPDATE OR DELETE
ON public.one
FOR EACH ROW
EXECUTE PROCEDURE public.notify_trg('row');
`;

interface OneTableRow {
    id: number;
    name: string;
}

const OneTableDescriptor: TableDescriptor<OneTableRow> = {
    schema: "public",
    table: "one",
};

test("TableDataClient", t =>
    using(PgContext.create(sql), ({ pool }) =>
        using(new DatabaseNotificationPool(pool), dnp =>
            using(new ChannelNotificationPool(dnp), cnp =>
                using(
                    TableDataClient.create(
                        dnp,
                        cnp,
                        "row",
                        OneTableDescriptor,
                    ),
                    async tdc => {
                        const ch = new Channel();
                        tdc.listen({ name: "four" }, (newRow, oldRow) => {
                            ch.send([newRow, oldRow]);
                        });

                        await pool.query(`
                        INSERT INTO public.one(name)
                        VALUES('three'), ('four')
                        `);
                        t.deepEqual(
                            await ch.receive(),
                            [{ id: 4, name: "four" }, null],
                        );

                        await pool.query(`
                        UPDATE public.one
                        SET name = 'four'
                        WHERE id = 1
                        `);
                        t.deepEqual(
                            await ch.receive(),
                            [{ id: 1, name: "four" }, null],
                        );

                        await pool.query(`
                        DELETE FROM public.one
                        WHERE id = 1
                        `);
                        t.deepEqual(
                            await ch.receive(),
                            [null, { id: 1, name: "four" }],
                        );

                        t.deepEqual(
                            await tdc.fetch({ name: "four" }),
                            [{ id: 4, name: "four" }],
                        );

                    },
                ),
            ),
        ),
    ),
);
