import { RowFilter, TableDescriptor } from "table-access";

export type IndexDescriptorRowKey<TRow> =
    Array<keyof TRow> |
    ((row: TRow) => PropertyKey[]);

export type IndexDescriptorShardKey<TShard> =
    Array<keyof TShard> |
    ((shard: TShard) => PropertyKey[]);

export type IndexDescriptorShardFilter<TShard, TRow> =
    Array<keyof TShard> |
    ((shard: TShard) => RowFilter<TRow> | Partial<TRow>);

export interface IndexDescriptor<
    TRow extends object,
    TState extends object,
    TShard extends object = {}>
    extends TableDescriptor<TRow> {
    readonly rowKey: IndexDescriptorRowKey<TRow>;
    readonly shardKey?: IndexDescriptorShardKey<TShard>;
    readonly shardFilter?: IndexDescriptorShardFilter<TShard, TRow>;

}
