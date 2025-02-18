const PORT: string = process.env.HTTP_PORT ?? "8080";
export let BASE_URL = `http://127.0.0.1:${PORT}`;

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
        throw new Error(`HTTP error! Status: ${response.status} ${await response.text()}`, {
            cause: response.status
        });
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