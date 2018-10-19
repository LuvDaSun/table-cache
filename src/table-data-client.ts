import { Disposable, DisposableComposition, using } from "dispose";
import { makeRowFilterFunction, makeRowFilterPg, RowFilter, TableDescriptor } from "table-access";
import { ChannelNotificationPool } from "./channel-notification-pool";
import { DatabaseNotificationPool } from "./database-notification-pool";

export interface RowTriggerMessage<TRow extends object> {
    op: "INSERT" | "UPDATE" | "DELETE";
    schema: string;
    table: string;
    old: TRow | null;
    new: TRow | null;
}
export type RowChangeListener<TRow extends object> =
    (newRow: TRow | null, oldRow: TRow | null) => void;

export class TableDataClient<TRow extends object> extends DisposableComposition {

    public static async create<TRow extends object>(
        databaseNotificationPool: DatabaseNotificationPool,
        channelNotificationPool: ChannelNotificationPool,
        channel: string,
        descriptor: TableDescriptor<TRow>,
    ) {
        const instance = new TableDataClient<TRow>(
            databaseNotificationPool,
            channelNotificationPool,
            channel,
            descriptor,
        );
        await instance.initialize();
        return instance;
    }

    private readonly listeners = new Set<RowChangeListener<TRow>>();
    private constructor(
        private databaseNotificationPool: DatabaseNotificationPool,
        private channelNotificationPool: ChannelNotificationPool,
        private channel: string,
        private descriptor: TableDescriptor<TRow>,
    ) {
        super();
    }

    public async listen(
        filter: RowFilter<TRow> | Partial<TRow>,
        handler: RowChangeListener<TRow>,
    ): Promise<Disposable> {
        const filterFunction = makeRowFilterFunction(filter);
        const listener: RowChangeListener<TRow> = (newRow, oldRow) => {
            newRow = newRow && filterFunction(newRow) ? newRow : null;
            oldRow = oldRow && filterFunction(oldRow) ? oldRow : null;

            if (newRow || oldRow) handler(newRow, oldRow);
        };
        this.listeners.add(listener);
        const dispose = async () => {
            this.listeners.delete(listener);
        };
        return { dispose };
    }

    public async fetch(
        filter: RowFilter<TRow> | Partial<TRow>,
    ): Promise<TRow[]> {
        const { descriptor } = this;
        const filterResult = makeRowFilterPg(filter, "r");
        const result = await using(
            this.databaseNotificationPool.lease([]),
            ({ client }) => client.query(`
SELECT row_to_json(r) AS o
FROM "${descriptor.schema}"."${descriptor.table}" AS r
${filterResult.paramCount ? `WHERE ${filterResult.filterSql}` : ""}
;`, filterResult.param));

        const { rows } = result;
        return rows.map(row => row.o);
    }

    private async initialize() {
        const { channel } = this;

        const notifyChannel =
            await this.channelNotificationPool.lease({ channel });
        this.registerDisposable(notifyChannel);

        const listener =
            notifyChannel.listen(this.notificationHandler);
        this.registerDisposable(listener);
    }

    private notificationHandler = (message: RowTriggerMessage<TRow>) => {
        const { descriptor } = this;
        if (message.schema !== descriptor.schema) return;
        if (message.table !== descriptor.table) return;
        this.notifyListeners(message.new, message.old);
    }

    private notifyListeners(newRow: TRow | null, oldRow: TRow | null) {
        this.listeners.forEach(listener => listener(newRow, oldRow));
    }

}
