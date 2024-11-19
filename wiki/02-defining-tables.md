# Defining Tables

## Basic Tables

In Syntra, each table is defined using a TypeScript class. Here’s a simple example:

```typescript
import {Table} from "@bytelab.studio/syntra-plugin";

class MyTable extends Table {
    public constructor() {
        super();
    }
}
```

This defines an empty table named `my_table` with only a **primary key** and a **permission reference** column.


> Note: You don’t need to explicitly define the table name as `my_table`; it's automatically derived from the class
> name.
> The same behavior applies to columns and relations.

However, simply defining the class won’t create the table in the database. The table must be registered for it to be
recognized.

## Register Table

There are two methods to register tables in Syntra: using decorators (recommended) or function calls (not recommended).

### Using Decorators (Recommended)

The recommended approach is to wrap your table class with a decorator. Note that to use decorators, you must enable the
`experimentalDecorators` flag in your`tsconfig.json`.

Example:

```typescript
import {Table, table} from "@bytelab.studio/syntra-plugin";

@table()
class MyTable extends Table {
    public constructor() {
        super();
    }
}
```

This automatically registers the table, making it available in the database.

### Using Function Calls (Not Recommended)

Alternatively, you can register the table using a function call. However, this approach is less preferred:

```typescript
import {Table} from "@bytelab.studio/syntra-plugin";

class MyTable extends Table {
    public constructor() {
        super();
    }
}

Table.registerTable(MyTable);
```

While this method works, it's generally less clean and more prone to errors compared to using decorators. The advantages
of using decorators may not be immediately visible, but they become much clearer when working with more advanced
systems.

### Standard Permission Levels

Each table in Syntra has default permission levels for the operations `read`, `write`, and `delete`. These permissions
are set
during the table's construction and apply to all rows by default.

If no specific permissions are defined for a row, the default levels are used. By default, all permissions are set to
USER.

Example:

```typescript
import {Table, PermissionLevel} from "@bytelab.studio/syntra-plugin";

class MyTable extends Table {
    public constructor() {
        super(PermissionLevel.ALL, PermissionLevel.AUTH, PermissionLevel.USER);
    }
}

Table.registerTable(MyTable);
```

In this example:

- Read: Everyone can read the row.
- Write: Only authenticated requests can modify the row.
- Delete: Only the owner of the row can delete it.

> Note: These default levels apply when a row is created without explicitly setting custom permissions.

## Columns

To define columns in a Syntra table, use the Column class:

```text
public Column<ColumnType>(SQLType, ColumnFlags?, string?): Column
```

| Parameter       | Description                                                          | Required |
|-----------------|----------------------------------------------------------------------|----------|
| &lt;ColumnType> | The TypeScript type, such as string or number                        | yes      |
| SQLType         | The SQL data type of the column                                      | yes      |
| ColumnFlags     | Optional flags like NULLABLE or PRIVATE                              | no       |
| string          | Override for the column name if the property name should not be used | no       |

### Example: Defining Columns

Below is an example of how to define columns using the Column class:

```typescript
import {Table, table, Column, SQLType} from "@bytelab.studio/syntra-plugin";

@table()
class MyTable extends Table {
    public constructor() {
        super();
    }

    public x: Column<number> = new Column(SQLType.INT);
    public y: Column<number> = new Column(SQLType.INT);
}
```

### SQLTypes

| Class   | SQL Type  | TypeScript Type | Constructor       |
|---------|-----------|-----------------|-------------------|
| SQLType | TINYINT   | number          | SQLType.TINYINT   |
| SQLType | SMALLINT  | number          | SQLType.SMALLINT  |
| SQLType | MEDIUMINT | number          | SQLType.MEDIUMINT |
| SQLType | INT       | number          | SQLType.INT       |
| SQLType | BIGINT    | number          | SQLType.BIGINT    |
| SQLType | FLOAT     | number          | SQLType.FLOAT     |
| SQLType | DOUBLE    | number          | SQLType.DOUBLE    |
| VarChar | VARCHAR   | string          | new VarChar(size) |
| SQLType | DATE      | Date            | SQLType.DATE      |
| SQLType | TIME      | Date            | SQLType.TIME      |
| SQLType | DATETIME  | Date            | SQLType.DATETIME  |

### ColumnFlags

| Flag           | Description                                       |
|----------------|---------------------------------------------------|
| NULLABLE       | Value can be null                                 |
| AUTO_INCREMENT | Value is automatically incremented                |
| UNIQUE         | Value must be unique                              |
| READONLY       | Value cannot be changed in the API after creation |
| PRIVATE        | Value will not be exposed in the API              |

## Relations

### 1:1 Relation

A 1:1 relation between tables can be created using the `Relation1T1` class:

```text
Relation1T1<Table>(TableRef, ColumnFlags?, RelationLoad?, string?, string?): Relation1T1
```

| Parameter       | Description                                                                                        | Required |
|-----------------|----------------------------------------------------------------------------------------------------|----------|
| &lt;Table>      | The table definition                                                                               | yes      |
| TableRef        | A reference to the related table                                                                   | yes      |
| ColumnFlags     | Optional flags like NULLABLE or PRIVATE                                                            | no       |
| string (ID)     | Override for the column ID if the target table's primary key name should not be used               | no       |
| string (Column) | Override for the column name if the property name for storing the target object should not be used | no       |

Example:

```typescript
import {Table, table, Column, SQLType, VarChar, Relation1T1} from "@bytelab.studio/syntra-plugin";

@table()
class Author extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
}

@table()
class Book extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
    public author: Relation1T1<Author> = new Relation1T1(Author);
}
```

> Note: Syntra does not automatically check for circular references. If you create a reference loop, it may lead to
> unexpected behavior.

### 1:N Relation

A 1:N relation between tables can be created using the `Relation1TN` class:

```text
Relation1TN<Table>(TableRef, (row: Table) => Column<number>, ColumnFlags?, RelationLoad?, string?): Relation1T1
```

| Parameter                      | Description                                                                                         | Required |
|--------------------------------|-----------------------------------------------------------------------------------------------------|----------|
| &lt;Table>                     | The table definition                                                                                | yes      |
| TableRef                       | A reference to the related table                                                                    | yes      |
| (row: Table) => Column<number> | A callback function that returns the target column for the relation                                 | yes      |
| ColumnFlags                    | Optional flags like NULLABLE or PRIVATE                                                             | no       |
| string                         | Override for the column name if the property name for storing the target objects should not be used | no       |

Example:

```typescript
import {Table, table, Column, SQLType, VarChar, Relation1T1, Relation1TN} from "@bytelab.studio/syntra-plugin";

@table()
class Author extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
}

@table()
class Book extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
    public author: Relation1T1<Author> = new Relation1T1(Author);
}

@table()
class Shelf extends Table {
    public constructor() {
        super();
    }

    public books: Relation1TN<Book> = new Relation1TN(Book, (book) => book.primaryKey);
}
```