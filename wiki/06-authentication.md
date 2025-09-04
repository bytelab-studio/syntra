# Authentication

This section explains how to authenticate against your Syntra server, which is necessary to establish a connection between the client and the server.

## Process (DEBUG)

In debug mode, authentication can be done through a single request to the server.

```http
POST /authentication/login

{
  "username": "<username>",
  "password": "<raw password>"
}
```
In this method, you send a single POST request containing your credentials to the server. The password is passed in plain text in the request body. Note: This approach should only be used in debug mode and should never be used in production, as the password is transmitted without encryption.

## Process (Production)

In production mode, the authentication process involves multiple steps to ensure security:
1. Download the public RSA key from the server
2. Encrypt the password using the public RSA key.
3. Send the user credentials to the server

The RSA key pair is regenerated every time the server restarts.

### Example

Below is an example of how to authenticate in production mode using JavaScript and the native fetch API.

#### Step 1: Define some constants

```javascript
const SERVER_URL = "http://localhost:3000";

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}
```

#### Step 2: Download the public RSA key from the server
```javascript
async function downloadRSAKey() {
  const res = await fetch(SERVER_URL + "/authentication/cert");
  return (await res.text()).trim();
}
```

#### Step 3: Import the public RSA key
```javascript
async function importRSAKey(pem) {
  return await window.crypto.subtle.importKey(
    "spki",
    formatPEM(pem),
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    true,
    ["encrypt"]
  );
}

function formatPEM(pem) {
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const emContents = pem.substring(pemHeader.length, pem.length - pemFooter.length);
  const binaryDerString = window.atob(pemContents);
  return str2ab(binaryDerString);
}
```

#### Step 4: Encryption
```javascript
async function encrypt(key, value) {
  return await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    key,
    value
  );
}
```

#### Step 5: Authenticate
```javascript
async function login(username, password) {
  const pemKey = await downloadRSAKey();
  const key = await await importRSAKey(pemKey);
  const encrypted = btoa(ab2str(await encrypt(key, password)));

  const res = await fetch(SERVER_URL + "/authentication/login", {
    method: "POST",
    body: JSON.stringify({
      username: username,
      hash: encrypted
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });

  return await res.json();
}
```
