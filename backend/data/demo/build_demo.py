import json

# ── SAST: pick top findings across pygoat + impacket ──
priority_tests = {
    'hardcoded_sql_expressions': 10,
    'sql_injection': 10,
    'hardcoded_password_string': 10,
    'hardcoded_password_funcarg': 10,
    'flask_debug_true': 9,
    'hashlib': 9,
    'subprocess_popen_with_shell_equals_true': 9,
    'start_process_with_a_shell': 9,
    'weak_cryptographic_key': 9,
    'jinja2_autoescape_false': 8,
    'paramiko_calls': 8,
    'request_with_no_cert_validation': 7,
    'subprocess_without_shell_equals_true': 7,
    'assert_used': 6,
    'hardcoded_bind_all_interfaces': 5,
}

sast_picks = []
for source, path in [
    ('pygoat', 'c:/Users/troyd/CLARA/CLARA/data/pygoat/bandit_report.json'),
    ('impacket', 'c:/Users/troyd/CLARA/CLARA/data/impacket/bandit_report.json'),
]:
    with open(path) as f:
        d = json.load(f)
    seen_tests = set()
    for r in d['results']:
        test = r['test_name']
        if test in priority_tests and test not in seen_tests:
            sast_picks.append({**r, '_source': source, '_priority': priority_tests[test]})
            seen_tests.add(test)
    for r in d['results']:
        if r['issue_severity'] == 'HIGH' and r['issue_confidence'] == 'HIGH' and r['test_name'] not in seen_tests:
            sast_picks.append({**r, '_source': source, '_priority': 5})
            seen_tests.add(r['test_name'])

sast_picks.sort(key=lambda x: -x['_priority'])
sast_demo = sast_picks[:12]
print(f'SAST demo picks: {len(sast_demo)}')
for p in sast_demo:
    src = p['_source']
    sev = p['issue_severity']
    test = p['test_name']
    print(f'  [{src}] {sev:6} {test}')

with open('c:/Users/troyd/CLARA/CLARA/data/demo/sast_bandit.json', 'w') as f:
    json.dump({'results': sast_demo, '_meta': {'tool': 'bandit', 'sources': ['pygoat', 'impacket']}}, f, indent=2)

# ── OSS: pick best CVEs across npm audit + both osv scans ──
oss_picks = []

# npm audit - grab runtime-relevant criticals and highs (skip dev tooling)
dev_pkg_patterns = ('@typescript-eslint', '@types/', 'eslint', 'jest', 'ts-node', 'prettier')
with open('c:/Users/troyd/CLARA/CLARA/data/juice-shop/npm_audit.json') as f:
    npm = json.load(f)
for name, vuln in npm.get('vulnerabilities', {}).items():
    sev = vuln.get('severity', '')
    if sev not in ('critical', 'high'):
        continue
    if any(name.startswith(p) for p in dev_pkg_patterns):
        continue
    via = vuln.get('via', [])
    direct = next((v for v in via if isinstance(v, dict)), {})
    oss_picks.append({
        '_source': 'juice-shop',
        '_tool': 'npm-audit',
        'package': name,
        'severity': sev,
        'cve': direct.get('url', '').replace('https://github.com/advisories/', ''),
        'title': direct.get('title', name),
        'cvss': direct.get('cvss', {}).get('score'),
        'cwe': direct.get('cwe', []),
    })

# osv-scanner pygoat - pick 1 high-impact finding per package
target_packages = ['pyyaml', 'werkzeug', 'cryptography', 'django', 'pillow', 'urllib3', 'requests']
with open('c:/Users/troyd/CLARA/CLARA/data/pygoat/osv_scan.json') as f:
    osv_pygoat = json.load(f)
seen_pkgs = set()
for r in osv_pygoat.get('results', []):
    for p in r.get('packages', []):
        pkg = p.get('package', {})
        name = pkg.get('name', '').lower()
        if name not in target_packages or name in seen_pkgs:
            continue
        vulns = p.get('vulnerabilities', [])
        if not vulns:
            continue
        v = vulns[0]
        cves = [a for a in v.get('aliases', []) if a.startswith('CVE')]
        oss_picks.append({
            '_source': 'pygoat',
            '_tool': 'osv-scanner',
            'package': pkg.get('name'),
            'version': pkg.get('version'),
            'severity': 'high',
            'cve': cves[0] if cves else v.get('id'),
            'title': v.get('summary', '') or v.get('id'),
            'osv_id': v.get('id'),
        })
        seen_pkgs.add(name)

# osv-scanner impacket
with open('c:/Users/troyd/CLARA/CLARA/data/impacket/osv_scan.json') as f:
    osv_impacket = json.load(f)
for r in osv_impacket.get('results', []):
    for p in r.get('packages', []):
        vulns = p.get('vulnerabilities', [])
        if not vulns:
            continue
        pkg = p.get('package', {})
        v = vulns[0]
        cves = [a for a in v.get('aliases', []) if a.startswith('CVE')]
        oss_picks.append({
            '_source': 'impacket',
            '_tool': 'osv-scanner',
            'package': pkg.get('name'),
            'version': pkg.get('version'),
            'severity': 'medium',
            'cve': cves[0] if cves else v.get('id'),
            'title': v.get('summary', '') or v.get('id'),
            'osv_id': v.get('id'),
        })

# cap npm at 8 criticals/highs, keep rest
npm_crits = [x for x in oss_picks if x['_source'] == 'juice-shop' and x['severity'] == 'critical'][:4]
npm_highs = [x for x in oss_picks if x['_source'] == 'juice-shop' and x['severity'] == 'high'][:4]
pygoat_oss = [x for x in oss_picks if x['_source'] == 'pygoat']
impacket_oss = [x for x in oss_picks if x['_source'] == 'impacket']
oss_demo = npm_crits + npm_highs + pygoat_oss + impacket_oss

print(f'\nOSS demo picks: {len(oss_demo)}')
for p in oss_demo:
    print(f"  [{p['_source']}] {p['severity']:8} {p['package']} | {p['cve']}")

with open('c:/Users/troyd/CLARA/CLARA/data/demo/oss_vulns.json', 'w') as f:
    json.dump({'vulnerabilities': oss_demo, '_meta': {'tools': ['npm-audit', 'osv-scanner'], 'sources': ['juice-shop', 'pygoat', 'impacket']}}, f, indent=2)

ZAP_KEEP = {'name', 'riskdesc', 'riskcode', 'confidence', 'description', 'solution', 'cweid', 'wascid'}

def trim_zap(alerts):
    return [{k: v for k, v in a.items() if k in ZAP_KEEP} for a in alerts]

# ── DAST: pygoat ZAP alerts ──
with open('c:/Users/troyd/CLARA/CLARA/data/pygoat/zap_report.json') as f:
    zap = json.load(f)
all_alerts = [a for s in zap.get('site', []) for a in s.get('alerts', [])]
dast_pygoat = [a for a in all_alerts if not a.get('riskdesc', '').startswith('Informational')]
dast_pygoat += [a for a in all_alerts if a.get('riskdesc', '').startswith('Informational')
                and any(kw in a.get('name', '') for kw in ('XSS', 'Injection', 'Auth', 'Session'))]
print(f'\nDAST demo picks (pygoat): {len(dast_pygoat)}')
for a in dast_pygoat:
    print(f"  {a['riskdesc']:20} {a['name']}")

with open('c:/Users/troyd/CLARA/CLARA/data/demo/dast_zap_pygoat.json', 'w') as f:
    json.dump({'alerts': trim_zap(dast_pygoat), '_meta': {'tool': 'zap', 'source': 'pygoat'}}, f, indent=2)

# ── DAST: Juice Shop ZAP full scan ──
with open('c:/Users/troyd/CLARA/CLARA/data/juice-shop/zap_report.json') as f:
    zap_js = json.load(f)
all_js_alerts = [a for s in zap_js.get('site', []) for a in s.get('alerts', [])]
dast_juiceshop = [a for a in all_js_alerts if not a.get('riskdesc', '').startswith('Informational')]
dast_juiceshop += [a for a in all_js_alerts if a.get('riskdesc', '').startswith('Informational')
                   and any(kw in a.get('name', '') for kw in ('XSS', 'Injection', 'Auth', 'Session'))]
print(f'\nDAST demo picks (juice-shop): {len(dast_juiceshop)}')
for a in dast_juiceshop:
    print(f"  {a['riskdesc']:20} {a['name']}")

with open('c:/Users/troyd/CLARA/CLARA/data/demo/dast_zap_juiceshop.json', 'w') as f:
    json.dump({'alerts': trim_zap(dast_juiceshop), '_meta': {'tool': 'zap', 'source': 'juice-shop', 'scan_type': 'full-scan'}}, f, indent=2)

print('\nDemo subset written to data/demo/')
