# Route Manager

## CRUD Route Manager

By default, all tables in Syntra have a CRUD route manager. These routes handle common CRUD operations (`Create`,
`Read`,
`Update`, `Delete`). However, any of these routes can be disabled through the `Table.routes` properties.

Example:

```typescript
import {Table, table, Column, VarChar} from "@bytelab.studio/syntra-plugin";

@table()
class Book extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
}

// Disabling all CRUD routes
Book.routes.enableGetAllRoute = false;    // Disables the route to fetch all rows
Book.routes.enableGetSingleRoute = false; // Disables the route to fetch a single row by ID
Book.routes.enableCreateRoute = false;    // Disables the route to create new rows
Book.routes.enableUpdateRoute = false;    // Disables the route to update existing rows
Book.routes.enableDeleteRoute = false;    // Disables the route to delete rows
```

**Important**: Routes can only be modified after the table has been registered.

## Custom Routes

In addition to the built-in CRUD routes, custom routes can be added to tables using the `Table.routes` API.

Example:

```typescript
import {Table, table, Column, VarChar} from "@bytelab.studio/syntra-plugin";

@table()
class Book extends Table {
    public constructor() {
        super();
    }

    public name: Column<string> = new Column(new VarChar(100))
}

// Adding a custom route
Book.routes.get(builder => {
        // Define OpenAPI response schema
        builder.addResponse(200, {
            type: "string",
            format: "binary"
        });
    },
    "/my_route", // Define the route path
    async (req, res) => {
        // Route handler
        if (!req.auth) {
            return res.unauthorized();
        }
        const buffer: Buffer = await myAsyncFunction(req.auth);
        // Return a buffer with a specific MIME type
        return res.ok(buffer, "image/png");
    });
```

### Custom Route Details

1. OpenAPI Specification (Optional):
    - Custom routes can define their OpenAPI spec via the builder parameter. This is essential for tools like Swagger-UI
      or Swagger Codegen.
2. Path Parameters:
    - Route paths can include parameters in an Express-like style (e.g., `/foo/:id`).
3. Request and Response Wrappers:
    - The route callback provides wrappers for handling requests and responses easily.

### Available HTTP-Verbs:

- GET
- POST
- PUT
- DELETE

With this flexible system, Syntra empowers developers to extend the default API functionality seamlessly.

