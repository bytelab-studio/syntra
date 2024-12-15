# Getting started

Syntra follows a plugin system, so to develop a Syntra server, you only need to define a plugin.

> In Syntra, a plugin is defined as an npm package with the `@bytelab.studio/syntra-plugin` dependency.

## Basic installation

Follow these steps to get your Syntra server up and running:

### Step 1: Create a New npm Package

First, initialize a new npm package:

```shell
npm init -y
```

### Step 2: Install Required Dependencies

Next, install the Syntra server and plugin packages:

```shell
npm install @bytelab.studio/syntra @bytelab.studio/syntra-plugin
```

### Step 3: (Optional) Add a Start Command

Optionally, you can add a start command to your package.json:

```json lines
// package.json

{
    "name": "my-server",
    "private": true,
    "scripts": {
        "start": "syntra"
    },
}
```

This allows you to start your server using:

```shell
npm start
```

### Step 4: Set Environment Variables

When running Syntra, you can configure the following environment variables:

| Key         | Value             | Description                                                                                        | Required |
|-------------|-------------------|----------------------------------------------------------------------------------------------------|----------|
| DEBUG       | 'true' \| 'false' | Enables debugging mode, which disables security features like HTTPS and an encrypted hash at login | no       |
| HTTP_PORT   | number            | Sets the HTTP port                                                                                 | yes      |
| HTTPS_PORT  | number            | Sets the HTTPS Port                                                                                | no       |
| DB_DRIVER   | 'mysql'           | Specifies the DB Driver                                                                            | yes      |
| JWT_SECRET  | string            | A secret key for signing JWTs (for more information, visit [jwt.io](https://jwt.io))               | yes      |
| JWT_REFRESH | number            | A period of time in seconds during which the token can be refreshed after it expires.              | no       |
| SWAGGER_UI  | 'true' \| 'false' | Enables the Swagger UI                                                                             | no       |

In addition to the general variables, DB driver-specific variables need to be set depending on your database system. For
example, if using MySQL, you might need:

| Key         | Value  | Description                                   | Required |
|-------------|--------|-----------------------------------------------|----------|
| DB_HOST     | string | The host where the database server is located | yes      |
| DB_DATABASE | string | The name of the database to use               | yes      |
| DB_USER     | string | The database username                         | yes      |
| DB_PASSWORD | string | The database password                         | no       |
| DB_PORT     | number | The port on which the database server listens | yes      |

### Step 5: Run Your Server

Now, you can run your Syntra server:

```shell
npm start
```

### Step 6: Change Root Credentials

Syntra comes with a pre-defined administrative account called root. When the Authentication table is created, the root
account is automatically initialized with the following default credentials:

- **Username**: root
- **Email**: root
- **Password**: root

The root account has elevated privileges and can bypass all security and permission layers. For example, it can access
rows with restricted permissions or override ownership-based restrictions.

#### Why Change the Root Password?

The default credentials are a security vulnerability. If they remain unchanged, unauthorized users could gain full
control of your Syntra instance. It is critical to update the root password to a strong and unique value immediately
after setup.

#### How to Change the Root Password?

1. Open your web browser and navigate to the following URL: \
   `http://localhost:<port>/authentication/change_psw/visual` \
   Replace &lt;port> with the port your Syntra instance is running on.
2. Use the provided UI to change the password for the root account:

#### Tips for a Strong Password

- Use at least 12 characters.
- Include a mix of uppercase and lowercase letters, numbers, and symbols.
- Avoid common words, phrases, or easily guessable patterns.

Therefore, the root accounts password should **definitely** be changed to a more secure password.
To achive this open `http:localhost:<port>/authentication/change_psw/visual` in your browser. With this UI you can
change any password of any account.

#### Important Note

- Once the password is changed, ensure it is stored securely (e.g., in a password manager).
- Avoid sharing the root account credentials. For routine operations, create and use non-root accounts with appropriate
  permissions.

## Pre-Defined Tables

After starting Syntra, you'll notice some pre-defined tables in your database that help manage core functionalities:

### 1. Authentication

The Authentication table stores user credentials, holding basic information such as:

- Username
- Email address
- Hashed password
- General permissions (read, write, delete)

This table is essential for managing user access and authentication throughout the system.

### 2. Permission

The Permission table manages access control for rows in all other tables. Each table automatically has a 1:1
relationship with this table. It defines:

- The owner of the row
- Permission levels for reading, writing, and deleting

Each permission level can be defined in three levels:

| Level | Numeric Value | Description                                                     |
|-------|---------------|-----------------------------------------------------------------|
| USER  | 0             | Only the owner of the row can perform the action                |
| AUTH  | 1             | TThe action can only be performed with an authenticated request |
| ALL   | 2             | Anyone can perform the action                                   |

These permission levels provide fine-grained control over data access, ensuring secure and flexible management.

### 3. Resource

The Resource table is designed to handle files, media, and other types of binary data. Managing images or other
resources in a RESTful API can be challenging, so Syntra simplifies this by providing a dedicated Resource table.

Key features include:

- Storage for various types of buffers (e.g., files, images)
- A managed system for accessing resources
- Easy integration into your tables using the ResourceColumn

This setup allows you to efficiently store and retrieve resources without needing to create custom handling logic.