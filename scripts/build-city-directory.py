"""Build FIELD country shards from official GeoNames dumps (CC BY 4.0).

python3 scripts/build-city-directory.py work/geo public/geo/v1
Inputs: cities500.zip, alternateNamesV2.zip, admin1CodesASCII.txt, countryInfo.txt.
No user recordings or production database are read or changed.
"""
import hashlib
import io
import json
import pathlib
import sys
import unicodedata
import zipfile
from collections import defaultdict

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
regions = {}
native_languages = {}
for line in (source / 'countryInfo.txt').read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    fields = line.split('\t')
    native_languages[fields[0]] = fields[15].split(',')[0].split('-')[0]
for line in (source / 'admin1CodesASCII.txt').read_text().splitlines():
    fields = line.split('\t')
    regions[fields[0]] = fields[2]
cities = {}
with zipfile.ZipFile(source / 'cities500.zip') as archive:
    for line in io.TextIOWrapper(archive.open('cities500.txt'), encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        if f[6] != 'P' or not f[8]:
            continue
        # id, native, ASCII, aliases, latitude, longitude, population, region, names
        cities[f[0]] = [int(f[0]), f[1], f[2], list(dict.fromkeys([f[1], f[2], *f[3].split(',')])),
                         float(f[4]), float(f[5]), int(f[14] or 0), regions.get(f'{f[8]}.{f[10]}', ''), {}, f[8]]
scores = {}
languages = {'en': 'en', 'ru': 'ru', 'hy': 'hy', 'zh': 'zh', 'zh-TW': 'zh-TW', 'zh-Hant': 'zh-TW'}
with zipfile.ZipFile(source / 'alternateNamesV2.zip') as archive:
    for line in io.TextIOWrapper(archive.open('alternateNamesV2.txt'), encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        if len(f) < 8 or f[1] not in cities or f[7] == '1':
            continue
        city = cities[f[1]]
        native = f[2] == native_languages.get(city[-1])
        if f[2] not in languages and not native:
            continue
        language = languages.get(f[2], 'native')
        score = (f[4] == '1', f[2] == 'zh-Hant', -len(f[3]))
        key = (f[1], language)
        if key not in scores or score > scores[key]:
            city[8][language] = f[3]
            scores[key] = score
        if native and ((f[1], 'native') not in scores or score > scores[(f[1], 'native')]):
            city[8]['native'] = f[3]
            scores[(f[1], 'native')] = score
countries = defaultdict(list)
def normalize(value):
    chars = []
    latin = False
    for char in unicodedata.normalize('NFKD', value):
        if unicodedata.category(char).startswith('M'):
            if not latin:
                chars.append(char)
        else:
            latin = 'LATIN' in unicodedata.name(char, '')
            chars.append(char)
    return ' '.join(unicodedata.normalize('NFC', ''.join(chars)).lower().replace('ё', 'е').split())

for city in cities.values():
    country = city.pop()
    city[3] = list(dict.fromkeys([normalize(name) for name in [*city[3], *city[8].values()] if name]))
    countries[country].append(city)
for country, rows in countries.items():
    rows.sort(key=lambda row: (-row[6], row[0]))
    (target / f'{country}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n')
manifest = {'source': 'https://download.geonames.org/export/dump/', 'license': 'CC BY 4.0',
            'coverage': 'cities500: population > 500 or administrative seats; not every village',
            'cities': len(cities), 'countries': len(countries),
            'sha256': {name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                       for name in ['cities500.zip', 'alternateNamesV2.zip', 'admin1CodesASCII.txt', 'countryInfo.txt']}}
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Built {len(cities)} settlements in {len(countries)} country shards')
