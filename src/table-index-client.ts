import { RowFilter } from "table-access";
import { Disposable, DisposableComposition, using } from "using-disposable";
import { transform, Transformer } from "./deep";
import { IndexDescriptor } from "./index-descriptor";
import { RowChangeListener } from "./table-data-client";
import { TableDataPool } from "./table-data-pool";

export type TableIndexPatchListener<TIndexModel> =
    (patch: TIndexModel) => void;

export class TableIndexClient<
    TRow extends object,
    TIndex extends object,
    TShard extends object>
    extends DisposableComposition {

    public static async create<
        TRow extends object,
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
        return this.descriptor.path.map(key => String(row[key]));
    }

    private async initialize() {
        const { tableDataPool, descriptor, shard } = this;

        const dataTable =
            await tableDataPool.lease({ descriptor });
        this.registerDisposable(dataTable);

        const filter = this.descriptor.makeRowFilter(shard);
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
