import {get, post, getToken} from "./utils/http";
import {encrypt} from "./utils/encryption";

jest.setTimeout(60000);

describe("Server", () => {
    test('online', async () => {
        const res = await get("/swagger.json");
        const data = await res.json();
        expect(data).toBeTruthy();
    });


    test("authentication (DEBUG)", async () => {
        const res = await post("/authentication/login/", {
            username: "root",
            hash: "root"
        });
        const data: any = await res.json();
        expect(data).toHaveProperty("token");
        expect(typeof data.token).toEqual("string");
        expect(data.token.length).toBeGreaterThan(0);
    });
    test("cert", async () => {
        const res = await get("/authentication/cert");
        const data = await res.blob();
        expect(data).toBeTruthy();
        expect(data).toBeInstanceOf(Blob);
    });
    test("authentication", async () => {
        let res = await get("/authentication/cert");
        const cert = await res.blob();

        expect(cert).toBeTruthy();
        expect(cert).toBeInstanceOf(Blob);

        const hash: string = await encrypt(cert, "root");
        res = await post("/authentication/login", {
            username: "root",
            hash: hash
        });
        const data: any = await res.json();

        expect(data).toHaveProperty("token");
        expect(typeof data.token).toEqual("string");
        expect(data.token.length).toBeGreaterThan(0);
    });
    test("authentication with wrong password", async () => {
        await expect((async (): Promise<void> => {
            let res = await get("/authentication/cert");
            const cert = await res.blob();

            expect(cert).toBeTruthy();
            expect(cert).toBeInstanceOf(Blob);

            const hash: string = await encrypt(cert, "definitely wrong password");
            await post("/authentication/login", {
                username: "root",
                hash: hash
            });
        })()).rejects.toMatchObject({
            cause: 401,
        });
    });
    test("authentication with wrong username", async () => {
        await expect((async (): Promise<void> => {
            const res = await post("/authentication/login/", {
                username: "root2",
                hash: "root"
            });
            const data: any = await res.json();
            expect(data).toHaveProperty("token");
            expect(typeof data.token).toEqual("string");
            expect(data.token.length).toBeGreaterThan(0);
        })()).rejects.toMatchObject({
            cause: 401,
        });
    });
});

// describe("resources", () => {
//     test("resource", async () => {
//         const content: string = "Some resources content";
//         const token: string = await getToken();
//         let res = await post("/resource?mime=plain/text", new Blob([content]), {
//             "Authorization": `Bearer ${token}`
//         });
//         const data: any = await res.json();
//         expect(data).toHaveProperty("results");
//         expect(Array.isArray(data.results)).toBeTruthy();
//         expect(data.results.length).toBeGreaterThan(0);
//         const resource = data.results[0];
//         expect(resource).toHaveProperty("resource_id");
//         expect(typeof resource.resource_id).toEqual("number");
//
//         res = await get(`/resource/${resource.resource_id}`);
//         const text: string = await res.text();
//         expect(text).toEqual(content);
//     });
// });
