# NOVA AI backend: setup and API contract

This backend is **not deployed** and no real provider request has been verified in this workspace. The extension never calls a model provider directly. This implementation uses Django REST Framework token authentication and an OpenAI-compatible provider adapter whose endpoint is fixed to OpenAI. The architecture isolates the adapter, but only that adapter is implemented. Tests substitute a fake provider; fake responses are never used in the application.

## Local development

Requires Python 3.11+, Node 20.19+ or 22.12+, npm and a Chrome version supporting `chrome.sidePanel.open` (Chrome 116+). These commands run on **your own computer**, not inside the Arena preview. From the project root:

```sh
npm ci
npm run build
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env`: generate a unique `NOVA_SECRET_KEY` using `python -c 'import secrets; print(secrets.token_urlsafe(48))'`, provide a real **server-side** `NOVA_PROVIDER_KEY`, and change `NOVA_ALLOWED_ORIGINS` to `chrome-extension://<your-extension-id>` (no trailing slash). First load `dist` using `chrome://extensions` → Developer mode → Load unpacked; the extension ID is displayed there. Configure `NOVA_ALLOWED_HOSTS` if necessary. Never commit `.env` or put the provider key in the extension.

```sh
set -a; . backend/.env; set +a
python backend/manage.py migrate
python backend/manage.py createsuperuser
python backend/manage.py drf_create_token YOUR_USERNAME
python backend/manage.py runserver 127.0.0.1:8000
```

`drf_create_token` prints an **account authentication token**, distinct from the provider API key. Treat it as a password; do not share it or paste it into public logs. On a regular page, open the NOVA popup → **NOVA Assistant** → settings. Enter `http://localhost:8000` and the 40-character account token, click Connect and approve Chrome's optional backend-origin permission. The token is stored in `chrome.storage.session` until Chrome restarts or Disconnect is clicked; the provider key is never entered there. The extension also accepts HTTPS backends. HTTP is permitted only for localhost/loopback. Disconnect clears the token but does not revoke a host grant that could also be used by another NOVA feature; use Chrome's extension permissions to revoke it.

The local development server is **not a production deployment**. For production, set `NOVA_DEBUG=0`, use HTTPS and a trusted reverse proxy, explicitly allow only your real extension origins and hosts, keep secrets in a secret manager, manage accounts/token rotation and revocation securely, add infrastructure-level IP/auth abuse protection, request and connection limits, monitoring and backups. Do not log bodies, authorization headers, page text, prompts or provider responses. SQLite is intended for local development; assess concurrency, availability, durable per-user quota storage and deployment configuration before production. Default token authentication has no built-in expiry. Provider quotas, data retention and privacy terms depend on your chosen provider; never promise data stays on-device once the user approves sharing. Upstream cancellation after client disconnect is best-effort and may not prevent provider billing.

## Endpoints

All require `Authorization: Token <NOVA_ACCOUNT_TOKEN>`. Requests and usage are associated with that authenticated user. No signup/login API is provided; users and tokens are provisioned by the server operator. CORS allows only exact origins listed in `NOVA_ALLOWED_ORIGINS`; the `Origin` header is not authentication.

- `POST /api/ai/chat/` — general chat, or questions grounded in explicitly supplied context.
- `POST /api/ai/summarise/`, `/api/ai/explain/`, `/api/ai/notes/` — same payload, but require `context`.
- `GET /api/ai/usage/` — `{ "date": "YYYY-MM-DD", "requests": 2, "limit": 30 }`; date is UTC. The default 30 requests/day/user is configurable with `NOVA_DAILY_LIMIT`. Each valid attempt consumes quota, including provider failures. This is not a substitute for edge-level abuse prevention.

Example POST body:

```json
{
  "message": "Explain the key ideas.",
  "history": [{"role": "user", "content": "Earlier question"}],
  "context": {"title": "Article", "url": "https://example.org/article", "text": "User-approved source text"}
}
```

`context` is optional for chat. Limits: message 4,000 characters; up to 8 prior messages, each 4,000 and 12,000 total characters; context text 24,000; title 300; URL 2,048; upstream output 1,000 tokens and server output 12,000 characters. Request body is limited to 128 KiB by Django configuration. The frontend strips the context URL's query and fragment, but the article text or title may itself contain sensitive data. It shows the extracted text for review and requires fresh approval before **each** request that includes it. User chats and generated text are stored locally until cleared; source text is not deliberately stored in chat history, although a model may repeat it in its answer. Research cards are saved only after separate review.

Successful generation is `text/event-stream`:

```text
event: delta
data: {"text":"A piece of the response"}

event: done
data: {}
```

Streaming errors use `event: error` with JSON `{ "message": "..." }`. Errors before streaming use HTTP status codes and JSON `{ "error": { "code": "...", "message": "..." } }` for validation, quota and provider errors. DRF authentication errors follow DRF's standard `detail` format. Upstream connect/read timeouts are 5/30 seconds. Stopping generation cancels the browser fetch; the server closes its upstream when the stream terminates, but disconnect detection varies by server/proxy.

The system prompt instructs the model to treat source content as untrusted data and avoid invented citations; this is **not a guarantee** against prompt injection or hallucination. Sensitive-site detection and hidden-element filtering are best-effort, not a security boundary. Do not use NOVA to share secrets, personal records, financial or health information. Review every context, even on pages the heuristic permits.

## Verification

```sh
NOVA_SECRET_KEY=test-only python backend/manage.py test ai
npm test
npm run build
npm run test:package
npm audit
```

Backend tests use a fake provider. To verify live integration, configure and fund a real provider account, then manually test auth, context preview, consent, every endpoint, streaming, cancellation, quotas, error handling and provider privacy behavior in an installed extension. Inspect Chrome and server logs/network without exposing tokens or content. No live provider or installed-Chrome result is claimed by the automated suite.
