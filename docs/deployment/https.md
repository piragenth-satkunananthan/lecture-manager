# HTTPS Termination Path — 2026-11-09

**Status:** Path recorded; not yet applied on the host. The planner currently runs local HTTP only.

## Default: Caddy with an internal CA on the LAN

- Hostname: `planner.home.arpa`
- Upstream: `127.0.0.1:3000`
- TLS: Caddy internal CA
- App binds loopback only; Caddy terminates HTTPS on port 443.

### 1. Configure the app

In `.env`:

```sh
HOST=127.0.0.1
PORT=3000
PLANNER_ORIGIN=https://planner.home.arpa
```

`PLANNER_ORIGIN` must match the browser URL exactly. The app will set a `Secure` session cookie once the origin is HTTPS.

### 2. Caddy

Install Caddy 2, then copy [`deploy/Caddyfile.example`](../../deploy/Caddyfile.example) to `/etc/caddy/Caddyfile` and run:

```sh
sudo systemctl enable --now caddy
```

### 3. Name resolution

Add `planner.home.arpa` to the LAN DNS resolver, pointing at the host's LAN address. If the router cannot do this, add it to each client's hosts file. Android hosts-file editing is restricted; router DNS or Tailscale is preferred.

### 4. Trust the internal CA

Caddy writes its local root CA under its data directory, typically:

```text
/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
```

The exact path depends on the Caddy service user. Install that root certificate as trusted:

- **Arch Linux:** copy it to `/etc/ca-certificates/trust-source/anchors/planner-caddy.crt`, then run `sudo trust extract-compat`.
- **Android:** install it as a CA certificate under Settings → Security → Encryption & credentials → Install a certificate → CA certificate.
- **Other devices:** install the same root certificate in the device trust store.

### 5. Firewall

- Allow TCP 443 from the private LAN.
- Do **not** expose TCP 3000; the app binds `127.0.0.1`.
- Do not expose the planner to the public internet. Outside-LAN use requires the user's VPN.

### 6. Verify

```sh
curl -I https://planner.home.arpa
```

Then open the URL, sign in, and confirm the session cookie is `Secure` and the browser shows a trusted certificate. Check that `PLANNER_ORIGIN` matches the URL exactly.

## Alternative: Tailscale certificate

If the planner is reached over Tailscale:

1. Enable HTTPS certificates in the tailnet.
2. Run `tailscale cert planner.<tailnet>.ts.net`.
3. Point Caddy at the issued certificate/key with `tls <cert> <key>`.
4. Set `PLANNER_ORIGIN=https://planner.<tailnet>.ts.net`.
5. Keep the app bound to `127.0.0.1`; Caddy remains the only listener on 443.

This avoids installing an internal CA on Android, at the cost of requiring Tailscale on every client.

## Local validation — 2026-11-09

The reverse-proxy path was validated locally with a Caddy 2.11.8 static binary:

- Listener: `https://localhost:8443` with `tls internal`.
- `auto_https disable_redirects` was used for the test because the non-root test process cannot bind port 80. Production Caddy on 443 normally keeps the HTTP→HTTPS redirect.
- `GET /` returned HTTP/2 **200** with the planner UI.
- Login returned **200**.
- The session cookie was:

  ```text
  Set-Cookie: session=<redacted>; Max-Age=21600; Path=/; HttpOnly; Secure; SameSite=Strict
  ```

- A state-changing request with no `Origin`, or with a different origin, returned **403**.
- `GET /api/items` returned **200**.

This validates TLS termination, the origin check, the `Secure` cookie, and API proxying. The internal CA is not yet trusted by a browser, and the host DNS/443/CA-trust steps below are still pending.

## Not done yet

- Caddy is not installed as a host service.
- The hostname is not registered in DNS.
- The CA is not installed on Android/Arch clients.
- The app is not currently running.

Until these are done, use local HTTP on `127.0.0.1` only.
