# SDKs & Libraries

Official WCO SDKs are **generated from the OpenAPI spec** so they can never drift from the actual API. CI publishes refreshed SDK artifacts on every release tag (after running the generated clients against staging smoke endpoints — a "contract canary").

> Generation commands and code examples are in [Code examples, Postman & SDKs](./examples.md). This page is the inventory & usage reference.

## Official SDKs

| Language | Package | Ecosystem | Status | Notes |
|---|---|---|---|---|
| TypeScript | `wco-sdk` | npm | ✅ GA | Full client; JWT + refresh rotation helpers; typed from spec |
| Python | `wco` | PyPI | ✅ GA | Requests-based; cursor pagination helpers |
| Dart (mobile) | `wco_client` | pub.dev | ✅ GA | dart-dio generated; used by the WCO mobile app |

### Where they're generated from

```
docs/api/openapi.yaml   →  packages/sdk-ts   (openapi-typescript → schema.d.ts)
                        →  packages/sdk-python (openapi-generator-cli -g python)
                        →  packages/sdk-dart   (openapi-generator-cli -g dart-dio)
```

## Install & quick use

### TypeScript

```bash
npm install wco-sdk
```

```ts
import { WcoClient } from "wco-sdk";

const client = new WcoClient({
  apiKey: "wco_strde_9xK...",   // or use token + auto-refresh
  baseUrl: "https://api.wco.africa/api/v1",
  storeId: "str_demo_store",
});

const { items } = await client.orders.list({ limit: 20 });
```

### Python

```bash
pip install wco
```

```python
from wco import Wco
client = Wco(api_key="wco_strde_9xK...", base_url="https://api.wco.africa/api/v1")
orders = client.orders.list(limit=20)
```

### Dart

```dart
final client = WcoClient(
  apiKey: 'wco_strde_9xK...',
  baseUrl: 'https://api.wco.africa/api/v1',
  storeId: 'str_demo_store',
);
final page = await client.ordersApi.listOrders(limit: 20);
```

## Codegen for your own SDK / contract

All SDKs derive from the single source of truth. You can generate a client in any OpenAPI-capable language:

```bash
# TypeScript types
npx openapi-typescript docs/api/openapi.yaml -o my-sdk-types.ts

# Any OpenAPI Generator language
openapi-generator-cli generate \
  -i docs/api/openapi.yaml -g <generator> -o ./my-sdk
```

## Postman collection (for testing)

A ready-to-import **Postman collection** is generated from the spec (see [examples.md](./examples.md#5-postman-collection)):

```bash
npx openapi-to-postmanv2 -s docs/api/openapi.yaml \
  -o docs/api/postman/collection.json \
  -p -O folderStrategy=Tags,requestParametersResolution=Example
```

## Community libraries

The WCO API is pure REST + OpenAPI, so any community adapter works. If you build or use a community library, we'd love to feature it — reach out via api-support@wco.com. (Community libraries are not officially supported.)

## Guidance

- **Prefer the SDK to raw HTTP** when you can — it handles auth, pagination, and errors.
- **Retry only transient codes** (`RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`) with exponential backoff + jitter, honoring `Retry-After`. Never blindly retry `VALIDATION_ERROR`/`CONFLICT`.
- **SDK version pinning:** SDKs are semver'd with the API; upgrade major versions alongside API major versions.
- **Sandbox first:** test against the dev/sandbox base URL before production.
