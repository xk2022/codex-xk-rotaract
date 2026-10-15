#!/usr/bin/env python3
"""Apply module overlays to the canonical OpenAPI document using only stdlib.

Core paths and shared schemas remain in openapi.json. Module changes belong in
fragments/*.json; integration tests compare the result with registered routes.
"""
import argparse
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
METHODS = {'get', 'post', 'patch', 'put', 'delete'}


def assemble():
    document = json.loads((ROOT / 'openapi.json').read_text())
    for source in sorted((ROOT / 'fragments').glob('*.json')):
        fragment = json.loads(source.read_text())
        for path, operations in fragment.get('paths', {}).items():
            for method, operation in operations.items():
                operation = copy.deepcopy(operation)
                if method in METHODS:
                    operation.setdefault('x-state-safeguards', [
                        operation.get('description', 'Current session, owner/organization scope and current grant validation.'),
                        'version conflicts return 409; session and scope checks run before idempotency replay; changes are transactional and use current server time.',
                    ])
                document['paths'].setdefault(path, {})[method] = operation
        for kind, values in fragment.get('components', {}).items():
            document['components'].setdefault(kind, {}).update(values)
        document['components']['schemas'].update(fragment.get('schemas', {}))

    def normalize(node):
        if isinstance(node, dict):
            if node.get('name') == 'pageSize' and 'schema' in node:
                node['schema']['minimum'] = 20
            if 'pageSize' in node.get('properties', {}):
                node['properties']['pageSize']['minimum'] = 20
            for value in node.values():
                normalize(value)
        elif isinstance(node, list):
            for value in node:
                normalize(value)
    normalize(document)
    for operations in document['paths'].values():
        for method, operation in operations.items():
            if method in METHODS:
                operation['x-implementation-status'] = 'implemented'
    return json.dumps(document, ensure_ascii=False, indent=2) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if module overlays have not been applied')
    args = parser.parse_args()
    output = assemble()
    target = ROOT / 'openapi.json'
    if args.check:
        if target.read_text() != output:
            raise SystemExit('FAIL: run python3 docs/api/build_contract.py before validation')
        print('PASS: module fragments match openapi.json')
    else:
        target.write_text(output)
        print('Updated docs/api/openapi.json; run validate_contract.py and backend mvn verify')
