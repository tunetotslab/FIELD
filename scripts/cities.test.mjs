import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directoryMatches,normalizeCitySearch} from '../server/city-directory.mjs';
const catalogue=country=>JSON.parse(readFileSync(new URL(`../public/geo/v1/${country}.json`,import.meta.url)));
const thai=catalogue('TH');
for(const query of ['Пх','Пху','PHU','ภู']) {
  const city=directoryMatches(thai,query,'TH','ru').find(city=>city.placeId==='geonames:1151254');
  assert.ok(city,query);
  assert.equal(city.city,'Пхукет');assert.equal(city.englishCity,'Phuket');assert.equal(city.nativeCity,'ภูเก็ต');
  assert.equal(city.countryCode,'TH');
}
for(const query of ['Ба','Ban','กรุ'])
  assert.ok(directoryMatches(thai,query,'TH','en').some(city=>city.placeId==='geonames:1609350'),query);
assert.equal(directoryMatches(thai,'P','TH').length,0);
assert.equal(directoryMatches(thai,'Phu','TH','en')[0].city,'Phuket');
assert.equal(directoryMatches(thai,'Phu','TH','hy')[0].city,'Phuket','Missing translation falls back to English');
for(const query of ['Ye','Ер','Եր']) {
  const city=directoryMatches(catalogue('AM'),query,'AM','ru').find(city=>city.placeId==='geonames:616052');
  assert.ok(city,query);assert.equal(city.countryCode,'AM');
}
assert.equal(normalizeCitySearch(' São '),'sao');
assert.equal(normalizeCitySearch('ภูเก็ต'),'ภูเก็ต','Thai vowels and tone marks must survive normalization');
assert.ok(directoryMatches(catalogue('JP'),'東京','JP','en').length);
assert.ok(!directoryMatches(catalogue('AM'),'Phu','AM','ru').some(city=>city.placeId==='geonames:1151254'));
console.log('PASS real GeoNames 2/3-letter Latin/Cyrillic/Thai/Armenian/Japanese prefixes, country isolation, stable IDs, RU/EN/native labels and English fallback');
