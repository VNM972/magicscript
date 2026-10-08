import sqlite3, unicodedata, re

DB = 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite'

KEYWORDS = ['FRANCHISE','FRANCHISEE','RESEAU','NATIONAL','SUCCURSALE','SUCCURSALISTE','CHAINE']
GROUP_BRANDS = ['ATLANTIC']
STANDALONE = ['KFC','MCDONALD','BURGER KING','QUICK','SUBWAY','DOMINO S PIZZA','PIZZA HUT','O TACOS',
'BRIOCHE DOREE','COLUMBUS CAFE','CLASS CROUTE','POMME DE PAIN','BAGELSTEIN','DEL ARTE','BUFFALO GRILL',
'COURTEPAILLE','LEON DE BRUXELLES','HIPPOPOTAMUS','BIG FERNAND','NINKASI','JEAN LOUIS DAVID',
'FRANCK PROVOST','TCHIP COIFFURE','CAMILLE ALBANE','SAINT ALGUE','JACQUES DESSANGE','DESSANGE',
'BEAUTY SUCCESS','BODY MINUTE','YVES ROCHER','NOCIBE','MARIONNAUD','SEPHORA','CARREFOUR MARKET',
'CARREFOUR CONTACT','CARREFOUR CITY','LEADER PRICE','SUPER U','HYPER U','U EXPRESS','CASINO SHOP',
'MONOPRIX','FRANPRIX','PROXI','VIVAL','SPAR','8 A HUIT','BIOCOOP','NATURALIA','PICARD','LA VIE CLAIRE',
'KIABI','CELIO','JENNYFER','PIMKIE','CACHE CACHE','ETAM','UNDIZ','ORCHESTRA','VERTBAUDET','CHAUSSEA',
'GEMO','BESSON CHAUSSURES','FOOT LOCKER','INTERSPORT','DECATHLON','GO SPORT','BUREAU VALLEE','FNAC',
'DARTY','CONFORAMA','CUIR CENTER','OPTIC 2000','ALAIN AFFLELOU','AFFLELOU','KRYS','ATOL','GENERALE D OPTIQUE']

def norm(v):
    if not v: return ''
    s = unicodedata.normalize('NFD', str(v))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').upper()
    s = re.sub(r'[^A-Z0-9]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def hit(names):
    for name in names:
        n = norm(name)
        if not n: continue
        p = f' {n} '
        for kw in KEYWORDS:
            if f' {kw} ' in p: return kw
        if ' GROUPE ' in p:
            for b in GROUP_BRANDS:
                if f' {b} ' in p: return f'GROUPE {b}'
        for b in STANDALONE:
            if f' {b} ' in p: return b
    return None

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
con.row_factory = sqlite3.Row
rows = con.execute('select id, company_name, legal_name, state, entry_source from prospects order by company_name').fetchall()
print(f'Total prospects en base : {len(rows)}')
print()
hits = []
for r in rows:
    h = hit([r['company_name'], r['legal_name']])
    if h:
        hits.append((r['company_name'], r['state'], r['entry_source'], h))

print(f'Rejetes par le nouveau filtre : {len(hits)}')
print('-' * 100)
for c, st, src, h in hits:
    print(f'  {str(c)[:45]:45s} | {str(st):20s} | {str(src):12s} | {h}')
print()
print('Note : audit sur company_name + legal_name seulement (aliases non stockes).')
con.close()
