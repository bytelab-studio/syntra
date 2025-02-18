import {get, getToken, post} from "./utils/http";

describe("resources", () => {
    test("Create & Read resources", async () => {
        const content: string = "Some resources content";
        const token: string = await getToken();
        let res = await post("/resource?mime=plain/text", new Blob([content]), {
            "Authorization": `Bearer ${token}`
        });
        const data: any = await res.json();
        expect(data).toHaveProperty("results");
        expect(Array.isArray(data.results)).toBeTruthy();
        expect(data.results.length).toBeGreaterThan(0);
        const resource = data.results[0];
        expect(resource).toHaveProperty("resource_id");
        expect(typeof resource.resource_id).toEqual("number");

        res = await get(`/resource/${resource.resource_id}`, {
            "Authorization": `Bearer ${token}`
        });
        const text: string = await res.text();
        expect(text).toEqual(content);
    });
});
