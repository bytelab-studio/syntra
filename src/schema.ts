import {
    Table,
    TableRef,
    ColumnFlags,
    PrimaryColumn,
    Relation,
    RelationLoad,
    SQLType,
    SchemaBuilder,
    SchemaBodyBuilder
} from "@bytelab.studio/syntra.plugin";

interface ColumnSchemaFlags {
    auto_increment: boolean;
    nullable: boolean;
    unique: boolean;
    readonly: boolean;
    private: boolean;
    primary_key: boolean;
}

interface ColumnSchema {
    type: "column";
    sql_type: string;
    json_type: string;
    flags: ColumnSchemaFlags;
}

interface RelationSchema {
    type: "relation";
    sql_type: string;
    json_type: string;
    flags: ColumnSchemaFlags;
    ref: `/schema/models/${string}`;
    loading_type: "DIRECT" | "LAZY";
}

type ColumnSchemas = ColumnSchema | RelationSchema;

interface ModelSchema {
    table: string;
    columns: Record<string, ColumnSchemas>;
}

export function buildModelSchema(table: TableRef<Table>): ModelSchema {
    const t: Table = new table();
    const columns: Record<string, ColumnSchemas> = {};
    for (const column of t.getColumns()) {
        if (column instanceof Relation) {
            columns[column.getColumnName()] = {
                type: "relation",
                sql_type: SQLType.BIGINT.sqlName,
                json_type: SQLType.BIGINT.jsonType,
                flags: {
                    auto_increment: column.containsFlag(ColumnFlags.AUTO_INCREMENT),
                    nullable: column.containsFlag(ColumnFlags.NULLABLE),
                    unique: column.containsFlag(ColumnFlags.UNIQUE),
                    readonly: column.containsFlag(ColumnFlags.READONLY),
                    private: column.containsFlag(ColumnFlags.PRIVATE),
                    primary_key: false
                },
                ref: `/schema/models/${column.refTable.tableName}`,
                loading_type: RelationLoad[column.loadingMethod] as "DIRECT" | "LAZY"
            }
        } else {
            columns[column.getColumnName()] = {
                type: "column",
                sql_type: column.getColumnType().sqlName,
                json_type: column.getColumnType().jsonType,
                flags: {
                    auto_increment: column.containsFlag(ColumnFlags.AUTO_INCREMENT),
                    nullable: column.containsFlag(ColumnFlags.NULLABLE),
                    unique: column.containsFlag(ColumnFlags.UNIQUE),
                    readonly: column.containsFlag(ColumnFlags.READONLY),
                    private: column.containsFlag(ColumnFlags.PRIVATE),
                    primary_key: column instanceof PrimaryColumn
                }
            }
        }
    }

    return {
        table: t.tableName,
        columns: columns,
    }
}

export function buildRouteSchema(table: TableRef<Table>): object[] {
    const routes: object[] = [];
    if (table.routes.enableGetAllRoute) {
        const builder: SchemaBuilder = new SchemaBuilder("GET", `/${table.tableName}`);
        builder.response(200, builder =>
            builder.contentType("application/json")
                .content(builder =>
                    builder.object(builder =>
                        builder.item("status", builder =>
                            builder.property(SQLType.INT)
                        )
                            .item("count", builder =>
                                builder.property(SQLType.INT)
                            )
                            .item("results", builder =>
                                builder.referenceArray(table)
                            )
                    )
                )
        );
        routes.push(builder.toJSON());
    }
    if (table.routes.enableGetSingleRoute) {
        const builder: SchemaBuilder = new SchemaBuilder("GET", `/${table.tableName}/:id`);
        builder.param("path", "id", SQLType.BIGINT, "PrimaryKey of the fetching resource")
            .response(200, builder =>
                builder.contentType("application/json")
                    .content(builder =>
                        builder.object(builder =>
                            builder.item("status", builder =>
                                builder.property(SQLType.INT)
                            )
                                .item("count", builder =>
                                    builder.property(SQLType.INT)
                                )
                                .item("results", builder =>
                                    builder.referenceArray(table)
                                )
                        )
                    )
            );
        routes.push(builder.toJSON());
    }
    if (table.routes.enableCreateRoute) {
        const builder: SchemaBodyBuilder = new SchemaBodyBuilder("POST", `/${table.tableName}`);
        builder.accept("application/json")
            .body(builder =>
                builder.object(builder =>
                    builder.item("data", builder =>
                        builder.reference(table)
                    ).item("permission", builder =>
                        builder.object(builder =>
                                builder.item("read_level", builder =>
                                    builder.property(SQLType.INT, false, true)
                                ).item("write_level", builder =>
                                    builder.property(SQLType.INT, false, true)
                                ).item("delete_level", builder =>
                                    builder.property(SQLType.INT, false, true)
                                ),
                            false, true)
                    )
                )
            )
            .response(200, builder =>
                builder.contentType("application/json")
                    .content(builder =>
                        builder.object(builder =>
                            builder.item("status", builder =>
                                builder.property(SQLType.INT)
                            )
                                .item("count", builder =>
                                    builder.property(SQLType.INT)
                                )
                                .item("results", builder =>
                                    builder.referenceArray(table)
                                )
                        )
                    )
            );
        routes.push(builder.toJSON());
    }
    if (table.routes.enableUpdateRoute) {
        const builder: SchemaBodyBuilder = new SchemaBodyBuilder("POST", `/${table.tableName}/:id`);
        builder.accept("application/json")
            .param("path", "id", SQLType.BIGINT, "PrimaryKey of the updating resource")
            .body(builder =>
                builder.reference(table)
            )
            .response(200, builder =>
                builder.contentType("application/json")
                    .content(builder =>
                        builder.object(builder =>
                            builder.item("status", builder =>
                                builder.property(SQLType.INT)
                            )
                                .item("count", builder =>
                                    builder.property(SQLType.INT)
                                )
                                .item("results", builder =>
                                    builder.referenceArray(table)
                                )
                        )
                    )
            );
        routes.push(builder.toJSON());
    }
    if (table.routes.enableDeleteRoute) {
        const builder: SchemaBodyBuilder = new SchemaBodyBuilder("DELETE", `/${table.tableName}/:id`);
        builder.param("path", "id", SQLType.BIGINT, "PrimaryKey of the deleting resource")
            .accept("application/octet-stream")
            .body("none")
            .response(200, builder =>
                builder.contentType("application/json")
                    .content(builder =>
                        builder.object(builder =>
                            builder.item("status", builder =>
                                builder.property(SQLType.INT)
                            )
                        )
                    )
            );
        routes.push(builder.toJSON());
    }
    table.routes.forEach(route => routes.push(route.schema));
    return routes;
}