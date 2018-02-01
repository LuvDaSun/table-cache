import { RowFilter } from "table-access";
import { Disposable, DisposableComposition, using } from "using-disposable";
import { transform, Transformer } from "./deep";
import {
    IndexDescriptor,
    IndexDescriptorPath, IndexDescriptorRowFilter, IndexDescriptorShardKey,
} from "./index-descriptor";
import { RowChangeListener } from "./table-data-client";
import { TableDataPool } from "./table-data-pool";

export type TableIndexPatchListener<TIndexModel> =
    (patch: TIndexModel) => void;

export class TableIndexClient<
    TRow extends TShard,
    TIndex extends object,
    TShard extends object>
    extends DisposableComposition {

    public static async create<
        TRow extends TShard,
        TIndex extends object,
        TShard extends object>(
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

    private getIndexStatePath(
        row: TRow,
    ): PropertyKey[] {
        return resolveIndexDescriptorPath(row, this.descriptor.path);
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
                const path = this.getIndexStatePath(row);
                set(path, row);
            }
        }, true);
    }

    private notifyListeners(patch: TIndex) {
        this.listeners.forEach(listener => listener(patch));
    }

    private handleRowChange: RowChangeListener<TRow> =
        (newRow, oldRow) => {
            const oldPath = oldRow && this.getIndexStatePath(oldRow);
            const newPath = newRow && this.getIndexStatePath(newRow);
            const transformer = ({ set }: Transformer) => {
                if (oldPath !== null) set(oldPath, null);
                if (newPath !== null) set(newPath, newRow);
            };

            const patch = {} as TIndex;

            transform(this.state, transformer, true);
            transform(patch, transformer, true);

            this.notifyListeners(patch);
        }
}

function resolveIndexDescriptorPath<TRow>(
    row: TRow,
    path: IndexDescriptorPath<TRow>,
): PropertyKey[] {
    if (typeof path === "function") {
        return path(row);
    }
    if (Array.isArray(path)) {
        return path.map(key => String(row[key]));
    }
    throw new Error(`invalid path ${path}`);
}

function resolveIndexDescriptorRowFilter<TShard>(
    shard: TShard,
    rowFilter?: IndexDescriptorRowFilter<TShard>,
): RowFilter<TShard> | Partial<TShard> {
    if (rowFilter === undefined) {
        return Object.keys(shard).
            map(k => k as keyof TShard).
            reduce(
                (f, k) => Object.assign(f, { [k]: shard[k] }),
                {} as Partial<TShard>,
        );
    }
    if (typeof rowFilter === "function") {
        return rowFilter(shard);
    }
    if (Array.isArray(rowFilter)) {
        return rowFilter.reduce(
            (f, k) => Object.assign(f, { [k]: shard[k] }),
            {} as Partial<TShard>,
        );
    }
    throw new Error(`invalid rowFilter ${rowFilter}`);
}
