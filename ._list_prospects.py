import json
with open('._prospects.json') as f:
    data = json.load(f)
for p in data.get('prospects', []):
    print(f"{p['id'][:8]}.. | {p['companyName'][:28]:28s} | state={p['state'][:15]:15s} | score={p.get('score','N/A')} | website={str(p.get('websiteUrl','N/A'))[:45]}")
