"""Attach the Cognito authorizer to every non-OPTIONS method and verify.

Uses the AWS CLI (JSON output, so no line-ending issues on Windows) and
retries transient errors. Usage:  python backend/scripts/require_auth.py
"""
import json
import subprocess
import sys
import time

REGION = 'us-east-2'
API_ID = 'ylpqf7y8ed'
AUTHORIZER_NAME = 'pagebound-cognito'


def aws(*args, retries=5):
    cmd = ['aws', '--region', REGION, '--output', 'json', *args]
    for attempt in range(retries):
        p = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
        if p.returncode == 0:
            return json.loads(p.stdout) if p.stdout.strip() else None
        transient = any(s in p.stderr for s in ('UnrecognizedClient', 'TooManyRequests', 'Throttl'))
        if not transient or attempt == retries - 1:
            raise RuntimeError(p.stderr.strip())
        time.sleep(2 * (attempt + 1))


authorizer_id = next(a['id'] for a in aws('apigateway', 'get-authorizers', '--rest-api-id', API_ID)['items']
                     if a['name'] == AUTHORIZER_NAME)
resources = aws('apigateway', 'get-resources', '--rest-api-id', API_ID, '--limit', '500', '--embed', 'methods')['items']

changed, failed = 0, []
for r in sorted(resources, key=lambda x: x['path']):
    for method, info in (r.get('resourceMethods') or {}).items():
        if method == 'OPTIONS':
            continue
        if info.get('authorizationType') == 'COGNITO_USER_POOLS' and info.get('authorizerId') == authorizer_id:
            continue
        try:
            aws('apigateway', 'update-method', '--rest-api-id', API_ID, '--resource-id', r['id'],
                '--http-method', method, '--patch-operations',
                'op=replace,path=/authorizationType,value=COGNITO_USER_POOLS',
                f'op=replace,path=/authorizerId,value={authorizer_id}')
            changed += 1
        except RuntimeError as e:
            failed.append(f"{method} {r['path']}: {e}")

# Verify from a fresh read
resources = aws('apigateway', 'get-resources', '--rest-api-id', API_ID, '--limit', '500', '--embed', 'methods')['items']
open_methods = [f"{m} {r['path']}" for r in resources for m, i in (r.get('resourceMethods') or {}).items()
                if m != 'OPTIONS' and i.get('authorizationType') != 'COGNITO_USER_POOLS']
total = sum(1 for r in resources for m in (r.get('resourceMethods') or {}) if m != 'OPTIONS')

print(f'updated {changed}; protected {total - len(open_methods)}/{total}')
for line in failed + [f'still open: {m}' for m in open_methods]:
    print('  ' + line)
sys.exit(1 if open_methods else 0)
