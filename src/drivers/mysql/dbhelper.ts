import {
    Column,
    ColumnFlags,
    PrimaryColumn,
    Relation,
    RelationLoad,
    Table,
    TableRef
} from "@bytelab.studio/syntra.plugin";

function construct_column_creation(column: Column<unknown>): string {
    const flags: string[] = [];
    if (!column.containsFlag(ColumnFlags.NULLABLE)) {
        flags.push("NOT NULL");
    }
    if (column.containsFlag(ColumnFlags.AUTO_INCREMENT)) {
        flags.push("AUTO_INCREMENT");
    }
    return `\`${column.getColumnName()}\` ${column.getColumnType().sqlName} ${flags.join(" ")}`;
}

export function construct_table_creation<T extends TableRef<K>, K extends Table>(template: T, ignore: Column<unknown>[] = []): string {
    const ignoreNames: string[] = ignore.map(c => c.getColumnName());
    const table: Table = new template();
    const items: string[] = [];
    for (const column of table.getColumns()) {
        if (ignoreNames.includes(column.getColumnName())) {
            continue;
        }

        items.push(construct_column_creation(column));
    }
    for (const column of table.getColumns()) {
        if (ignoreNames.includes(column.getColumnName())) {
            continue;
        }

        if (column.containsFlag(ColumnFlags.UNIQUE)) {
            items.push(`UNIQUE (\`${column.getColumnName()}\`)`);
        } else if (column instanceof PrimaryColumn) {
            items.push(`PRIMARY KEY (\`${column.getColumnName()}\`)`);
        } else if (column instanceof Relation) {
            items.push(`FOREIGN KEY (\`${column.getColumnName()}\`) REFERENCES \`${column.refTable.tableName}\`(\`${column.refTable.tableName + "_id"}\`)`);
        }
    }

    return `CREATE TABLE IF NOT EXISTS \`${table.tableName}\` (${items.join(",")}) ENGINE = InnoDB`;
}

function construct_table_join(table: Table, relation: Relation<TableRef<Table>, Table>, asName: string | undefined = undefined): string {
    const innerJoins: string[] = [];
    const refTable: Table = new relation.refTable();
    for (const innerRelation of refTable.getRelations()) {
        if (innerRelation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        innerJoins.push(construct_table_join(refTable, innerRelation, table.tableName + "_" + relation.getColumnName() + "_" + relation.refTable.tableName));
    }

    const useName: string = table.tableName + "_" + relation.getColumnName() + "_" + relation.refTable.tableName;
    return `JOIN \`${relation.refTable.tableName}\` AS \`${useName}\` ON \`${asName || table.tableName}\`.\`${relation.getColumnName()}\` = \`${useName}\`.\`${relation.refTable.tableName + "_id"}\` ${innerJoins.join(" ")}`;
}

export function construct_select_single<T extends TableRef<K>, K extends Table>(template: T): string {
    const table: Table = new template();

    const joins: string[] = [];
    for (const relation of table.getRelations()) {
        if (relation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        joins.push(construct_table_join(table, relation));
    }

    return `SELECT * FROM \`${table.tableName}\` ${joins.join(" ")} WHERE \`${table.tableName}\`.\`${table.primaryKey.getColumnName()}\` = ?`;
}

export function construct_select_all<T extends TableRef<K>, K extends Table>(template: T): string {
    const table: Table = new template();

    const joins: string[] = [];
    for (const relation of table.getRelations()) {
        if (relation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        joins.push(construct_table_join(table, relation));
    }

    return `SELECT * FROM \`${table.tableName}\` ${joins.join(" ")}`;
}

export function construct_insert_single<K extends Table>(table: K): string {
    const names: string[] = [];

    for (const column of table.getColumns()) {
        names.push(column.getColumnName());
    }

    return `INSERT INTO \`${table.tableName}\` (${names.map(n => `\`${n}\``).join(", ")}) VALUE (${names.map(() => "?").join(", ")})`;
}

export function construct_update<K extends Table>(table: K): string {
    const names: string[] = [];

    for (const column of table.getColumns()) {
        if (column instanceof PrimaryColumn || column == table.permission) {
            continue;
        }
        names.push(column.getColumnName());
    }

    return `UPDATE \`${table.tableName}\`
            SET ${names.map(n => `\`${n}\` = ?`).join(",")}
            WHERE \`${table.primaryKey.getColumnName()}\` = ?;`;
}

export function construct_delete<K extends Table>(table: K): string {
    return `DELETE FROM \`${table.tableName}\` WHERE \`${table.primaryKey.getColumnName()}\` = ?`;
}