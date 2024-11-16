import * as dbhelper from "./dbhelper";

import {
    setBridge,
    Bridge,
    TableRef,
    Table,
    ColumnFlags,
    Relation1T1,
    Permission,
    getTables,
    Column, Relation1TN
} from "@bytelab.studio/syntra.plugin"
import * as mysql from "mysql2/promise"

function map_row_to_map(row: any): Map<string, any> {
    const map: Map<string, any> = new Map<string, any>();

    for (const key in row) {
        map.set(key, row[key]);
    }

    return map;
}

function map_row_to_object<T extends TableRef<K>, K extends Table>(row: mysql.RowDataPacket, table: T, asName: string | undefined = undefined): K {
    const result: K = new table() as K;
    const tableData: Map<string, any> = map_row_to_map(row[asName || result.tableName]);

    for (const column of result.getColumns()) {
        if (column instanceof Column || column instanceof Relation1T1) {
            if (!tableData.has(column.getColumnName())) {
                if (!column.containsFlag(ColumnFlags.NULLABLE)) {
                    throw `Missing column data '${column.getColumnName()}'`;
                }
                column.setValue(null);
            }
        }

        const value: any = tableData.get(column.getColumnName());
        if (column instanceof Relation1T1) {
            if (column.getColumnType().validate(value)) {
                column.setKeyValue(value);
            }
            if (!column.isKeyNull()) {
                column.setValue(map_row_to_object(row, column.refTable, column.getJoinName(table.tableName)));
            }
        } else if (column instanceof Column) {
            if (column.getColumnType().validate(value)) {
                column.setValue(value);
            } else {
                throw `Type mismatch of column '${column.getColumnName()}'`;
            }
        }
    }

    return result;
}

async function post_process_row<T extends Table>(row: T, relation: Relation1TN<Table>): Promise<void> {
    const query: string = dbhelper.construct_1_to_n(relation);
    const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
        sql: query,
        values: [row.primaryKey.getValue()],
        nestTables: true
    });
    relation.setValue(await Promise.all(rows.map(async rowData => {
        const row: Table = map_row_to_object(rowData, relation.refTable);

        for (const relation of row.get1TNRelations()) {
            await post_process_row(row, relation);
        }

        return row;
    })));
}

class BridgeImpl implements Bridge {
    async selectSingle<T extends TableRef<K>, K extends Table>(table: T, id: number): Promise<K | null> {
        const query: string = dbhelper.construct_select_single(table);
        const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
            sql: query,
            values: [id],
            nestTables: true
        });

        if (rows.length == 0) {
            return null;
        }

        const row: K = map_row_to_object<T, K>(rows[0], table);

        for (const relation of row.get1TNRelations()) {
            await post_process_row(row, relation);
        }
        return row;
    }

    async selectAll<T extends TableRef<K>, K extends Table>(table: T): Promise<K[]> {
        const query: string = dbhelper.construct_select_all(table);
        const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
            sql: query,
            values: [],
            nestTables: true
        });

        return Promise.all(rows.map(async rowData => {
            const row: K = map_row_to_object<T, K>(rowData, table);

            for (const relation of row.get1TNRelations()) {
                await post_process_row(row, relation);
            }

            return row;
        }));
    }

    async update<K extends Table>(item: K): Promise<void> {
        try {
            await connection.beginTransaction();
            const query: string = dbhelper.construct_update(item);
            const values: any[] = [...Array.from(item.getColumns()).filter(i => i != item.primaryKey && i != item.permission).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.getValue()), item.primaryKey.getValue()];
            await connection.query({
                sql: query,
                values: values
            });
            await connection.commit();
        } catch (e) {
            console.log(`Cannot update '${item.tableName}': ${e}`);
            await connection.rollback();
        }
    }

    async insert<K extends Table>(item: K, permission: Permission): Promise<void> {
        try {
            await connection.beginTransaction();
            {
                const query: string = dbhelper.construct_insert_single(permission);
                const values: any[] = (Array.from(permission.getColumns()).filter(i => i instanceof Column || i instanceof Relation1T1) as (Column<unknown> | Relation1T1<Table>)[]).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.containsFlag(ColumnFlags.AUTO_INCREMENT) && i.isNull() ? null : i.getValue());
                await connection.query({
                    sql: query,
                    values: values
                });
                if (permission.primaryKey.isNull()) {
                    const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query("SELECT LAST_INSERT_ID();");
                    permission.primaryKey.setValue(rows[0]["LAST_INSERT_ID()"]);
                }
            }
            item.permission.setValue(permission);
            {
                const query: string = dbhelper.construct_insert_single(item);
                const values: any[] = (Array.from(item.getColumns()).filter(i => i instanceof Column || i instanceof Relation1T1) as (Column<unknown> | Relation1T1<Table>)[]).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.containsFlag(ColumnFlags.AUTO_INCREMENT) && i.isNull() ? null : i.getValue());
                await connection.query({
                    sql: query,
                    values: values
                });
                if (item.primaryKey.isNull()) {
                    const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query("SELECT LAST_INSERT_ID();");
                    item.primaryKey.setValue(rows[0]["LAST_INSERT_ID()"]);
                }
            }
            await connection.commit();
        } catch (e) {
            console.log(`Cannot insert into '${item.tableName}': ${e}`);
            await connection.rollback();
        }
    }

    async delete<K extends Table>(item: K): Promise<void> {
        try {
            await connection.beginTransaction();
            {
                const query: string = dbhelper.construct_delete(item);
                await connection.query({
                    sql: query,
                    values: [item.primaryKey.getValue()]
                });
            }
            {
                const query: string = dbhelper.construct_delete(item.permission.getValue());
                await connection.query({
                    sql: query,
                    values: [item.permission.getValue().primaryKey.getValue()]
                });
            }
            await connection.commit();
        } catch (e) {
            console.log(`Cannot delete '${item.tableName}': ${e}`);
            await connection.rollback();
        }
    }

    async rowExist<K extends Table>(item: K): Promise<boolean> {
        try {
            if (item.primaryKey.isNull()) {
                return false;
            }

            await connection.beginTransaction();
            const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query({
                sql: `SELECT EXISTS (SELECT 1 FROM \`${item.tableName}\` WHERE \`${item.primaryKey.getColumnName()}\` = ?) AS x`,
                values: [item.primaryKey.getValue()]
            });
            await connection.commit();
            return rows.length > 0 && rows[0]["x"] == 1;
        } catch (e) {
            await connection.rollback();
            console.log(`Cannot select '${item.tableName}': ${e}`);
            throw `Cannot select '${item.tableName}': ${e}`;
        }
    }
}

let connection: mysql.Connection;

export async function setConnection(conn: mysql.Connection): Promise<void> {
    if (!conn.config.database) {
        throw "A database must be selected";
    }
    connection = conn;
    await connection.connect();
}

export async function declareTable<T extends TableRef<K>, K extends Table>(table: T): Promise<void> {
    const query: string = dbhelper.construct_table_creation(table);
    try {
        console.log(`Declare table ${table.tableName}`);
        await connection.beginTransaction();
        await connection.query(query);
        await connection.commit();
    } catch (e) {
        console.log(`Cannot create table '${table.tableName}': ${e}`);
        await connection.rollback();
    }
}

export async function getDeclaredTables(): Promise<string[]> {
    const database: string = connection.config.database!
    const [rows, _]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query("SELECT table_name, auto_increment FROM information_schema.tables WHERE table_schema = ?", [database]);
    return rows.map(r => r["table_name"]);
}

const DB_HOST: string | undefined = process.env["DB_HOST"];
const DB_DATABASE: string | undefined = process.env["DB_DATABASE"];
const DB_USER: string | undefined = process.env["DB_USER"];
const DB_PASSWORD: string | undefined = process.env["DB_PASSWORD"] || "";
const DB_PORT_VALUE: string | undefined = process.env["DB_PORT"];

if (!DB_HOST) {
    console.log("Required environment variable 'DB_HOST' is not provided");
    process.exit(1);
}
if (!DB_DATABASE) {
    console.log("Required environment variable 'DB_DATABASE' is not provided");
    process.exit(1);
}
if (!DB_USER) {
    console.log("Required environment variable 'DB_USER' is not provided");
    process.exit(1);
}
if (!DB_PORT_VALUE || isNaN(parseInt(DB_PORT_VALUE))) {
    console.log("Required environment variable 'DB_PORT' is not provided");
    process.exit(1);
}
const DB_PORT: number = parseInt(DB_PORT_VALUE);


mysql.createConnection({
    host: DB_HOST,
    database: DB_DATABASE,
    user: DB_USER,
    port: DB_PORT,
    password: DB_PASSWORD
}).then(async (c) => {
    console.log("MySQL connect")
    await setConnection(c);
    console.log("MySQL connect finished");

    console.log("Create table");
    const declaredTables: string[] = await getDeclaredTables();
    for (const table of getTables()) {
        if (declaredTables.includes(table.tableName)) {
            continue;
        }
        await table.events.beforeCreate.emit();
        await declareTable(table);
        await table.events.afterCreate.emit();
    }
    console.log("Create table finished");
});

setBridge(new BridgeImpl());