# Code Examples, Postman & SDKs

> Copy-paste recipes for the five-minute integration. All examples assume:
> `BASE=https://api.wco.africa/api/v1`, a stored `ACCESS_TOKEN` and `STORE_ID`.

---

## 1. End-to-end: order → payment link → delivery quote (cURL)

```bash
# 0. Login (once; refresh per authentication-authorization.md §3)
ACCESS_TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@wco.app","password":"Demo1234!"}' | jq -r .accessToken)

# 1. Create an order (idempotent)
ORDER=$(curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Store-Id: $STORE_ID" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerId": "cst_tunde01",
    "deliveryAddress": "12 Awolowo Rd, Ikoyi, Lagos",
    "items": [{ "productId": "prd_rice50kg", "quantity": 2 }]
  }')
ORDER_ID=$(echo $ORDER | jq -r .id)

# 2. Initialize payment link
PAYMENT=$(curl -s -X POST $BASE/payments \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Store-Id: $STORE_ID" \
  -H "Content-Type: application/json" -H "X-Idempotency-Key: $(uuidgen)" \
  -d "{ \"orderId\": \"$ORDER_ID\", \"provider\": \"PAYSTACK\" }")
echo $PAYMENT | jq -r .checkoutUrl   # send to customer via WhatsApp

# 3. After PSP webhook confirms — book cheapest delivery
curl -s -X POST $BASE/deliveries \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-Store-Id: $STORE_ID" \
  -H "Content-Type: application/json" -H "X-Idempotency-Key: $(uuidgen)" \
  -d "{ \"orderId\": \"$ORDER_ID\" }"
```

## 2. TypeScript / JavaScript

```ts
const BASE = "https://api.wco.africa/api/v1";

class WcoClient {
  constructor(private token: string, private storeId?: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(this.storeId && { "X-Store-Id": this.storeId }),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const { code, message, requestId } = await res.json();
      throw Object.assign(new Error(message), { code, requestId, status: res.status });
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  listOrders(cursor?: string) {
    return this.request<{ items: Order[]; meta: { nextCursor: string | null } }>(
      `/orders${cursor ? `?cursor=${cursor}` : ""}`,
    );
  }
}
```

Retry policy for transient codes (`RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`):
exponential backoff with jitter, max 5 attempts, honor `Retry-After`. Never retry
`VALIDATION_ERROR`/`CONFLICT` blindly.

## 3. Python

```python
import os, requests

BASE = "https://api.wco.africa/api/v1"
S = requests.Session()
S.headers.update({
    "Authorization": f"Bearer {os.environ['WCO_ACCESS_TOKEN']}",
    "X-Store-Id": os.environ.get("WCO_STORE_ID", ""),
})

# Cursor-paginate every order
def all_orders():
    cursor = None
    while True:
        params = {"limit": 100, **({"cursor": cursor} if cursor else {})}
        page = S.get(f"{BASE}/orders", params=params, timeout=10).json()
        yield from page["items"]
        if not page["meta"]["hasMore"]:
            return
        cursor = page["meta"]["nextCursor"]

for order in all_orders():
    print(order["orderNumber"], order["total"], order["status"])
```

## 4. Webhook receiver (Node/Express)

```ts
import crypto from "node:crypto";

app.post("/hooks/wco", express.raw({ type: "*/*" }), (req, res) => {
  const [t, v1] = req.header("X-WCO-Signature")!.split(",").map((kv) => kv.split("=")[1]);
  const expected = crypto.createHmac("sha256", process.env.WCO_WEBHOOK_SECRET!).update(`${t}.${req.body}`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  if (!(fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1)))) {
    return res.sendStatus(401);
  }
  const event = JSON.parse(req.body);            // dedupe on event.eventId
  res.sendStatus(200);                            // ack fast, process async
});
```

## 5. Postman collection

The collection is **generated from the spec** so it can never drift:

```bash
npx openapi-to-postmanv2 -s docs/api/openapi.yaml -o docs/api/postman/collection.json -p -O folderStrategy=Tags,requestParametersResolution=Example
```

Import `docs/api/postman/collection.json` into Postman → set collection variables
`baseUrl`, `accessToken`, `storeId` → every request is pre-filled with examples from
the spec. A pre-request script skeleton for automatic refresh-token rotation ships in
`docs/api/postman/pre-request.js`.

## 6. SDK generation

| Language | Command | Output |
|---|---|---|
| TypeScript | `npx openapi-typescript docs/api/openapi.yaml -o packages/sdk-ts/src/schema.d.ts` | typed client (`wco-sdk` npm package) |
| Python | `openapi-generator-cli generate -i docs/api/openapi.yaml -g python -o packages/sdk-python` | PyPI `wco` |
| Dart (mobile) | `openapi-generator-cli generate -i docs/api/openapi.yaml -g dart-dio -o packages/sdk-dart` | pub.dev `wco_client` |

CI publishes SDK artifacts on every release tag after running the generated clients
against staging smoke endpoints (contract canary).

## 7. GraphQL quick test

```bash
curl -s -X POST $BASE/graphql \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query($s: ID!){ dashboard(storeId:$s, range:last7days){ revenue ordersCount aiResolutionRate } }",
        "variables": { "s": "'"$STORE_ID"'" } }'
```

## 8. Rate-limit-aware polling pattern

```ts
async function pollWithBackoff(fn, { max = 5 } = {}) {
  for (let i = 0; i < max; i++) {
    try { return await fn(); }
    catch (e) {
      if (!["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "INTERNAL_ERROR"].includes(e.code)) throw e;
      const wait = (Number(e.retryAfter) || 2 ** i) * 1000 + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("max retries exceeded");
}
```
