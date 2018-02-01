import { RowFilter } from "table-access";
import { Disposable, DisposableComposition, using } from "using-disposable";
import { transform, Transformer } from "./deep";
import {
    IndexDescriptor,
    IndexDescriptorRowFilter, IndexDescriptorRowKey, IndexDescriptorShardKey,
} from "./index-descriptor";
import { RowChangeListener } from "./table-data-client";
import { TableDataPool } from "./table-data-pool";

export type TableIndexPatchListener<TIndexModel> =
    (patch: TIndexModel) => void;

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
    private readonly listeners = new Set<TableIndexPatchListener<TIndex>>();

    private constructor(
        private readonly tableDataPool: TableDataPool,
        private readonly descriptor: IndexDescriptor<TRow, TIndex, TShard>,
        private readonly shard: TShard,
    ) {
        super();
    }

    public listen(listener: TableIndexPatchListener<TIndex>): Disposable {
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

        const filter = resolveIndexDescriptorRowFilter(shard, this.descriptor.rowFilter);
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

    private notifyListeners(patch: TIndex) {
        this.listeners.forEach(listener => listener(patch));
    }

    private handleRowChange: RowChangeListener<TRow> =
        (newRow, oldRow) => {
            const oldKey = oldRow && this.getRowKey(oldRow);
            const newKey = newRow && this.getRowKey(newRow);
            const transformer = ({ set }: Transformer) => {
                if (oldKey !== null) set(oldKey, null);
                if (newKey !== null) set(newKey, newRow);
            };

            const patch = {} as TIndex;

            transform(this.state, transformer, true);
            transform(patch, transformer, true);

            this.notifyListeners(patch);
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
        return rowKey.map(key => String(row[key]));
    }
    throw new Error(`invalid rowKey ${rowKey}`);
}

function resolveIndexDescriptorRowFilter<TShard, TRow>(
    shard: TShard,
    rowFilter?: IndexDescriptorRowFilter<TShard, TRow>,
): RowFilter<TRow> | Partial<TRow> {
    if (rowFilter === undefined) {
        return Object.keys(shard).
            map(k => k as keyof TShard).
            reduce(
                (f, k) => Object.assign(f, { [k]: shard[k] }),
                {} as Partial<TRow>,
        );
    }
    if (typeof rowFilter === "function") {
        return rowFilter(shard);
    }
    if (Array.isArray(rowFilter)) {
        return rowFilter.reduce(
            (f, k) => Object.assign(f, { [k]: shard[k] }),
            {} as Partial<TRow>,
        );
    }
    throw new Error(`invalid rowFilter ${rowFilter}`);
}
