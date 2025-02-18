import {get, post, del, getToken} from "./utils/http";
import {put} from "./utils/http";

describe("CRUD", () => {
    test("write", async () => {
        const token = await getToken();

        const res = await post("/crudtester", {
            data: {
                number: 123
            }
        }, {
            "Authorization": `Bearer ${token}`
        });
        const data = await res.json();
        expect(typeof data).toEqual("object");
        expect(data).toHaveProperty("results");
        expect(data.results.length).toBeGreaterThan(0);
        const row = data.results[0];
        expect(typeof row).toEqual("object");
        expect(row).toHaveProperty("number");
        expect(row.number).toEqual(123);
    });

    test("read", async () => {
        const token = await getToken();
        let id: number;
        {
            const res = await get("/crudtester", {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("results");
            expect(data.results.length).toBeGreaterThan(0);
            const row = data.results[0];
            expect(typeof row).toEqual("object");
            expect(row).toHaveProperty("crudtester_id");
            expect(typeof row.crudtester_id).toEqual("number");
            id = row.crudtester_id;
        }
        {
            const res = await get(`/crudtester/${id}`, {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("results");
            expect(data.results.length).toBeGreaterThan(0);
            const row = data.results[0];
            expect(typeof row).toEqual("object");
            expect(row).toHaveProperty("crudtester_id");
            expect(typeof row.crudtester_id).toEqual("number");
            expect(row.crudtester_id).toEqual(id);
        }
    });

    test("update", async () => {
        const token = await getToken();
        let id: number;
        {
            const res = await get("/crudtester", {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("results");
            expect(data.results.length).toBeGreaterThan(0);
            const row = data.results[0];
            expect(typeof row).toEqual("object");
            expect(row).toHaveProperty("crudtester_id");
            expect(typeof row.crudtester_id).toEqual("number");
            id = row.crudtester_id;
        }
        {
            const res = await put(`/crudtester/${id}`,{
                number: 321
            }, {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("status");
            expect(data.status).toEqual(200);
        }
        {
            const res = await get(`/crudtester/${id}`, {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("results");
            expect(data.results.length).toBeGreaterThan(0);
            const row = data.results[0];
            expect(typeof row).toEqual("object");
            expect(row).toHaveProperty("number");
            expect(row.number).toEqual(321);
        }
    });

    test("delete", async () => {
        const token = await getToken();
        let id: number;
        {
            const res = await get("/crudtester", {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("results");
            expect(data.results.length).toBeGreaterThan(0);
            const row = data.results[0];
            expect(typeof row).toEqual("object");
            expect(row).toHaveProperty("crudtester_id");
            expect(typeof row.crudtester_id).toEqual("number");
            id = row.crudtester_id;
        }
        {
            const res = await del(`/crudtester/${id}`, {
                "Authorization": `Bearer ${token}`
            });
            const data = await res.json();
            expect(typeof data).toEqual("object");
            expect(data).toHaveProperty("status");
            expect(data.status).toEqual(200);
        }
    });
});