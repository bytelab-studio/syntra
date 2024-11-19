# Event bus

Syntra allows you to register events on tables, which are triggered at specific lifecycle points. These events enable
you to execute custom logic during table operations.

## Available Events

The following events can be registered for a table:

- `beforeCreate`: Triggered before a new row is created.
- `afterCreate`: Triggered after a new row is created.
- `beforeSelect`: Triggered before a row is selected.
- `afterSelect`: Triggered after a row is selected.
- `beforeInsert`: Triggered before a row is inserted into the database.
- `afterInsert`: Triggered after a row is inserted into the database.
- `beforeUpdate`: Triggered before a row is updated.
- `afterUpdate`: Triggered after a row is updated.
- `beforeDelete`: Triggered before a row is deleted.
- `afterDelete`: Triggered after a row is deleted.

An event can be easily defined by the event manager.

## Defining Events

Events can be registered using the table’s event manager. You can define events to execute every time the event is
triggered or only once.

```typescript
import {Table, table, Column, VarChar} from "@bytelab.studio/syntra-plugin";

@table()
class Book extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
}

// Executes every time
Book.events.afterCreate.on(() => console.log("Table was created"));
// Executes only once after the server starts
Book.events.afterDelete.once(() => console.log("Row was deleted"));
```

## Important Notes
- Registration Requirement: Events can only be added after the table has been registered.
- Use the `.on()` method for recurring actions and the .`once()` method for one-time actions.
- Events provide a powerful way to hook into table operations and extend functionality.