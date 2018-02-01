import { RowFilter, TableDescriptor } from "table-access";

export type IndexDescriptorPath<TRow> =
    Array<keyof TRow> |
    ((row: TRow) => PropertyKey[]);

export type IndexDescriptorShardKey<TShard> =
    Array<keyof TShard> |
    ((shard: TShard) => PropertyKey[]);

export type IndexDescriptorRowFilter<TShard, TRow> =
    Array<keyof TShard> |
    ((shard: TShard) => RowFilter<TRow> | Partial<TRow>);

export interface IndexDescriptor<
    TRow extends object,
    TState extends object,
    TShard extends object = {}>
    extends TableDescriptor<TRow> {
    readonly path: IndexDescriptorPath<TRow>;
    readonly shardKey?: IndexDescriptorShardKey<TShard>;
    readonly rowFilter?: IndexDescriptorRowFilter<TShard, TRow>;

}
