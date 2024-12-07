import {
    Column,
    ColumnFlags,
    IJoinable,
    PrimaryColumn,
    Relation1T1,
    Relation1TN,
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
        if (!(column instanceof Column)) {
            continue;
        }
        if (ignoreNames.includes(column.getColumnName())) {
            continue;
        }

        items.push(construct_column_creation(column));
    }
    for (const column of table.getColumns()) {
        if (!(column instanceof Column)) {
            continue;
        }
        if (ignoreNames.includes(column.getColumnName())) {
            continue;
        }

        if (column.containsFlag(ColumnFlags.UNIQUE)) {
            items.push(`UNIQUE (\`${column.getColumnName()}\`)`);
        } else if (column instanceof PrimaryColumn) {
            items.push(`PRIMARY KEY (\`${column.getColumnName()}\`)`);
        } else if (column instanceof Relation1T1) {
            items.push(`FOREIGN KEY (\`${column.getColumnName()}\`) REFERENCES \`${column.refTable.tableName}\`(\`${column.refTable.tableName + "_id"}\`)`);
        }
    }

    return `CREATE TABLE IF NOT EXISTS \`${table.tableName}\` (${items.join(",")}) ENGINE = InnoDB`;
}

function construct_table_join(relation: IJoinable<Table>, outerName: string, count: [number]): string {
    const innerJoins: string[] = [];
    const refTable: Table = new relation.refTable();
    const useName: string = `J${count}`;

    for (const innerRelation of refTable.get1T1Relations()) {
        if (innerRelation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        count[0]++;
        innerJoins.push(construct_table_join(innerRelation, useName, count));
    }

    return `JOIN \`${relation.refTable.tableName}\` AS \`${useName}\` ON \`${outerName}\`.\`${relation.getColumnName()}\` = \`${useName}\`.\`${relation.refTable.tableName + "_id"}\` ${innerJoins.join(" ")}`;
}

export function construct_select_single<T extends TableRef<K>, K extends Table>(template: T): string {
    const table: Table = new template();

    const joins: string[] = [];
    let count: [number] = [0];
    for (const relation of table.get1T1Relations()) {
        if (relation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        count[0]++;
        joins.push(construct_table_join(relation, table.tableName, count));
    }
    return `SELECT * FROM \`${table.tableName}\` ${joins.join(" ")} WHERE \`${table.tableName}\`.\`${table.primaryKey.getColumnName()}\` = ?`;
}

export function construct_select_all<T extends TableRef<K>, K extends Table>(template: T): string {
    const table: Table = new template();
    const joins: string[] = [];

    let count: [number] = [0];
    for (const relation of table.get1T1Relations()) {
        if (relation.loadingMethod != RelationLoad.DIRECT) {
            continue;
        }

        count[0]++;
        joins.push(construct_table_join(relation, table.tableName, count));
    }

    return `SELECT * FROM \`${table.tableName}\` ${joins.join(" ")}`;
}

export function construct_insert_single<K extends Table>(table: K): string {
    const names: string[] = [];

    for (const column of table.getColumns()) {
        if (column instanceof Relation1TN) {
            continue;
        }
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

export function construct_1_to_n(relation: Relation1TN<Table>): string {
    return construct_select_all(relation.refTable) + ` WHERE \`${relation.refTable.tableName}\`.\`${relation.refColumn.getColumnName()}\` = ?`;
}

export function construct_delete<K extends Table>(table: K): string {
    return `DELETE FROM \`${table.tableName}\` WHERE \`${table.primaryKey.getColumnName()}\` = ?`;
}