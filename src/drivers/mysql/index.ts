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

function map_row_to_object<T extends TableRef<K>, K extends Table>(row: mysql.RowDataPacket, table: T, outerName: string, isTopLevel: boolean): K {
    const result: K = new table() as K;
    const tableData: Map<string, any> = map_row_to_map(row[outerName]);
    let counter: number = 1;

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
                column.setValue(map_row_to_object(row, column.refTable, isTopLevel ? `J${counter++}` : `${outerName}${counter++}`, false));
            } else {
                counter++;
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
    const connection: mysql.PoolConnection = await pool.getConnection();
    const query: string = dbhelper.construct_1_to_n(relation);
    const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
        sql: query,
        values: [row.primaryKey.getValue()],
        nestTables: true
    });
    connection.release();
    relation.setValue(await Promise.all(rows.map(async rowData => {
        const row: Table = map_row_to_object(rowData, relation.refTable, relation.refTable.tableName, true);

        for (const relation of row.get1TNRelations()) {
            await post_process_row(row, relation);
        }

        return row;
    })));
}

class BridgeImpl implements Bridge {
    async selectSingle<T extends TableRef<K>, K extends Table>(table: T, id: number): Promise<K | null> {
        const connection: mysql.PoolConnection = await pool.getConnection();
        const query: string = dbhelper.construct_select_single(table);
        const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
            sql: query,
            values: [id],
            nestTables: true
        });
        connection.release();

        if (rows.length == 0) {
            return null;
        }

        const row: K = map_row_to_object<T, K>(rows[0], table, table.tableName, true);

        for (const relation of row.get1TNRelations()) {
            await post_process_row(row, relation);
        }
        return row;
    }

    async selectAll<T extends TableRef<K>, K extends Table>(table: T): Promise<K[]> {
        const connection: mysql.PoolConnection = await pool.getConnection();
        const query: string = dbhelper.construct_select_all(table);
        const [rows]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query<mysql.RowDataPacket[]>({
            sql: query,
            values: [],
            nestTables: true
        });
        connection.release();

        return Promise.all(rows.map(async rowData => {
            const row: K = map_row_to_object<T, K>(rowData, table, table.tableName, true);

            for (const relation of row.get1TNRelations()) {
                await post_process_row(row, relation);
            }

            return row;
        }));
    }

    async update<K extends Table>(item: K): Promise<void> {
        const connection: mysql.PoolConnection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const query: string = dbhelper.construct_update(item);
            const values: any[] = [...Array.from(item.getColumns()).filter(i => i != item.primaryKey && i != item.permission).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.getValue()), item.primaryKey.getValue()];
            await connection.query({
                sql: query,
                values: values
            });
            await connection.commit();
            connection.release();
            for (const relation of item.get1TNRelations()) {
                await post_process_row(item, relation);
            }
        } catch (e) {
            console.log(`Cannot update '${item.tableName}': ${e}`);
            await connection.rollback();
            connection.release();
        }
    }

    async insert<K extends Table>(item: K, permission: Permission): Promise<void> {
        const connection: mysql.PoolConnection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            {
                const query: string = dbhelper.construct_insert_single(permission);
                const values: any[] = (Array.from(permission.getColumns()).filter(i => i instanceof Column || i instanceof Relation1T1) as (Column<unknown> | Relation1T1<Table>)[]).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.containsFlag(ColumnFlags.AUTO_INCREMENT) && i.isNull() ? null : i.getValue());
                const [insertResult]: [mysql.ResultSetHeader, mysql.FieldPacket[]] = await connection.query({
                    sql: query,
                    values: values
                });
                if (permission.primaryKey.isNull()) {
                    permission.primaryKey.setValue(insertResult.insertId);
                }
            }
            item.permission.setValue(permission);
            {
                const query: string = dbhelper.construct_insert_single(item);
                const values: any[] = (Array.from(item.getColumns()).filter(i => i instanceof Column || i instanceof Relation1T1) as (Column<unknown> | Relation1T1<Table>)[]).map(i => i instanceof Relation1T1 ? i.getKeyValue() : i.containsFlag(ColumnFlags.AUTO_INCREMENT) && i.isNull() ? null : i.getValue());
                const [insertResult]: [mysql.ResultSetHeader, mysql.FieldPacket[]] = await connection.query({
                    sql: query,
                    values: values
                });
                if (item.primaryKey.isNull()) {
                    item.primaryKey.setValue(insertResult.insertId);
                }
            }
            await connection.commit();
            connection.release();

            for (const relation of item.get1TNRelations()) {
                await post_process_row(item, relation);
            }
        } catch (e) {
            console.log(`Cannot insert into '${item.tableName}': ${e}`);
            await connection.rollback();
            connection.release();
        }
    }

    async delete<K extends Table>(item: K): Promise<void> {
        const connection: mysql.PoolConnection = await pool.getConnection();
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
            connection.release();
        } catch (e) {
            console.log(`Cannot delete '${item.tableName}': ${e}`);
            await connection.rollback();
            connection.release();
        }
    }

    async rowExist<K extends Table>(item: K): Promise<boolean> {
        const connection: mysql.PoolConnection = await pool.getConnection();
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
            connection.release();
            return rows.length > 0 && rows[0]["x"] == 1;
        } catch (e) {
            await connection.rollback();
            connection.release();
            console.log(`Cannot select '${item.tableName}': ${e}`);
            throw `Cannot select '${item.tableName}': ${e}`;
        }
    }
}

let pool: mysql.Pool;

async function setPool(p: mysql.Pool): Promise<void> {
    pool = p;
}

export async function declareTable<T extends TableRef<K>, K extends Table>(table: T): Promise<void> {
    const query: string = dbhelper.construct_table_creation(table);
    const connection: mysql.PoolConnection = await pool.getConnection();
    try {
        console.log(`Declare table ${table.tableName}`);
        await connection.beginTransaction();
        await connection.query(query);
        await connection.commit();
        connection.release();
    } catch (e) {
        console.log(`Cannot create table '${table.tableName}': ${e}`);
        await connection.rollback();
        connection.release();
    }
}

export async function getDeclaredTables(): Promise<string[]> {
    const database: string = DB_DATABASE!
    const connection: mysql.PoolConnection = await pool.getConnection();
    const [rows, _]: [mysql.RowDataPacket[], mysql.FieldPacket[]] = await connection.query("SELECT table_name, auto_increment FROM information_schema.tables WHERE table_schema = ?", [database]);
    connection.release();
    return rows.map(r => r["table_name"]);
}

const DB_HOST: string | undefined = process.env["DB_HOST"];
const DB_DATABASE: string | undefined = process.env["DB_DATABASE"];
const DB_USER: string | undefined = process.env["DB_USER"];
const DB_PASSWORD: string | undefined = process.env["DB_PASSWORD"] || "";
const DB_PORT_VALUE: string | undefined = process.env["DB_PORT"];
const DB_POOL_LIMIT_VALUE: string | undefined = process.env["DB_POOL_LIMIT"] || "10";

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
    console.log("Environment variable 'DB_PORT' is not provided or is not an integer");
    process.exit(1);
}
if (isNaN(parseInt(DB_POOL_LIMIT_VALUE))) {
    console.log("Environment variable 'DB_POOL_LIMIT' is not provided or is not an integer");
    process.exit(1);
}
const DB_PORT: number = parseInt(DB_PORT_VALUE);
const DB_POOL_LIMIT: number = parseInt(DB_POOL_LIMIT_VALUE);

(async () => {
    console.log("MySQL connect")
    await setPool(mysql.createPool({
        host: DB_HOST,
        database: DB_DATABASE,
        user: DB_USER,
        port: DB_PORT,
        password: DB_PASSWORD,
        connectionLimit: DB_POOL_LIMIT
    }));
    console.log("MySQL connect finished");
    setBridge(new BridgeImpl());

    console.log("Create table");
    const declaredTables: string[] = await getDeclaredTables();
    for (const table of getTables()) {
        if (declaredTables.includes(table.fullTableName)) {
            continue;
        }
        await table.events.beforeCreate.emit();
        await declareTable(table);
        await table.events.afterCreate.emit();
    }
    console.log("Create table finished");
})();
