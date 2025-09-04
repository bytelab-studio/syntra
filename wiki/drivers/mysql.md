# MySQL Driver

The MySQL driver uses the [mysql2](https://www.npmjs.com/package/mysql2) package to connect to any MySQL compatible server.

## ENV

| Key           | Type   | Description                                         | Required |
|---------------|--------|-----------------------------------------------------|----------|
| DB_HOST       | string | The host where the database server is located       | yes      |
| DB_DATABASE   | string | The name of the database to use                     | yes      |
| DB_USER       | string | The database username                               | yes      |
| DB_PASSWORD   | string | The database password                               | no       |
| DB_PORT       | number | The port on which the database server listens       | yes      |
| DB_POOL_LIMIT | number | The limit of parallel allowed database connections  | no       |
