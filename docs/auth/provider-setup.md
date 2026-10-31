# Federated provider setup

This guide walks through obtaining every value needed by the three federated
login providers. Use fake values in documentation; never commit a real client
secret, private key or tenant ID.

## Callback URLs

The API builds callback URLs from `AUTH_CALLBACK_BASE_URL`:

```text
<AUTH_CALLBACK_BASE_URL>/api/auth/microsoft/callback
<AUTH_CALLBACK_BASE_URL>/api/auth/google/callback
<AUTH_CALLBACK_BASE_URL>/api/auth/apple/callback
```

Local development (default when `AUTH_CALLBACK_BASE_URL` is empty):

```text
http://localhost:3000/api/auth/microsoft/callback
http://localhost:3000/api/auth/google/callback
http://localhost:3000/api/auth/apple/callback
```

Production (the public HTTPS origin that fronts the API, including the Vercel
rewrite):

```text
https://app.example.edu/api/auth/microsoft/callback
https://app.example.edu/api/auth/google/callback
https://app.example.edu/api/auth/apple/callback
```

Register exactly these strings at each provider. A trailing slash, an
`http`/`https` mismatch or a different host causes `redirect_uri_mismatch`.
Apple does **not** accept `http://localhost`; see the Apple section.

---

## Microsoft Entra ID (employees and students)

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com)
   with an account that can create app registrations.
2. Go to **Identity → Applications → App registrations → New registration**.
3. Name the application, for example `UNAH Red de Tutores`.
4. Under **Supported account types**, choose **Accounts in any organizational
   directory (Any Microsoft Entra ID tenant - Multitenant)**.
5. Under **Redirect URI**, choose **Web** and paste the Microsoft callback URL.
6. Select **Register**.
7. Copy **Application (client) ID** into `MICROSOFT_CLIENT_ID`.
8. Open **Certificates & secrets → Client secrets → New client secret**.
   - Choose an expiry (12 or 24 months).
   - Copy the **Value** immediately into `MICROSOFT_CLIENT_SECRET`. The portal
     never shows it again. The **Secret ID** is not the secret.
9. Collect each institution's **Tenant ID**:
   - Entra admin center → **Identity → Overview → Tenant ID**, or
   - Microsoft Entra admin center → **Identity → Applications → App
     registrations → your app → Overview → Directory (tenant) ID** for the
     tenant that owns the app.
   - Put the GUIDs in `MICROSOFT_ALLOWED_TENANT_IDS`, comma-separated:
     `11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222`.
10. Optional claims: **Token configuration → Add optional claim → ID token →
    `email`**. Some tenants put the address only in `preferred_username` or
    `upn`; the API accepts all three, but adding `email` is recommended.
11. **API permissions**: the default `openid`, `profile`, `email` and
    `User.Read` delegated permissions are enough. If the tenant restricts user
    consent, an administrator must select **Grant admin consent**.
12. Restart the API. `GET /api/auth/providers` must include `microsoft`.

Expiry and rotation: client secrets expire. Before the expiry date, create a new
secret, deploy it as `MICROSOFT_CLIENT_SECRET`, verify login, then delete the old
secret. Rotating does not invalidate user sessions.

---

## Google (applicants)

1. Open the [Google Cloud Console](https://console.cloud.google.com) and select
   or create a project.
2. Go to **APIs & Services → OAuth consent screen**.
3. Choose **External** (applicants are outside the organization), fill the app
   name, support email and developer contact, and save.
4. Add scopes `openid`, `email` and `profile`. These are non-sensitive; no
   verification review is normally required for them.
5. While the publishing status is **Testing**, add every tester under **Test
   users**, or publish the app.
6. Go to **APIs & Services → Credentials → Create credentials → OAuth client
   ID**.
7. Application type: **Web application**.
8. Under **Authorized redirect URIs**, add the Google callback URL exactly.
9. Create the client.
10. Copy **Client ID** into `GOOGLE_CLIENT_ID` and **Client secret** into
    `GOOGLE_CLIENT_SECRET`.
11. Restart the API and confirm `google` appears in `GET /api/auth/providers`.

Expiry and rotation: Google OAuth client secrets do not expire on a fixed date.
If one leaks, use **Reset secret**, update the deployment and restart.

---

## Apple (applicants)

Apple requires a paid Apple Developer account and HTTPS for the return URL. It
does not accept `localhost`, so local testing needs a tunnel.

### 1. App ID

1. Sign in to [Apple Developer](https://developer.apple.com/account).
2. Go to **Certificates, Identifiers & Profiles → Identifiers**.
3. Select the **App IDs** filter and create (or open) an App ID for the app.
4. Enable **Sign in with Apple** and save.

### 2. Services ID (`APPLE_CLIENT_ID`)

1. In **Identifiers**, create a new identifier of type **Services IDs**.
2. Use a reverse-DNS identifier, for example `hn.unah.tutores.web`.
3. Enable **Sign in with Apple** and select **Configure**.
4. Under **Primary App ID**, choose the App ID from step 1.
5. Under **Domains and Subdomains**, add the production host (for example
   `app.example.edu`) and, for local testing, your tunnel host.
   Apple rejects `localhost`.
6. Under **Return URLs**, add the Apple callback URL:
   - Production: `https://app.example.edu/api/auth/apple/callback`
   - Local: `https://<your-tunnel-host>/api/auth/apple/callback`
7. Save. The identifier (`hn.unah.tutores.web`) is the **Services ID**; copy it
   into `APPLE_CLIENT_ID`. Do not use the App ID here.

### 3. Key

1. Go to **Keys → Create a key** (or the **+** button).
2. Name it and enable **Sign in with Apple**, then configure it with the App ID.
3. Register the key and **download the `.p8` file once**. Apple cannot show it
   again.
4. Copy **Key ID** into `APPLE_KEY_ID`.
5. Copy the **Team ID** from the top-right of the Apple Developer account page
   into `APPLE_TEAM_ID`.
6. Put the private key into `APPLE_PRIVATE_KEY`, escaping newlines:
   ```dotenv
   APPLE_PRIVATE_KEY="<contents of the .p8 file, with newlines escaped as \\n>"
   ```
   Or store the file outside the repository and set
   `APPLE_PRIVATE_KEY_PATH=/run/secrets/apple-auth-key.p8`.
   `APPLE_PRIVATE_KEY` takes precedence when both are set.
7. Restart the API and confirm `apple` appears in `GET /api/auth/providers`.

### 4. Local tunnel

1. Start the API on port 3000.
2. Start a tunnel, for example `cloudflared tunnel --url http://localhost:3000`
   or `ngrok http 3000`.
3. Copy the HTTPS host into the Apple Services ID **Domains/Return URLs** and
   set `AUTH_CALLBACK_BASE_URL=https://<tunnel-host>` in `server/.env`.
4. Restart the API so the callback URL changes.

Expiry and rotation: the `.p8` key does not expire, but it can be revoked. To
rotate, create a new key, deploy it as `APPLE_PRIVATE_KEY`/`APPLE_PRIVATE_KEY_PATH`,
verify login, then revoke the old key. Apple only sends name and email on the
first authorization; the API stores whatever is returned and links later logins
by the Apple `sub`.

---

## Checklist

| Variable | Where it comes from | Example (fake) |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | Entra app registration → Application (client) ID | `00000000-0000-0000-0000-000000000000` |
| `MICROSOFT_CLIENT_SECRET` | Entra → Certificates & secrets → secret **Value** | `abc123~fakeSecretValue` |
| `MICROSOFT_ALLOWED_TENANT_IDS` | Entra → Overview → Tenant ID, one per institution | `11111111-1111-1111-1111-111111111111` |
| `GOOGLE_CLIENT_ID` | Google Cloud → Credentials → OAuth client ID | `1234567890-fake.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud → Credentials → client secret | `GOCSPX-fake-secret` |
| `APPLE_CLIENT_ID` | Apple Developer → Identifiers → Services ID | `hn.unah.tutores.web` |
| `APPLE_TEAM_ID` | Apple Developer account → Team ID | `ABCDE12345` |
| `APPLE_KEY_ID` | Apple Developer → Keys → Key ID | `FGHIJ67890` |
| `APPLE_PRIVATE_KEY` | Downloaded `.p8`, newline-escaped | `<.p8 contents>` |
| `APPLE_PRIVATE_KEY_PATH` | Path to the `.p8` on the server | `/run/secrets/apple-auth-key.p8` |
| `AUTH_CALLBACK_BASE_URL` | Public HTTPS origin of the API | `https://app.example.edu` |
| `AUTH_SUCCESS_REDIRECT` | Client path after login | `/` |
| `AUTH_FAILURE_REDIRECT` | Client path after a failed login | `/auth/login` |

Re-run `npm run doctor` after editing environment values, then restart the API
and check `GET /api/auth/providers`.
