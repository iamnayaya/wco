import json
import sys

import yaml

path = sys.argv[1] if len(sys.argv) > 1 else "docs/api/openapi.yaml"
doc = yaml.safe_load(open(path, encoding="utf-8"))

print("YAML OK")
paths = doc.get("paths", {})
schemas = doc.get("components", {}).get("schemas", {})
responses = doc.get("components", {}).get("responses", {})
params = doc.get("components", {}).get("parameters", {})
headers = doc.get("components", {}).get("headers", {})
sec = doc.get("components", {}).get("securitySchemes", {})

print(f"openapi: {doc['openapi']}  paths: {len(paths)}  schemas: {len(schemas)}")
print(f"responses: {len(responses)}  parameters: {len(params)}  headers: {len(headers)}  securitySchemes: {len(sec)}")

ops = 0
for p, item in paths.items():
    for method, op in item.items():
        if method in ("get", "post", "put", "patch", "delete"):
            ops += 1
            assert "responses" in op, f"{method.upper()} {p} missing responses"
print(f"operations: {ops}")

refs = set()


def walk(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "$ref" and isinstance(v, str) and v.startswith("#/"):
                refs.add(v)
            walk(v)
    elif isinstance(node, list):
        for child in node:
            walk(child)


walk(doc)
missing = []
for ref in refs:
    parts = ref.lstrip("#/").split("/")
    target = doc
    try:
        for part in parts:
            target = target[part]
    except (KeyError, TypeError):
        missing.append(ref)
print(f"internal $refs: {len(refs)}  unresolved: {len(missing)}")
for ref in missing:
    print("  MISSING:", ref)

if missing:
    sys.exit(1)
