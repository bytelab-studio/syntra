import {OpenApiBuilder, OpenAPIObject, ReferenceObject, SchemaObject, SchemaObjectType} from "openapi3-ts/oas31";
import {
    ColumnFlags,
    getTables,
    OpenAPISchemaBuilder,
    PrimaryColumn,
    Relation,
    RelationLoad,
    SchemaDefinition,
    SQLType,
    Table,
    TableRef
} from "@bytelab.studio/syntra.plugin";

const PERMISSION_OBJECT = SchemaDefinition.define("PERMISSION_OBJECT", {
    type: "object",
    properties: {
        read_level: {
            type: "integer"
        },
        write_level: {
            type: "integer"
        },
        delete_level: {
            type: "integer"
        }
    }
});
const DELETE_RESULT = SchemaDefinition.define("DELETE_RESULT", {
    type: "object",
    properties: {
        status: {
            type: "integer"
        }
    }
});

function generateSelectResult(table: TableRef<Table>): SchemaDefinition {
    return SchemaDefinition.define(`${table.tableName}_select_res`, {
        type: "object",
        properties: {
            status: {
                type: "integer"
            },
            count: {
                type: "integer"
            },
            results: {
                type: "array",
                items: {
                    $ref: SchemaDefinition.of(table, "select").location
                }
            }
        }
    });
}

function generateSelectModel(table: TableRef<Table>, builder: OpenApiBuilder): void {
    const row: Table = new table();
    const properties: { [p: string]: SchemaObject | ReferenceObject } = {};

    for (const column of row.getColumns()) {
        if (column.containsFlag(ColumnFlags.PRIVATE)) {
            continue;
        }
        let format: 'int32' | 'int64' | 'float' | 'double' | 'byte' | 'binary' | 'date' | 'date-time' | 'password' | string | undefined = undefined;
        const type: SQLType = column.getColumnType();
        if (type == SQLType.DATE) {
            format = "date";
        }
        if (type == SQLType.TIME) {
            format = "time";
        }
        if (type == SQLType.DATETIME) {
            format = "date-time";
        }
        properties[column.getColumnName()] = {
            type: column.getColumnType().jsonType as SchemaObjectType | SchemaObjectType[],
            format: format
        }
        if (column instanceof Relation && column.loadingMethod == RelationLoad.DIRECT) {
            properties[column.refTable.tableName] = {
                type: "object",
                $ref: `#/components/schemas/${column.refTable.tableName + "_select"}`
            }
        }
    }

    builder.addSchema(table.tableName + "_select", {
        type: "object",
        properties: properties
    });
}

function generateCreateModel(table: TableRef<Table>, builder: OpenApiBuilder): void {
    const row: Table = new table();
    const properties: { [p: string]: SchemaObject | ReferenceObject } = {};

    for (const column of row.getColumns()) {
        if (column instanceof PrimaryColumn) {
            continue;
        }
        let format: 'int32' | 'int64' | 'float' | 'double' | 'byte' | 'binary' | 'date' | 'date-time' | 'password' | string | undefined = undefined;
        const type: SQLType = column.getColumnType();
        if (type == SQLType.DATE) {
            format = "date";
        }
        if (type == SQLType.TIME) {
            format = "time";
        }
        if (type == SQLType.DATETIME) {
            format = "date-time";
        }
        properties[column.getColumnName()] = {
            type: column.getColumnType().jsonType as SchemaObjectType | SchemaObjectType[],
            format: format,
        }
    }

    builder.addSchema(table.tableName + "_create", {
        type: "object",
        properties: {
            permission: {
                $ref: PERMISSION_OBJECT.location
            },
            data: {
                type: "object",
                properties: properties,
                required: Array.from(row.getColumns()).filter(col => !col.containsFlag(ColumnFlags.NULLABLE)).map(col => col.getColumnName())
            }
        },
        required: ["data"]
    });
}


function generateUpdateModel(table: TableRef<Table>, builder: OpenApiBuilder): void {
    const row: Table = new table();
    const properties: { [p: string]: SchemaObject | ReferenceObject } = {};

    for (const column of row.getColumns()) {
        if (column.containsFlag(ColumnFlags.PRIVATE) || column.containsFlag(ColumnFlags.READONLY)) {
            continue;
        }
        let format: 'int32' | 'int64' | 'float' | 'double' | 'byte' | 'binary' | 'date' | 'date-time' | 'password' | string | undefined = undefined;
        const type: SQLType = column.getColumnType();
        if (type == SQLType.DATE) {
            format = "date";
        }
        if (type == SQLType.TIME) {
            format = "time";
        }
        if (type == SQLType.DATETIME) {
            format = "date-time";
        }
        properties[column.getColumnName()] = {
            type: column.getColumnType().jsonType as SchemaObjectType | SchemaObjectType[],
            format: format
        }
    }

    builder.addSchema(table.tableName + "_update", {
        type: "object",
        properties: properties
    });
}

let cache: undefined | string;

export function generateOAS(): string {
    if (!!cache) {
        return cache;
    }
    const builder = OpenApiBuilder
        .create()
        .addOpenApiVersion("3.0.1")
        .addInfo({
            title: "APP",
            description: "BLABLABLA",
            version: "1.0.0"
        })
        .addTitle("APP")
        .addSecurityScheme("bearerAuth", {
            name: "Bearer",
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token from '/auth/login' using `Bearer <token>`"
        });

    getTables().forEach(table => {
        generateSelectModel(table, builder);
        generateUpdateModel(table, builder);
        generateCreateModel(table, builder);

        const resultSchema = generateSelectResult(table);
        if (table.routes.enableGetAllRoute) {
            const sbuilder: OpenAPISchemaBuilder = new OpenAPISchemaBuilder("GET", `/${table.tableName}`, table);
            sbuilder.addResponse(200, resultSchema);

            sbuilder.add(builder);
        }
        if (table.routes.enableGetSingleRoute) {
            const sbuilder: OpenAPISchemaBuilder = new OpenAPISchemaBuilder("GET", `/${table.tableName}/:id`, table);
            sbuilder.addParameter("id", "path", SQLType.BIGINT);
            sbuilder.addResponse(200, resultSchema);

            sbuilder.add(builder);
        }
        if (table.routes.enableCreateRoute) {
            const sbuilder: OpenAPISchemaBuilder = new OpenAPISchemaBuilder("POST", `/${table.tableName}`, table);
            sbuilder.setRequestBody(SchemaDefinition.of(table, "create"));
            sbuilder.addResponse(200, resultSchema);

            sbuilder.add(builder);
        }
        if (table.routes.enableUpdateRoute) {
            const sbuilder: OpenAPISchemaBuilder = new OpenAPISchemaBuilder("PUT", `/${table.tableName}/:id`, table);
            sbuilder.addParameter("id", "path", SQLType.BIGINT);
            sbuilder.setRequestBody(SchemaDefinition.of(table, "update"));
            sbuilder.addResponse(200, resultSchema);

            sbuilder.add(builder);
        }
        if (table.routes.enableDeleteRoute) {
            const sbuilder: OpenAPISchemaBuilder = new OpenAPISchemaBuilder("DELETE", `/${table.tableName}/:id`, table);
            sbuilder.addParameter("id", "path", SQLType.BIGINT);
            sbuilder.addResponse(200, DELETE_RESULT);

            sbuilder.add(builder);
        }

        table.routes.forEach(route => {
            route.schema.add(builder);
        });
    });

    SchemaDefinition.forEach((name, definition) => builder.addSchema(name, definition));

    const json: OpenAPIObject = builder.getSpec();
    json.security = [{
        "bearerAuth": []
    }]
    return cache = JSON.stringify(json);
}