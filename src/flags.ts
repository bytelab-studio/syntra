import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import {config} from "dotenv";

config();

export const DEBUG: boolean = (process.env["DEBUG"] || "false") == "true"
export const SWAGGER_UI: boolean = (process.env["SWAGGER_UI"] || "false") == "true"
const JWT_SECRET_VALUE: string | undefined = process.env["JWT_SECRET"];
const JWT_REFRESH_VALUE: string | undefined = process.env["JWT_REFRESH_VALUE"];
export const HTTPS_PORT: number = parseInt(process.env["HTTPS_PORT"] || "0");
export const HTTP_PORT: number = parseInt(process.env["HTTP_PORT"] || "0");
export const DB_DRIVER: string = process.env["DB_DRIVER"]!;
export const SWAGGER_TITLE: string = process.env["SWAGGER_TITLE"] || "API";
export const SWAGGER_DESCRIPTION: string = process.env["SWAGGER_DESCRIPTION"] || "";
export const SWAGGER_VERSION: string = process.env["SWAGGER_VERSION"] || "1.0.0";

if (!DB_DRIVER) {
    console.log("Required environment variable 'DB_DRIVER' is not provided");
    process.exit(1);
}
if (!fs.existsSync(path.join(__dirname, "drivers", DB_DRIVER))) {
    console.log(`DB_DRIVER: '${DB_DRIVER}' does not exist`);
    process.exit(1);
}

if (!JWT_SECRET_VALUE) {
    console.log("Required environment variable 'JWT_SECRET' is not provided");
    process.exit(1);
}
export const JWT_SECRET: crypto.KeyObject = crypto.createSecretKey(Buffer.from(JWT_SECRET_VALUE, "utf8"));
export const JWT_REFRESH: number = JWT_REFRESH_VALUE && !isNaN(parseInt(JWT_REFRESH_VALUE)) ? parseInt(JWT_REFRESH_VALUE) : 900; // 15min
export const LOGIN_CERT = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: "spki",
        format: "pem"
    },
    privateKeyEncoding: {
        type: "pkcs8",
        format: "pem"
    }
});
