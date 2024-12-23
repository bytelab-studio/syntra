import * as crypto from "crypto";

export async function encrypt(rsa: Blob, text: string): Promise<string> {
    const cert: string = await rsa.text();
    return crypto.publicEncrypt({
        key: cert,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
    }, text).toString("base64");
}