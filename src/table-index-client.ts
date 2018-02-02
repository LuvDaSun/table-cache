import { RowFilter } from "table-access";
import { Disposable, DisposableComposition, using } from "using-disposable";
import { arrayEqual } from "./array";
import { transform, Transformer } from "./deep";
import {
    IndexDescriptor,
    IndexDescriptorRowKey, IndexDescriptorShardFilter, IndexDescriptorShardKey,
} from "./index-descriptor";
import { toPropertyKey } from "./property-key";
import { RowChangeListener } from "./table-data-client";
import { TableDataPool } from "./table-data-pool";

export type TableIndexListener =
    (changedKey: PropertyKey[]) => void;

export class TableIndexClient<
    TRow extends object,
    TIndex extends object,
    TShard extends object = {}>
    extends DisposableComposition {

    public static async create<
        TRow extends object,
        TIndex extends object,
        TShard extends object= {}>(
            tableDataPool: TableDataPool,
            descriptor: IndexDescriptor<TRow, TIndex, TShard>,
            shard: TShard,
    ) {
        const index = new TableIndexClient(tableDataPool, descriptor, shard);
        await index.initialize();
        return index;
    }

    public readonly state = {} as TIndex;
    private readonly listeners = new Set<TableIndexListener>();

    private constructor(
        private readonly tableDataPool: TableDataPool,
        private readonly descriptor: IndexDescriptor<TRow, TIndex, TShard>,
        private readonly shard: TShard,
    ) {
        super();
    }

    public listen(listener: TableIndexListener): Disposable {
        this.listeners.add(listener);
        const dispose = () => {
            this.listeners.delete(listener);
        };
        return { dispose };
    }

    private getRowKey(
        row: TRow,
    ): PropertyKey[] {
        return resolveIndexDescriptorRowKey(row, this.descriptor.rowKey);
    }

    private async initialize() {
        const { tableDataPool, descriptor, shard } = this;

        const dataTable =
            await tableDataPool.lease({ descriptor });
        this.registerDisposable(dataTable);

        const filter = resolveIndexDescriptorShardFilter(shard, this.descriptor.shardFilter);
        const listener =
            await dataTable.listen(filter, this.handleRowChange);
        this.registerDisposable(listener);

        const rows = await dataTable.fetch(filter);
        this.initializeCache(rows);
    }

    private initializeCache(rows: TRow[]) {
        transform(this.state, ({ set }) => {
            for (const row of rows) {
                const rowKey = this.getRowKey(row);
                set(rowKey, row);
            }
        }, true);
    }

    private notifyListeners(changedKey: PropertyKey[]) {
        this.listeners.forEach(listener => listener(changedKey));
    }

    private handleRowChange: RowChangeListener<TRow> =
        (newRow, oldRow) => {
            const oldKey = oldRow && this.getRowKey(oldRow);
            const newKey = newRow && this.getRowKey(newRow);
            const keysEqual = oldKey && newKey && arrayEqual(oldKey, newKey);

            transform(this.state, ({ set }: Transformer) => {
                if (oldKey !== null && !keysEqual) set(oldKey, null);
                if (newKey !== null) set(newKey, newRow);
            }, true);

            if (oldKey !== null && !keysEqual) this.notifyListeners(oldKey);
            if (newKey !== null) this.notifyListeners(newKey);
        }
}

function resolveIndexDescriptorRowKey<TRow>(
    row: TRow,
    rowKey: IndexDescriptorRowKey<TRow>,
): PropertyKey[] {
    if (typeof rowKey === "function") {
        return rowKey(row);
    }
    if (Array.isArray(rowKey)) {
        return rowKey.map(key => toPropertyKey(row[key]));
    }
    throw new Error(`invalid rowKey ${rowKey}`);
}

function resolveIndexDescriptorShardFilter<TShard, TRow>(
    shard: TShard,
    shardFilter?: IndexDescriptorShardFilter<TShard, TRow>,
): RowFilter<TRow> | Partial<TRow> {
    if (shardFilter === undefined) {
        return Object.keys(shard).
            map(k => k as keyof TShard).
            reduce(
                (f, k) => Object.assign(f, { [k]: shard[k] }),
                {} as Partial<TRow>,
        );
    }
    if (typeof shardFilter === "function") {
        return shardFilter(shard);
    }
    if (Array.isArray(shardFilter)) {
        return shardFilter.reduce(
            (f, k) => Object.assign(f, { [k]: shard[k] }),
            {} as Partial<TRow>,
        );
    }
    throw new Error(`invalid shardFilter ${shardFilter}`);
}
