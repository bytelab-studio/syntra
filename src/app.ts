#!/usr/bin/env node
import * as flags from "./flags";
import {declareCustomRoutes, handleRequest} from "./controller";
import {loadFromMain} from "./loader";
import {generateOAS} from "./openapi";

import * as path from "path";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as crypto from "crypto";

import express from "express";
import {Express, Request, Response} from "express";
import cors from "cors";
import morgan from "morgan";
import * as jwt from "jose";
import {
    getTables,
    Authentication,
    Table,
    ColumnFlags,
    PermissionLevel, SchemaDefinition, Column,
} from "@bytelab.studio/syntra.plugin";


if (flags.DEBUG) {
    console.log()
    console.log("WARNING: Debug is enabled many safety features are disabled.");
    console.log("DON'T USE THIS IN PRODUCTION");
    console.log()
}

const app: Express = express();

app.use(cors());
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));

let httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
let httpsServer: https.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;

if (flags.HTTP_PORT != 0) {
    httpServer = http.createServer(app);
}
if (flags.HTTPS_PORT != 0) {
    const cert: string | undefined = process.env["SSL_CERT"];
    const key: string | undefined = process.env["SSL_KEY"];

    if (!!cert && !!key) {
        const certBuff: Buffer = fs.readFileSync(cert);
        const keyBuff: Buffer = fs.readFileSync(key);

        httpsServer = https.createServer({cert: certBuff, key: keyBuff}, app);
    }
}

loadFromMain().forEach(plugin => {
    console.log(`INFO: Load '${plugin}'`);
    require(plugin)
});
require(path.join(__dirname, "drivers", flags.DB_DRIVER));

if (flags.SWAGGER_UI) {
    app.get("/swagger-ui", async (req: Request, res: Response): Promise<void> =>
        await handleRequest((_, res) => {
            return res.ok(fs.readFileSync(path.join(__dirname, "..", "static", "swagger.html")), "text/html");
        }, req, res)
    );
}


app.get("/swagger.json", async (req: Request, res: Response): Promise<void> =>
    await handleRequest(async (_, res) => {

        return res.ok(generateOAS(), "application/json");
    }, req, res)
);


app.get("/authentication/login/visual", async (req: Request, res: Response): Promise<void> =>
    await handleRequest((_, res) => {
        return res.ok(fs.readFileSync(path.join(__dirname, "..", "static", "login.html")), "text/html");
    }, req, res)
);

app.get("/authentication/change_psw/visual", async (req: Request, res: Response): Promise<void> => {
    await handleRequest((_, res) => {
        return res.ok(fs.readFileSync(path.join(__dirname, "..", "static", "change_psw.html")), "text/html");
    }, req, res)
});

Authentication.routes.get(builder => {
    builder.addResponse(200, "buffer", "application/octet-stream");
}, "/cert", (_, res) => {
    return res.ok(flags.LOGIN_CERT.publicKey, "application/octet-stream");
});


const LOGIN_MODEL = SchemaDefinition.define("login_model", {
    type: "object",
    properties: {
        username: {
            type: "string"
        },
        hash: {
            type: "string"
        }
    },
    required: ["username", "hash"]
});

const LOGIN_RESPONSE = SchemaDefinition.define("login_response", {
    type: "object",
    properties: {
        token: {
            type: "string"
        }
    }
});

Authentication.routes.post(builder => {
    builder.setRequestBody(LOGIN_MODEL)
    builder.addResponse(200, LOGIN_RESPONSE)
}, "/login", async (req, res) => {
    const body: { username?: string, hash?: string } | null = req.body.json();
    if (!body || !body.username || !body.hash) {
        return res.badRequest("Missing properties 'username' or 'hash'");
    }
    let password: string;
    try {
        password = crypto.privateDecrypt({
            key: flags.LOGIN_CERT.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha-256"
        }, Buffer.from(body.hash, "base64")).toString();
    } catch {
        if (!flags.DEBUG) {
            return res.badRequest("Invalid password hash");
        }

        password = body.hash;
    }

    const hash: string = crypto.createHash("sha256").update(password).digest("hex");
    const auth: Authentication | undefined =
        (await Authentication.selectAll<typeof Authentication, Authentication>(Authentication.root))
            .find(auth => auth.username.getValue() == body.username || auth.email.getValue() == body.username)
    if (!auth) {
        return res.unauthorized("User could not be found");
    }
	if (auth.deactivated.getValue()) {
		return res.unauthorized("User is deactivated");
	}
    if (auth.password.getValue() != hash) {
        return res.unauthorized("Password is incorrect");
    }
    const token: string = await new jwt.SignJWT({
        auth_id: auth.primaryKey.getValue()
    })
        .setProtectedHeader({
            alg: "HS512"
        }).setIssuedAt()
        .setExpirationTime("30min")
        .sign(flags.JWT_SECRET);
    return res.ok({
        token: token
    });
});

Authentication.routes.post(builder => {
    builder.addResponse(200, LOGIN_RESPONSE);
}, "/refresh", async (req, res) => {
    if (!req.authorization.auth || !req.headers.token) {
        return res.unauthorized();
    }
    const token: string = req.headers.token;
    const payload: any = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
    if (!("exp" in payload) || typeof payload.exp != "number") {
        return res.unauthorized();
    }

    if (payload.exp + flags.JWT_REFRESH <= Date.now() / 1000) {
        return res.unauthorized();
    }

    delete payload.exp;
    delete payload.iat;

    const refreshedToken: string = await new jwt.SignJWT(payload)
        .setProtectedHeader({
            alg: "HS512"
        })
        .setExpirationTime("30min")
        .sign(flags.JWT_SECRET);

    return res.ok({
        token: refreshedToken
    });
});

const PASSWORD_CHANGE_MODEL: SchemaDefinition = SchemaDefinition.define("password_change_model", {
    type: "object",
    properties: {
        username: {
            type: "string"
        },
        hash: {
            type: "string"
        },
        new_hash: {
            type: "string",
        },
    },
    required: ["username", "hash", "new_hash"]
});

Authentication.routes.post(builder => {
    builder.addResponse(200, LOGIN_RESPONSE);
    builder.setRequestBody(PASSWORD_CHANGE_MODEL);
}, "/change_psw", async (req, res) => {
    const body: { username?: string, hash?: string, new_hash?: string } | null = req.body.json();
    if (!body || !body.username || !body.hash || !body.new_hash) {
        return res.badRequest("Missing properties 'username' or 'hash'");
    }
    let password: string;
    let new_password: string;
    try {
        password = crypto.privateDecrypt({
            key: flags.LOGIN_CERT.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha-256"
        }, Buffer.from(body.hash, "base64")).toString();
        new_password = crypto.privateDecrypt({
            key: flags.LOGIN_CERT.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha-256"
        }, Buffer.from(body.new_hash, "base64")).toString();
    } catch {
        return res.badRequest("Invalid password hash or new_hash is invalid");
    }

    const hash: string = crypto.createHash("sha256").update(password).digest("hex");
    const auth: Authentication | undefined =
        (await Authentication.selectAll<typeof Authentication, Authentication>(Authentication.root))
            .find(auth => auth.username.getValue() == body.username || auth.email.getValue() == body.username)
    if (!auth) {
        return res.unauthorized("User could not be found");
    }
	if (auth.deactivated.getValue()) {
		return res.unauthorized("User is deactivated");
	}
    if (auth.password.getValue() != hash) {
        return res.unauthorized("Password is incorrect");
    }

    auth.password.setValue(crypto.createHash("sha256").update(new_password).digest("hex"));
    await auth.update(Authentication.root);

    const token: string = await new jwt.SignJWT({
        auth_id: auth.primaryKey.getValue()
    })
        .setProtectedHeader({
            alg: "HS512"
        }).setIssuedAt()
        .setExpirationTime("30min")
        .sign(flags.JWT_SECRET);
    return res.ok({
        token: token
    });
});

getTables().forEach(table => {
    app.use(`/${table.tableName}`, declareCustomRoutes(table));

    if (table.routes.enableGetAllRoute) {
        app.get(`/${table.tableName}`, async (req: Request, res: Response): Promise<void> =>
            await handleRequest(async (req, res) => {
                const rows: Table[] = await table.selectAll(req.authorization.auth);
                const objs: object[] = rows.map(row => row.deserialize());
                return res.ok({
                    status: 200,
                    count: objs.length,
                    results: objs
                });
            }, req, res)
        );
    }

    if (table.routes.enableGetSingleRoute) {
        app.get(`/${table.tableName}/:id`, async (req: Request, res: Response): Promise<void> =>
            await handleRequest(async (req, res) => {
                const id: number | null = req.params.getInt("id");
                if (!id) {
                    return res.badRequest();
                }
                const row: Table | null = await table.select(req.authorization.auth, id);
                if (!row) {
                    return res.notFound()
                }
                return res.ok({
                    status: 200,
                    count: 1,
                    results: [row.deserialize()]
                });
            }, req, res)
        );
    }

    if (table.routes.enableCreateRoute) {
        app.post(`/${table.tableName}`, async (req: Request, res: Response): Promise<void> =>
            await handleRequest(async (req, res) => {
                if (!req.authorization.auth) {
                    return res.unauthorized();
                }
                const body: Record<string, any> | null = req.body.json();
                if (!body || !("data" in body)) {
                    return res.badRequest();
                }
                const data: Record<string, any> = body.data;
                const row: Table = new table();
                row.serialize(data);
                const errors: string[] = row.validate();
                if (errors.length > 0) {
                    return res.badRequest("Row validation failed:\n" + errors.join("\n"));
                }

                if ("permission" in body) {
                    const readLevel: PermissionLevel | undefined =
                        typeof PermissionLevel[body.permission.read_level] != "undefined"
                            ? body.permission.read_level
                            : undefined;
                    const writeLevel: PermissionLevel | undefined =
                        typeof PermissionLevel[body.permission.write_level] != "undefined"
                            ? body.permission.write_level
                            : undefined;
                    const deleteLevel: PermissionLevel | undefined =
                        typeof PermissionLevel[body.permission.delete_level] != "undefined"
                            ? body.permission.delete_level
                            : undefined;

                    await row.insert(
                        req.authorization.auth,
                        readLevel,
                        writeLevel,
                        deleteLevel);
                } else {
                    await row.insert(req.authorization.auth);
                }
                await row.resolve(req.authorization.auth);
                return res.ok({
                    status: 200,
                    count: 1,
                    results: [row.deserialize()]
                });
            }, req, res)
        );
    }

    if (table.routes.enableUpdateRoute) {
        app.put(`/${table.tableName}`, async (req: Request, res: Response): Promise<void> =>
            await handleRequest(async (req, res) => {
                const id: number | null = req.params.getInt("id");
                if (!id) {
                    return res.badRequest();
                }
                const body: Record<string, any> | null = req.body.json();
                if (!body) {
                    return res.badRequest();
                }
                const row: Table | null = await table.select(req.authorization.auth, id);
                if (!row) {
                    return res.notFound();
                }
                for (let column of row.getColumns()) {
                    if (!(column instanceof Column)) {
                        continue;
                    }

                    if (column.containsFlag(ColumnFlags.READONLY)) {
                        continue;
                    }
                    const value: any | undefined = body[column.getColumnName()];
                    if (typeof value == "undefined") {
                        continue;
                    }
                    column.setValue(column.getColumnType().import(value));
                }
                const errors: string[] = row.validate();
                if (errors.length > 0) {
                    return res.badRequest("Row validation failed: " + errors.join("; "));
                }
                await row.update(req.authorization.auth);
                return res.ok({
                    status: 200,
                    count: 1,
                    results: [row.deserialize()]
                });
            }, req, res)
        );
    }

    if (table.routes.enableDeleteRoute) {
        app.delete(`/${table.tableName}`, async (req: Request, res: Response): Promise<void> =>
            await handleRequest(async (req, res) => {
                const id: number | null = req.params.getInt("id");
                if (!id) {
                    return res.badRequest();
                }
                const row: Table | null = await table.select(req.authorization.auth, id);
                if (!row) {
                    return res.notFound();
                }
                await row.delete(req.authorization.auth);
                return res.ok({
                    status: 200
                });
            }, req, res)
        );
    }
});

app.all("*", (req, res) =>
    handleRequest((_, res) => {
        return res.notFound();
    }, req, res)
);

if (!!httpServer) {
    httpServer.listen(flags.HTTP_PORT);
}
if (!!httpsServer && !flags.DEBUG) {
    httpsServer.listen(flags.HTTPS_PORT);
}
