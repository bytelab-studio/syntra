const PORT: string = "8080";
process.env = {
    ...process.env,
    ...{
        DB_DATABASE: "unittest",
        DB_DRIVER: "mysql",
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_USER: "root",
        DEBUG: "true",

        HTTP_PORT: PORT,
        JWT_SECRET: "1234567890",
        SWAGGER_UI: "true"
    }
}

process.on("uncaughtException", (err) => void 0);

export function importServer(): void {
    require("../../out/app");
}

export let BASE_URL = `http://localhost:${PORT}`;

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
    method: RequestMethod;
    headers?: { [key: string]: string };
    body?: any;
}

async function httpRequest(url: string, options: RequestOptions): Promise<Response> {
    url = BASE_URL + url;
    const {method, headers = {}, body} = options;

    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...headers,
    };

    const response = await fetch(url, {
        method,
        headers: defaultHeaders,
        body: typeof body == "object" && !(body instanceof Blob) ? JSON.stringify(body) : body,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} ${await response.text()}`);
    }
    return response;
}

export const get = (url: string, headers?: { [key: string]: string }): Promise<Response> =>
    httpRequest(url, {method: 'GET', headers});

export const post = (url: string, body: any, headers?: { [key: string]: string }): Promise<Response> =>
    httpRequest(url, {method: 'POST', body, headers});

export const put = (url: string, body: any, headers?: { [key: string]: string }): Promise<Response> =>
    httpRequest(url, {method: 'PUT', body, headers});

export const del = (url: string, headers?: { [key: string]: string }): Promise<Response> =>
    httpRequest(url, {method: 'DELETE', headers});

let _token: string | undefined;

export const getToken = async () => {
    if (!_token) {
        const res = await post("/authentication/login", {
            username: "root",
            hash: "root"
        });
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(typeof data.token).toEqual("string");
        return _token = data.token;
    }
    return _token;
};