import * as flags from "./flags";

import {
    Table,
    TableRef,
    Request,
    Response,
    BodyHandler,
    ContentType,
    ResponseContent,
    Authentication,
    AuthorizationHandler,
    ParamsHandler, HeaderHandler
} from "@bytelab.studio/syntra.plugin";

import * as express from "express";
import * as jwt from "jose";

async function ensureSync<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? await value : value;
}

function getRawBody(req: express.Request): Promise<Buffer | null> {
    return new Promise(resolve => {
        let rawData = Buffer.alloc(0);

        req.on("data", chunk => {
            rawData = Buffer.concat([rawData, chunk]);
        });
        req.on("end", () => {
            resolve(rawData);
        });
        req.on("error", () => {
            resolve(null);
        });
    });
}

async function constructRequest(req: express.Request): Promise<Request> {
    let body: BodyHandler;
    let buffer: Buffer | null = await getRawBody(req);
    if (!!buffer) {
        const contentType: ContentType = req.headers["content-type"] as ContentType || "application/octet-stream";
        body = new BodyHandler(buffer, contentType);
    } else {
        body = new BodyHandler(Buffer.from([]), "application/octet-stream");
    }

    let authorization: AuthorizationHandler;

    if (req.headers.authorization?.startsWith("Bearer ")) {
        try {
            const token: string = req.headers.authorization.slice(7);
            const {payload} = await jwt.jwtVerify(token, flags.JWT_SECRET);
            const auth = new Authentication();
            auth.primaryKey.setValue(payload["auth_id"] as number);
            authorization = new AuthorizationHandler(auth, false);
        } catch {
            authorization = new AuthorizationHandler(undefined, true);
        }
    } else {
        authorization = new AuthorizationHandler(undefined, !!req.headers.authorization);
    }

    let headers: HeaderHandler = new HeaderHandler(Object.entries(req.headers).reduce((a, [name, value]) => {
        a[name.toLowerCase()] = value;
        return a;
    }, {} as any));

    return {
        body,
        authorization,
        headers: headers,
        params: new ParamsHandler(req.query)
    }
}

export async function handleRequest(route: (req: Request, res: Response) => Promise<ResponseContent> | ResponseContent, req: express.Request, res: express.Response): Promise<void> {
    const request: Request = await constructRequest(req);
    const response: Response = new Response();
    let content: ResponseContent;
    if (request.authorization.faulty) {
        content = response.unauthorized();
    } else {
        content = await ensureSync(route(request, response));
    }
    res
        .status(content.status)
        .setHeader("Content-Type", content.contentType)
        .send(content.data)
        .end();
}

export function declareCustomRoutes(table: TableRef<Table>): express.Router {
    const router: express.Router = express.Router();

    table.routes.forEach(route => {
        switch (route.method) {
            case "GET":
                router.get(route.route, async (req: express.Request, res: express.Response): Promise<void> => {
                    await handleRequest(route.cb, req, res);
                });
                break;
            case "POST":
                router.post(route.route, async (req: express.Request, res: express.Response): Promise<void> => {
                    await handleRequest(route.cb, req, res);
                });
                break;
            case "PUT":
                router.put(route.route, async (req: express.Request, res: express.Response): Promise<void> => {
                    await handleRequest(route.cb, req, res);
                });
                break;
            case "DELETE":
                router.delete(route.route, async (req: express.Request, res: express.Response): Promise<void> => {
                    await handleRequest(route.cb, req, res);
                });
                break;
            case "ALL":
                router.all(route.route, async (req: express.Request, res: express.Response): Promise<void> => {
                    await handleRequest(route.cb, req, res);
                });
                break;
        }
    });

    return router;
}