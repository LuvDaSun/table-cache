import { RowFilter, TableDescriptor } from "table-access";

export interface IndexDescriptor<
    TRow extends object,
    TState extends object,
    TShard extends object>
    extends TableDescriptor<TRow> {
    readonly path: Array<keyof TRow>;
    makeShardKey(arg: TShard): PropertyKey[];
    makeRowFilter(arg: TShard): RowFilter<TRow> | Partial<TRow>;
}
