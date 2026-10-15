#!/usr/bin/env python3
"""Dependency-free structural and policy check of this project's OpenAPI contract.
Not a replacement for a general OpenAPI validator or backend integration tests.
"""
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCUMENT = json.loads((ROOT / 'openapi.json').read_text())
ERRORS = []
METHODS = {'get', 'post', 'patch', 'put', 'delete'}


def check(condition, message):
    if not condition:
        ERRORS.append(message)


def resolve(reference):
    if not reference.startswith('#/'):
        raise ValueError('Only internal refs allowed: ' + reference)
    value = DOCUMENT
    for part in reference[2:].split('/'):
        value = value[part.replace('~1', '/').replace('~0', '~')]
    return value


def walk(value, location='$'):
    if isinstance(value, dict):
        if '$ref' in value:
            try:
                resolve(value['$ref'])
            except (KeyError, ValueError, TypeError) as exc:
                ERRORS.append(f'{location}: unresolved reference {exc}')
        for key, item in value.items():
            walk(item, location + '.' + key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            walk(item, f'{location}[{index}]')


def matches(value, schema):
    """Validate the JSON Schema keywords used by this contract's JSON examples."""
    if '$ref' in schema:
        return matches(value, resolve(schema['$ref']))
    if 'const' in schema and value != schema['const']:
        return False
    if 'enum' in schema and value not in schema['enum']:
        return False
    if 'anyOf' in schema and not any(matches(value, s) for s in schema['anyOf']):
        return False
    if 'oneOf' in schema and sum(matches(value, s) for s in schema['oneOf']) != 1:
        return False
    if 'allOf' in schema and not all(matches(value, s) for s in schema['allOf']):
        return False
    if 'if' in schema:
        branch = 'then' if matches(value, schema['if']) else 'else'
        if branch in schema and not matches(value, schema[branch]):
            return False
    typ = schema.get('type')
    if typ == 'null' and value is not None:
        return False
    if typ == 'boolean' and not isinstance(value, bool):
        return False
    if typ == 'integer':
        if type(value) is not int:
            return False
        if value < schema.get('minimum', value) or value > schema.get('maximum', value):
            return False
    if typ == 'string':
        if not isinstance(value, str):
            return False
        if len(value) < schema.get('minLength', 0) or len(value) > schema.get('maxLength', len(value)):
            return False
        if 'pattern' in schema and not re.search(schema['pattern'], value):
            return False
        fmt = schema.get('format')
        if fmt == 'uuid' and not re.fullmatch(r'[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}', value):
            return False
        if fmt == 'email' and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            return False
        if fmt in ('date', 'date-time'):
            try:
                if fmt == 'date':
                    datetime.date.fromisoformat(value)
                else:
                    parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
                    if parsed.tzinfo is None:
                        return False
            except ValueError:
                return False
        if fmt == 'uri' and not re.match(r'^https?://[^\s/]+', value):
            return False
    if typ == 'array':
        if not isinstance(value, list):
            return False
        if len(value) < schema.get('minItems', 0) or len(value) > schema.get('maxItems', len(value)):
            return False
        if schema.get('uniqueItems') and len({json.dumps(i, sort_keys=True) for i in value}) != len(value):
            return False
        if not all(matches(item, schema['items']) for item in value):
            return False
    # Properties also apply in conditional fragments without an explicit type.
    if typ == 'object' and not isinstance(value, dict):
        return False
    if isinstance(value, dict):
        if any(key not in value for key in schema.get('required', [])):
            return False
        props = schema.get('properties', {})
        if schema.get('additionalProperties') is False and any(key not in props for key in value):
            return False
        if len(value) < schema.get('minProperties', 0):
            return False
        if not all(matches(item, props[key]) for key, item in value.items() if key in props):
            return False
    return True


EXPECTED = {
    '/csrf-token': 'get', '/accounts': 'post', '/sessions': 'post', '/sessions/current': 'delete',
    '/password-recovery-requests': 'post', '/password-resets': 'post', '/me': 'get',
    '/me/profile': 'patch', '/me/privacy': 'patch', '/me/contact-changes': 'post',
    '/me/account-code-changes': 'post', '/members': 'get', '/members/{id}': 'get',
    '/members/{id}/memberships': 'get', '/join-applications': 'get post',
    '/join-applications/{id}/approve': 'post', '/join-applications/{id}/reject': 'post',
    '/join-applications/{id}/withdraw': 'post', '/membership-transfers': 'get post',
    '/membership-transfers/{id}/approve': 'post', '/membership-transfers/{id}/reject': 'post',
    '/membership-transfers/{id}/withdraw': 'post', '/membership-transfers/{id}/execute': 'post',
    '/membership-end-requests': 'get post', '/membership-end-requests/{id}/approve': 'post',
    '/memberships/{id}/end': 'post', '/clubs/{id}/annual-confirmations': 'get post',
    '/clubs/{id}': 'get patch', '/clubs': 'get post', '/clubs/{id}/disable': 'post',
    '/clubs/{id}/restore': 'post', '/club-move-requests': 'get post',
    '/club-move-requests/{id}/approve': 'post', '/club-move-requests/{id}/execute': 'post',
    '/role-grants': 'get post', '/role-grants/{id}/revoke': 'post',
    '/memberships/{id}/experience-visibility': 'patch', '/memberships/{id}/publication-requests': 'post',
    '/me/publication-requests': 'get', '/publication-requests/{id}/decision': 'post',
    '/admin/memberships/{id}/visibility-overrides': 'post', '/me/audit-events': 'get',
    '/audit-events': 'get', '/assets': 'post', '/support-cases': 'get post',
    '/support-cases/{id}/resolve': 'post',
    '/support-recovery-cases': 'post', '/support-recovery-cases/{id}': 'get',
    '/support-recovery-cases/{id}/evidence': 'post', '/support-recovery-email-confirmations': 'post',
}


def main():
    check(DOCUMENT['openapi'] == '3.1.0', 'OpenAPI must be 3.1.0')
    walk(DOCUMENT)
    ids = set()
    examples = 0
    used_schemas = set()
    for path, verbs in EXPECTED.items():
        for verb in verbs.split():
            check(verb in DOCUMENT['paths'].get(path, {}), f'Missing {verb.upper()} {path}')
    for path, item in DOCUMENT['paths'].items():
        for verb, op in item.items():
            if verb not in METHODS:
                continue
            label = f'{verb.upper()} {path}'
            oid = op.get('operationId')
            check(oid and oid not in ids, label + ': missing/duplicate operationId')
            ids.add(oid)
            check(bool(op.get('x-authorization')), label + ': no authorization scope')
            check('x-state-safeguards' in op, label + ': no safeguards declaration')
            params = op.get('parameters', [])
            for name in re.findall(r'{([^}]+)}', path):
                check(any(p['name'] == name and p['in'] == 'path' and p.get('required') for p in params), label + ': path parameter missing')
            if verb != 'get':
                check(any(p['name'] == 'X-CSRF-Token' and p.get('required') for p in params), label + ': CSRF missing')
            if 'requestBody' in op:
                for mime, media in op['requestBody']['content'].items():
                    schema = resolve(media['schema']['$ref'])
                    used_schemas.add(media['schema']['$ref'].split('/')[-1])
                    check(schema.get('additionalProperties') is False, label + ': request not closed')
                    check(bool(schema.get('required')), label + ': request required fields absent')
                    if mime == 'application/json':
                        check(bool(media.get('examples')), label + ': request example absent')
                    for example in media.get('examples', {}).values():
                        examples += 1
                        check(matches(example['value'], media['schema']), label + ': invalid request example')
                    if 'version' in schema.get('properties', {}):
                        check('version' in schema['required'], label + ': optional version')
                        check(any('409' in guard and 'version' in guard for guard in op['x-state-safeguards']), label + ': version guard absent')
            for status, response in op['responses'].items():
                if '$ref' in response:
                    response = resolve(response['$ref'])
                if status == '204':
                    check('content' not in response, label + ': 204 has body')
                    continue
                check('application/json' in response.get('content', {}), label + ': untyped response ' + status)
                for media in response.get('content', {}).values():
                    check(bool(media.get('schema')), label + ': missing response DTO')
                    check(bool(media.get('examples')), label + ': missing response example')
                    for example in media.get('examples', {}).values():
                        examples += 1
                        check(matches(example['value'], media['schema']), label + ': invalid response example ' + status)
            for status in ('400', '401', '403', '404', '409', '429', '503'):
                check(status in op['responses'], label + ': missing error ' + status)
    schemas = DOCUMENT['components']['schemas']
    for name, schema in schemas.items():
        if schema.get('type') == 'object':
            check(schema.get('additionalProperties') is False, name + ': DTO not closed')
            check('required' in schema, name + ': required undeclared')
            check(set(schema.get('required', [])) <= set(schema.get('properties', {})), name + ': required property undefined')
    for name in ('MemberListItem', 'PublicExperience', 'PublicClub', 'FormerClubMembership'):
        fields = schemas[name]['properties']
        check(not ({'password', 'passwordHash', 'currentPassword', 'token', 'evidenceRefs'} & set(fields)), name + ': sensitive projection field')
    check(not ({'phone', 'email', 'accountId'} & set(schemas['MemberListItem']['properties'])), 'List leaks contact/account fields')
    check(not ({'name', 'memberId', 'endReason'} & set(schemas['PublicExperience']['properties'])), 'Public history leaks private fields')
    for name in ('ProfilePatch', 'PrivacyPatch'):
        check(not ({'role', 'accountId', 'email', 'phone'} & set(schemas[name]['properties'])), name + ': uncontrolled account mutation')
    execute = DOCUMENT['paths']['/membership-transfers/{id}/execute']['post']
    guard = ' '.join(execute['x-state-safeguards'])
    for keyword in ('ready_for_member', 'both approvals', 'needs_reapproval', 'Atomic', '409'):
        check(keyword in guard, 'Transfer safeguard missing: ' + keyword)
    check(any(p['name'] == 'Idempotency-Key' and p.get('required') for p in execute['parameters']), 'Execute lacks idempotency')
    for path in ('/members', '/members/{id}', '/members/{id}/memberships'):
        check(DOCUMENT['paths'][path]['get']['security'] == [{'cookieSession': []}], path + ': anonymous member query')
    check('currentPassword' in schemas['ContactChangeRequest']['required'], 'Contact password missing')
    check('allOf' in schemas['ContactChangeRequest'], 'Contact kind-specific validation missing')
    check('newValue' in schemas['ContactChangeRequest']['required'] and 'email' not in schemas['ContactChangeRequest']['properties'], 'Contact single-item contract broken')
    # Negative schema probes demonstrate protection from extra fields and malformed updates.
    check(not matches({'version': 1, 'role': 'permission_admin'}, schemas['ProfilePatch']), 'Mass assignment accepted')
    check(not matches({'version': 1}, schemas['ProfilePatch']), 'Empty profile mutation accepted')
    check(not matches({'version': 1, 'currentPassword': 'example passphrase', 'kind': 'phone', 'newValue': 'not-a-phone'}, schemas['ContactChangeRequest']), 'Malformed phone accepted')
    check(not matches({'version': 1, 'currentPassword': 'example passphrase', 'kind': 'email', 'newValue': 'not-an-email'}, schemas['ContactChangeRequest']), 'Malformed email accepted')
    check(not matches({'name': 'Member', 'callName': 'Demo', 'email': 'demo@example.invalid', 'password': 'short'}, schemas['RegisterRequest']), 'Short password accepted')
    # Every named DTO must be reachable from an operation, not an unused promise.
    reachable = set()
    def collect_refs(node):
        if isinstance(node, dict):
            if '$ref' in node:
                pointer = node['$ref']
                if pointer.startswith('#/components/schemas/'):
                    name = pointer.split('/')[-1]
                    if name not in reachable:
                        reachable.add(name)
                        collect_refs(resolve(pointer))
                elif pointer.startswith('#/components/responses/'):
                    collect_refs(resolve(pointer))
            for value in node.values():
                collect_refs(value)
        elif isinstance(node, list):
            for value in node:
                collect_refs(value)
    collect_refs(DOCUMENT['paths'])
    check(set(schemas) == reachable, 'Unreachable DTO schemas: ' + str(set(schemas) - reachable))
    recovery_security = DOCUMENT['paths']['/support-recovery-cases/{id}']['get']['security']
    check(recovery_security == [{'supportReceipt': []}], 'Anonymous case status must require scoped receipt')
    proof = DOCUMENT['paths']['/support-recovery-email-confirmations']['post']
    proof_rules = ' '.join(proof['x-state-safeguards'])
    for keyword in ('evidence', 'once', 'No account/email mutation', 'uniqueness', 'ALL sessions'):
        check(keyword in proof_rules, 'Recovery proof safeguard missing: ' + keyword)
    check(not ({'subjectAccountId', 'identifier', 'newEmail', 'evidenceRefs'} & set(schemas['RecoveryCaseStatus']['properties'])), 'Anonymous recovery status leaks identity or evidence')
    if ERRORS:
        print('\n'.join('ERROR: ' + err for err in ERRORS))
        return 1
    print(f'PASS: {len(ids)} operations, {len(schemas)} closed DTO schemas, {examples} JSON examples; refs, endpoint coverage, scopes, CSRF, versions and safeguards checked.')
    print('This is static contract validation only; no server, database, authorization enforcement or delivery behavior was tested.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
