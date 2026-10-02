const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const countries=JSON.parse(html.match(/const countries=(\[.*?\]);\nconst CAPITALS=/s)[1]);
const list=name=>app.match(new RegExp(`const ${name}='([^']+)'`))[1].split(' ');
const easy=list('EASY'),hard=list('HARD'),medium=countries.map(c=>c.iso).filter(iso=>!easy.includes(iso)&&!hard.includes(iso));

assert.deepEqual([easy.length,medium.length,hard.length],[50,80,65]);
const assigned=[...easy,...medium,...hard];
assert.equal(assigned.length,195);
assert.equal(new Set(assigned).size,195);
assert.deepEqual(new Set(assigned),new Set(countries.map(c=>c.iso)));
for(const iso of ['FRA','ESP','ITA','GBR','USA','CAN','MEX','BRA','ARG','CHN','IND','JPN','RUS','AUS','NZL','EGY','ZAF'])assert(easy.includes(iso),`${iso} should be easy`);
for(const iso of ['TTO','VAT','MCO','KIR','TUV','MHL','VUT'])assert(hard.includes(iso),`${iso} should be hard`);

assert(!app.includes('drawGuessMarker'));
assert(!app.includes('answer-dot'));
assert(!app.includes('answer-line'));
assert.match(app,/function clearMarkers\(\)\{markers\.replaceChildren\(\)\}/);
assert.match(app,/else\{streak=0;(?:lastMissDistance=dist;)?\$\('#distanceRow'\)\.classList\.remove\('hidden'\)/);
assert.doesNotMatch(app,/project\(current\.lon|current\.lat\).*marker|drawMarkers/);

const functions=app.match(/function updatedStats[\s\S]*?(?=\nfunction formatAverage)/)[0];
const context={};vm.runInNewContext(`${functions};this.updatedStats=updatedStats`,context);
let stats={completed:0,clicks:0,firstClick:0};
stats=context.updatedStats(stats,1);stats=context.updatedStats(stats,2);stats=context.updatedStats(stats,3);
assert.deepEqual({...stats},{completed:3,clicks:6,firstClick:1});
assert.equal(stats.clicks/stats.completed,2);
assert.equal(Math.round(stats.firstClick/stats.completed*100),33);
assert.match(app,/localStorage\.setItem\(STATS_KEY,JSON\.stringify\(globalStats\)\)/);
assert.match(app,/sessionStats=\{completed:0,clicks:0,firstClick:0\}/);
assert.match(app,/Found in \$\{n\} \$\{n===1\?'click':'clicks'\}!/);
assert.match(app,/Trouvé en \$\{n\} \$\{n===1\?'clic':'clics'\} !/);
assert.match(app,/if\(answered\)renderResult\(\)/);
assert.match(app,/canTap=!cancelled&&pointers\.size===1&&!gesture\.moved&&!gesture\.pinched&&!gesture\.suppressTap/);
assert.match(app,/if\(country\)\{const\[x,y\]=clientToMap/);
assert.doesNotMatch(app,/guessFromPoint/);

// Every country has complete, independently addressable bilingual display data.
const capitals=JSON.parse(html.match(/const CAPITALS=(\{.*?\});\nconst EXTRA_FACTS=/s)[1]);
assert.equal(Object.keys(capitals).length,195);
assert.deepEqual(new Set(Object.keys(capitals)),new Set(countries.map(c=>c.iso)));
for(const country of countries){
  assert(country.name&&country.nameFr,`${country.iso}: missing bilingual country name`);
  assert(country.fact_en&&country.fact_fr,`${country.iso}: missing bilingual fact`);
  assert(capitals[country.iso].en&&capitals[country.iso].fr,`${country.iso}: missing bilingual capital`);
}

// Regression: Ukraine and other localized/special capital formulations use the requested language.
assert.deepEqual(capitals.UKR,{en:'Kyiv',fr:'Kiev'});
for(const [iso,en,fr] of [
  ['AUT','Vienna','Vienne'],
  ['CHN','Beijing','Pékin'],
  ['CYP','Nicosia','Nicosie'],
  ['GEO','Tbilisi','Tbilissi'],
  ['PRT','Lisbon','Lisbonne'],
  ['RUS','Moscow','Moscou'],
  ['SYR','Damascus','Damas'],
  ['UZB','Tashkent','Tachkent'],
  ['NLD','Amsterdam (constitutional); the government is based in The Hague','Amsterdam (constitutionnelle) ; le gouvernement siège à La Haye'],
  ['ZAF','Pretoria (executive), Cape Town (legislative), and Bloemfontein (judicial)','Pretoria (exécutif), Le Cap (législatif) et Bloemfontein (judiciaire)'],
  ['NRU','No official capital; the government is based in Yaren','Aucune capitale officielle ; le gouvernement siège à Yaren']
])assert.deepEqual(capitals[iso],{en,fr},`${iso}: incorrect localized capital`);

// Language changes redraw every dynamic part without selecting another fact.
assert.match(app,/if\(current\)\{renderRoundLabel\(\);\$\('#countryName'\)\.textContent=countryName\(current\);if\(answered\)renderResult\(\)/);
assert.match(app,/capital:'Capital:'/);
assert.match(app,/capital:'Capitale :'/);
assert.match(app,/current\.capital\[lang\]/);
assert.match(app,/fact\[lang\]/);
assert.match(app,/function currentFact\(\)\{return current&&currentFactIndex!==null\?current\.facts\[currentFactIndex\]:null\}/);
const applyLangSource=app.match(/function applyLang[\s\S]*?(?=\nfunction selectFact)/)[0];
assert.doesNotMatch(applyLangSource,/selectFact\(/);
assert.match(app,/else if\(lastMissDistance!==null\)renderDistance\(lastMissDistance\)/);
assert.match(app,/languageLabel:'Langue'/);
assert.match(app,/mapLabel:'Carte du monde interactive'/);

// The duplicate record indicator is gone while the current streak remains intact.
const interfaceHtml=html.slice(0,html.indexOf('<script>'));
assert.doesNotMatch(interfaceHtml,/\brecord\b/i);
assert.doesNotMatch(app,/\brecord\b|#best|wg-best/i);
assert.match(interfaceHtml,/id="streak"/);
assert.match(app,/if\(success\)\{answered=true;streak\+\+/);
assert.match(app,/else\{streak=0;/);

// Norway uses its real, clickable geometry; only the other artificial markers remain.
const norwayPaths=[...html.matchAll(/<path class="country-shape"[^>]*data-name="Norway"[^>]*data-iso="NOR"[^>]*d="([^"]+)"[^>]*>/g)];
assert.equal(norwayPaths.length,1);
assert.match(norwayPaths[0][1],/^M[\d., LZ]+ M/,'Norway should contain multiple geographic parts');
assert.doesNotMatch(html,/<circle class="country-shape microstate"[^>]*data-iso="NOR"/);
assert.match(app,/const country=ended\.target\.closest\('\.country-shape'\);if\(country\).*guessFromCountry\(country,x,y\)/);
assert.match(app,/function guessFromCountry\(el,x,y\).*el\.dataset\.iso/);
assert.match(app,/function nearestBoundaryDistanceKm\(lat,lon,c\)\{const path=svg\.querySelector\(`\.country-shape\[data-iso="\$\{c\.iso\}"\]`\).*path\.getTotalLength\(\).*path\.getPointAtLength\(d\)/);

// Artificial microstate markers stay geographically precise and never overlap each other.
const microstates=[...html.matchAll(/<circle class="country-shape microstate"[^>]*data-iso="([^"]+)"[^>]*cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)].map(([,iso,cx,cy,r])=>({iso,cx:Number(cx),cy:Number(cy),r:Number(r)}));
assert.equal(microstates.length,29);
assert(!microstates.some(({iso})=>iso==='NOR'));
for(const microstate of microstates)assert.equal(microstate.r,0.25,`${microstate.iso}: oversized artificial hit area`);
for(let i=0;i<microstates.length;i++)for(let j=i+1;j<microstates.length;j++){
  const a=microstates[i],b=microstates[j];
  assert(Math.hypot(a.cx-b.cx,a.cy-b.cy)>a.r+b.r,`${a.iso}/${b.iso}: overlapping artificial hit areas`);
}

console.log('Tous les tests GeoFact sont réussis.');
