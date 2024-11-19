# Syntra

A Modular RESTful API Server

## Short Overview

**Syntra** is a modular RESTful API server designed to bring a structured approach to building APIs. It includes:
- Built-in **Swagger** documentation
- Automatically generated **CRUD** operations
- Built-in **security** mechanisms
- **JWT authentication** for secure access
- Extensible architecture through **plugins**

## Why Choose Syntra?

Syntra offers a robust set of features, but it is essential to understand how it differs from other solutions, such as traditional ORM systems.

### Key Differences

At first glance, Syntra might resemble an ORM, but it has a fundamentally different approach:
```typescript

const row1: Book = Book.select(1);
const row2: Book = Book.select(1);

row1.title.setValue("Changed Title");

console.log(row1.title.getValue()); // Changed Title
console.log(row2.title.getValue()); // Title
```

In Syntra, objects are **not references to each other**, even when selecting the same row multiple times.

### Strict Ruleset

Unlike traditional ORMs, Syntra enforces a strict set of rules:

- **Primary keys** are always big integers (`bigint`).
- Only **JSON-serializable datatypes** are allowed.


## Dokumentation

For detailed information on installation and configuration, please refer to the [WIki](./wiki/README.md)

## Contribution

Contributions are welcome! If you'd like to help improve Syntra, feel free to submit a pull request or open an issue.
Whether it's bug fixes, new features, or documentation improvements, all contributions are appreciated.
