# SlovakGO — Course Architecture v2 (A0 → C2)

**Status:** canonical plan for the generated course in `lessons/` (sources: `curriculum/course/src`).
**Size:** 102 units × 10 lessons = **1020 lessons**.
**Learner:** Ukrainian speaker living/moving to Slovakia; support language Ukrainian, target Slovak.
**Principle:** every unit is a real-life domain + a grammar/function spine. Lesson 10 of each unit
is an integrative review (new vocabulary limited to 4–6 items).

## Runtime decisions (evidence-based)

| Decision | Evidence |
|---|---|
| A0 lessons use `level: "A0"` | `UserLevel` and `lessonService.levels` start at A0; new users start at A0 (`api/_lib/auth.ts`). **The JSON Schema `level` enum lacks `A0`** — A0 files are validated with that enum widened (see `validate.py`). Recommended one-line schema fix: add `"A0"` to the enum. |
| C2 lessons use `level: "C1"`, `sectionId: c2-uXX`, eyebrow `C2 · …` | The app has no C2 track; `placementTestService.toCourseLevel("C2") === "C1"`. C2 lessons follow the C1 lessons in `order`. |
| No listening mechanics | No audio assets and no TTS in runtime (`useAudioPlayer` plays files only). |
| `topic` = unit topic | `PathScreen` groups consecutive lessons by `topic` and locks topic groups. |
| Ukrainian only (`localization.uiLanguages: ["uk"]`) | Contract: learner-facing support language is Ukrainian. |
| Exercise density | A0 12–13, A1–A2 13–15, B1+ 14–16 exercises + 4-step final situation. |

## Level map

| Level | Units | Lessons | Focus |
|---|---|---|---|
| A0 | 6 | 60 | sounds, reading, survival phrases, numbers, first needs |
| A1 | 18 | 180 | be/have, gender, present tense, accusative/locative basics, daily life, past & future intro |
| A2 | 20 | 200 | all cases in practice, aspect intro, imperative, conditional, bureaucracy & services |
| B1 | 20 | 200 | work, housing, health, complaints; relative/conditional clauses, reported speech, passive |
| B2 | 18 | 180 | formal writing, argument, law & economy, participles, word formation, phraseology |
| C1 | 12 | 120 | functional styles, academic/legal/business language, implicature, cohesion, mediation |
| C2 | 8 | 80 | norm & codification, stylistic virtuosity, humour, rhetoric, dialects, mastery tasks |

## Units and lesson plans

### A0 — Перші кроки
- **a0-u01 Абетка і звуки** — абетка; голосні й довгота; č š ž dž; ď ť ň ľ і правило м’якості; h/ch/dz; ä ô і дифтонги; складові r l, i/y; вивіски; числа 0–10; підсумок: читаю місто.
- **a0-u02 Привітання і ввічливість** — dobrý deň / ahoj; привітання за часом доби; прощання; prosím / ďakujem / nech sa páči; prepáčte / pardon; áno / nie / možno; ty чи vy; ako sa máte; nerozumiem / pomalšie; підсумок: перша розмова.
- **a0-u03 Знайомство** — volám sa; som z Ukrajiny; národnosť; kde bývaš; hovorím po…; koľko máš rokov (0–10+); профеcії-базово; hláskovanie mena; kontakt: telefón, e-mail; підсумок: анкета й знайомство.
- **a0-u04 Числа, ціни, час** — 11–20; десятки; ceny a eurá; koľko to stojí; koľko je hodín; dni v týždni; mesiace; dátum; telefónne čísla; підсумок: каса й розклад.
- **a0-u05 Виживання в місті** — kde je…; vľavo / vpravo / rovno; obchod a služby; toalety; lístok a doprava; potrebujem; mám / nemám; chcem / nechcem; pomoc a núdza; підсумок: орієнтуюся в місті.
- **a0-u06 Перші потреби** — základné potraviny; farby; rodina (základ); telo a bolesť; dnes / zajtra / včera; počasie (základ); v kaviarni (základ); v lekárni (základ); tiesňové volanie 112; підсумок A0.

### A1 — Базовий рівень
- **a1-u01 Я і ти: byť** — ja som / ty si; on, ona, ono; my, vy, oni; zápor nie som; otázky je…?; kto je to / čo je to; povolania s byť; vlastnosti s byť; tu / tam / doma; підсумок.
- **a1-u02 Родина: mať і присвійні** — mať; môj / moja / moje; tvoj, jeho, jej; náš, váš, ich; rodičia a súrodenci; širšia rodina; vek; manželstvo a vzťahy; opis rodiny; підсумок.
- **a1-u03 Рід і число іменників** — rod mužský; ženský; stredný; ten / tá / to; množné číslo muž. neživ.; žen. a stred.; muž. živ.; toto / tamto; nepravidelné tvary; підсумок.
- **a1-u04 Прикметники й опис людей** — zhoda prídavného mena; farby; vzhľad; povaha; opak (veľký – malý); aký / aká / aké; veľmi, dosť, trochu; opis kamaráta; oblečenie a farby; підсумок.
- **a1-u05 Житло** — byt a izby; nábytok; kde je čo (na, v, pod, nad); v kuchyni; v kúpeľni; adresa; poschodie; susedia; môj byt; підсумок.
- **a1-u06 Дієслова в теперішньому часі** — typ robiť (-ím); typ volať (-ám); typ niesť (-em); typ pracovať (-ujem); nepravidelné: ísť, chcieť, môcť; zápor; otázky áno/nie; opytovacie slová; frekvencia; підсумок.
- **a1-u07 Мій день** — ráno; zvratné sa / si; o koľkej; hodiny a pol, štvrť; práca a škola; obed; popoludnie; večer; víkend; підсумок.
- **a1-u08 Їжа і знахідний відмінок** — akuzatív žen.; muž. neživ. a stred.; muž. živ.; raňajky; obed; večera; ovocie a zelenina; nápoje; mám rád / chutí mi; підсумок.
- **a1-u09 У магазині й на ринку** — množstvo: kilo, liter, balenie; koľko; genitív po číslovkách 5+; v supermarkete; na trhu; pri pokladni; platba; zľavy a akcie; reklamácia (základ); підсумок.
- **a1-u10 Місто й орієнтація (місцевий відмінок)** — lokál: v, na; miesta v meste; ako sa dostanem; ďaleko / blízko; mapa; budovy a inštitúcie; v banke (základ); na pošte (základ); prechádzka mestom; підсумок.
- **a1-u11 Транспорт** — ísť / chodiť; ísť autobusom (inštrumentál); lístok a cestovný poriadok; na stanici; vlak; taxík a aplikácie; auto a parkovanie; bicykel; meškanie; підсумок.
- **a1-u12 Робота і професії** — povolania; kde pracuješ; pracovný čas; kolegovia; úlohy v práci; zamestnávateľ; plat (základ); telefón v práci; môj pracovný deň; підсумок.
- **a1-u13 Вільний час** — rád + sloveso; šport; hrať (na) čo; hudba a film; čítanie; stretnutie s priateľmi; pozvanie; odmietnutie; víkendové plány; підсумок.
- **a1-u14 Погода і пори року** — ročné obdobia; aké je počasie; teplota; predpoveď; oblečenie podľa počasia; mesiace a sviatky; príroda; dážď a sneh; výlet; підсумок.
- **a1-u15 Здоров’я A1** — telo; bolí ma; u lekára; objednanie; v lekárni; lieky; choroby; rady lekára; PN (základ); підсумок.
- **a1-u16 Одяг і покупки** — oblečenie; veľkosti; farby a materiály; v obchode s oblečením; skúšobná kabínka; páči sa mi; obuv; vrátenie tovaru; výpredaj; підсумок.
- **a1-u17 Минулий час** — bol som; minulý čas -l; ženský a stredný rod; množné číslo; zápor; včera; minulý víkend; dovolenka; životopis (základ); підсумок.
- **a1-u18 Майбутнє і плани** — budem + inf.; pôjdem / prídem; zajtra a budúci týždeň; plány; sľuby; predpoveď; rezervácia; pozvanie na oslavu; plán na rok; підсумок A1.

### A2 — Передсередній рівень
- **a2-u01 Знахідний відмінок у практиці** — prehľad; osobné zámená (ma, ťa, ho); prídavné mená v akuzatíve; predložky s akuzatívom; na + akuz. (smer); cez, pre, za; časové výrazy; hľadám…; potrebujem…; підсумок.
- **a2-u02 Родовий відмінок** — genitív jednotného čísla; bez, do, z, od, u; zápor s genitívom (nemám…); množstvo; genitív množného čísla; dátumy; vlastníctvo (auto kamaráta); z Ukrajiny do Slovenska; recepty; підсумок.
- **a2-u03 Давальний відмінок** — komu; osobné zámená (mi, ti, mu); páči sa mi; chutí mi; pomôcť, zavolať, poďakovať; k, proti, vďaka; darčeky; narodeniny; blahoželanie; підсумок.
- **a2-u04 Місцевий відмінок і місце** — lokál jednotného čísla; lokál množného čísla; o čom; po meste; pri, v, na, o; kde bývaš presne; v práci / na úrade; rozprávanie o meste; opis bytu podrobne; підсумок.
- **a2-u05 Орудний відмінок** — s kým; čím (nožom, autobusom); s, pred, za, nad, pod, medzi; stať sa kým; byť spokojný s…; zámená (so mnou); jedlo s…; stretnutie s…; povolania (chcem byť…); підсумок.
- **a2-u06 Вид дієслова** — nedokonavý vs dokonavý; dvojice robiť/urobiť; písať/napísať; minulosť: proces vs výsledok; budúcnosť: budem robiť vs urobím; príkazy; časté dvojice; príbeh; chyby; підсумок.
- **a2-u07 Легалізація і úrad** — prechodný pobyt; cudzinecká polícia; doklady; formulár; termín na úrade; ohlásenie pobytu; potvrdenie; poplatky; čakáreň; підсумок.
- **a2-u08 Оренда житла** — inzerát; prehliadka bytu; nájomná zmluva; záloha; energie; správca; poruchy; susedské pravidlá; sťahovanie; підсумок.
- **a2-u09 Банк і платежі** — účet; karta; IBAN a prevod; bankomat; internetbanking; poplatky; výpis; problém s kartou; platba faktúry; підсумок.
- **a2-u10 Пошта, посилки, кур’єри** — list a balík; podanie balíka; sledovanie zásielky; kuriér; výdajné miesto; oznámenie; colné poplatky; reklamácia zásielky; adresa správne; підсумок.
- **a2-u11 Страхування і лікар** — zdravotná poisťovňa; preukaz poistenca; všeobecný lekár; registrácia u lekára; odporúčanie k špecialistovi; recept; pohotovosť; zubár; lekáreň podrobne; підсумок.
- **a2-u12 Пошук роботи** — inzeráty; typy úväzkov; životopis; motivačný list; telefonát zamestnávateľovi; pohovor (základ); zručnosti; referencie; úrad práce; підсумок.
- **a2-u13 На робочому місці** — zmeny a smeny; nadriadený; pravidlá BOZP; prestávka; dovolenka; problém v práci; kolegovia; porada (základ); výplatná páska; підсумок.
- **a2-u14 Діти: школа і садок** — škôlka; zápis do školy; triedny učiteľ; rodičovské združenie; žiacka knižka; krúžky; ospravedlnenka; školský obed; prázdniny; підсумок.
- **a2-u15 Телефон і повідомлення** — telefonovanie; odkaz; SMS a chat; e-mail neformálny; e-mail formálny (základ); dohodnutie termínu; zrušenie; nedorozumenie; operátor; підсумок.
- **a2-u16 Подорожі Словаччиною** — vlak a IC; autobus; ubytovanie; recepcia; turistické miesta; hory a Tatry; kúpele; hrady; problém na cestách; підсумок.
- **a2-u17 Порівняння** — komparatív; superlatív; nepravidelné (lepší, horší); ako / než; príslovky (rýchlejšie); porovnanie cien; porovnanie miest; najlepší výber; recenzie; підсумок.
- **a2-u18 Наказовий спосіб** — rozkazovací spôsob ty; vy; my (poďme); zápor; zdvorilé príkazy; návody; recepty; rady; nápisy a pokyny; підсумок.
- **a2-u19 Умовний спосіб і ввічливість** — by som chcel; mohli by ste; bolo by dobré; želania; ponuky; rady (na tvojom mieste by som); zdvorilé žiadosti na úrade; v reštaurácii; hypotézy (základ); підсумок.
- **a2-u20 Розповіді про минуле** — rozprávanie; časové spojky (keď, potom, nakoniec); príhody; zážitky; nehoda; stratené veci; zmeny v živote; môj príchod na Slovensko; list priateľovi; підсумок A2.

### B1 — Середній рівень
- **b1-u01 Кафе й ресторан** — objednávka; odporúčanie; alergény; rezervácia; sťažnosť; účet a sprepitné; diéty; stretnutie s kolegami; hodnotenie reštaurácie; підсумок.
- **b1-u02 Úrad II: заяви й форми** — žiadosť; čestné vyhlásenie; splnomocnenie; overenie podpisu; živnostenský register (základ); daňový úrad (základ); lehoty; odvolanie; komunikácia s úradníkom; підсумок.
- **b1-u03 Співбесіда** — príprava; predstavenie sa; silné a slabé stránky; skúsenosti; otázky zamestnávateľa; otázky uchádzača; mzda; skúšobná doba; odpoveď po pohovore; підсумок.
- **b1-u04 Трудове право** — pracovná zmluva; dohoda; výpovedná lehota; dovolenka; PN a nemocenská; nadčasy; mzda a odvody; výpoveď; inšpektorát práce; підсумок.
- **b1-u05 Проблеми з житлом** — porucha a oprava; susedia a hluk; správca a spoločenstvo; reklamácia služieb; vyúčtovanie; zmluva a jej ukončenie; poistenie domácnosti; škoda; dohoda; підсумок.
- **b1-u06 Здоров’я B1** — príznaky podrobne; špecialisti; vyšetrenia; nemocnica; operácia; pohotovosť a záchranka; duševné zdravie; prevencia; zdravý životný štýl; підсумок.
- **b1-u07 Покупки й рекламації** — reklamácia; záruka; vrátenie peňazí; e-shop; doručenie; spotrebiteľské práva; podvody; recenzie; porovnanie ponúk; підсумок.
- **b1-u08 Медіа і новини** — správy; titulky; počasie a doprava v správach; rozhlas; sociálne siete; fake news; komentár; rozhovor; správa o udalosti; підсумок.
- **b1-u09 Стосунки й почуття** — pocity; priateľstvo; láska; konflikt; ospravedlnenie; podpora; blahoželanie a sústrasť; rodinné udalosti; hranice; підсумок.
- **b1-u10 Освіта й курси** — vzdelávací systém; jazykové kurzy; rekvalifikácia; štúdium na VŠ; prihláška; skúšky; online vzdelávanie; certifikáty; motivácia; підсумок.
- **b1-u11 Дієслова руху з префіксами** — ísť a predpony (prísť, odísť, vojsť, vyjsť); prejsť, obísť, zísť; niesť/nosiť; viezť/voziť; ísť vs chodiť; smer vs pohyb; v meste; na túre; opis cesty; підсумок.
- **b1-u12 Відносні речення** — ktorý; čo; kde, kam, odkiaľ; kto; aký; čiarky; spájanie viet; definície; opis ľudí a vecí; підсумок.
- **b1-u13 Умовні речення** — ak; keď; keby (reálne vs nereálne); keby som bol; minulý kondicionál; rady; sny a želania; podmienky v zmluve; hypotézy; підсумок.
- **b1-u14 Непряма мова** — povedal, že; spýtal sa, či; opytovacie vety; rozkazy (aby); posun času; správy od kolegov; odovzdanie odkazu; dialógy; citácie; підсумок.
- **b1-u15 Пасив** — trpný rod (je otvorený); zvratný pasív (predáva sa); neosobné vety; úradné texty; návody; oznamy; výroba a procesy; správy; transformácie; підсумок.
- **b1-u16 Культура і традиції** — Vianoce; Veľká noc; fašiangy a jarmoky; ľudová kultúra; sviatky a voľné dni; gastronómia; osobnosti; zvyky v spoločnosti; Slovensko a Ukrajina; підсумок.
- **b1-u17 Природа і туризм** — hory; turistické značenie; bezpečnosť na horách; Horská záchranná služba; počasie na horách; jaskyne a národné parky; ochrana prírody; kemping; cykloturistika; підсумок.
- **b1-u18 Технології** — počítač a mobil; internet a pripojenie; aplikácie; online bezpečnosť; e-government (slovensko.sk); technická podpora; nákupy online; digitálne dokumenty; umelá inteligencia; підсумок.
- **b1-u19 Фінанси** — rodinný rozpočet; dane (základ); daňové priznanie; úver a pôžička; sporenie; poistenie; dôchodok; faktúry; finančné podvody; підсумок.
- **b1-u20 Думка й аргумент** — vyjadrenie názoru; súhlas a nesúhlas; argumenty pre a proti; príklady; kompromis; diskusia; esej (základ); spojky (preto, pretože, hoci); závery; підсумок B1.

### B2 — Вище середнього
- **b2-u01 Офіційне листування** — štruktúra úradného listu; oslovenie a záver; žiadosť; sťažnosť; odvolanie; ospravedlnenie; potvrdenie a pripomienka; výpoveď; e-mail úradu; підсумок.
- **b2-u02 Наради і робочі e-maily** — pozvánka; program porady; zápisnica; delegovanie; spätná väzba; termíny a priority; eskalácia; prezentácia výsledkov; networking; підсумок.
- **b2-u03 Дискусія та аргументація** — štruktúra argumentu; protiargument; ústupok; zdôraznenie; zjemnenie (hedging); logické spojky; debata; moderovanie; zhrnutie; підсумок.
- **b2-u04 Суспільні теми** — migrácia a integrácia; demografia; rovnosť; bývanie a ceny; vzdelanie a nerovnosť; dobrovoľníctvo; mestá a vidiek; generácie; tolerancia; підсумок.
- **b2-u05 Право і права споживача** — právny systém; zmluvy; spotrebiteľské spory; SOI; súdy; advokát; exekúcia; ochrana údajov (GDPR); právna pomoc; підсумок.
- **b2-u06 Економіка і бізнес** — živnosť; s. r. o.; podnikateľský plán; faktúrácia a DPH; účtovníctvo; marketing; zákazníci; konkurencia; inflácia; підсумок.
- **b2-u07 Система охорони здоров’я** — systém; poisťovne; čakacie lehoty; práva pacienta; informovaný súhlas; prevencia a skríning; zdravotná reforma; lieky a doplatky; kúpeľná liečba; підсумок.
- **b2-u08 Освіта і визнання дипломів** — nostrifikácia; uznanie kvalifikácie; vysoké školy; štipendiá; doktorandské štúdium; celoživotné vzdelávanie; hodnotenie; akademická etika; kariérny rast; підсумок.
- **b2-u09 Довкілля** — klimatická zmena; odpad a triedenie; energetika; voda; doprava a emisie; ochrana prírody; ekologické správanie; aktivizmus; riešenia; підсумок.
- **b2-u10 Публічна влада** — štátne zriadenie; voľby; parlament a vláda; samospráva; referendum; občianske práva; verejná správa; petícia; neutrálne vyjadrovanie; підсумок.
- **b2-u11 Медіаграмотність** — typy médií; titulky a clickbait; overovanie faktov; manipulatívne techniky; zdroje; reklama; štatistiky v médiách; názor vs fakt; mediálny prejav; підсумок.
- **b2-u12 Дієприкметники й номіналізація** — činné príčastia (pracujúci); trpné príčastia (napísaný); prechodník; zhustenie vety; nominalizácia (rozhodnutie); úradný štýl; odborné texty; transformácie; štylistická voľba; підсумок.
- **b2-u13 Фразеологія I** — frazeologizmy s telom; so zvieratami; s jedlom; s farbami; príslovia; porekadlá; prirovnania; ekvivalenty v ukrajinčine; použitie v kontexte; підсумок.
- **b2-u14 Розмовна словацька** — hovorové výrazy; skratky a skrátené tvary; citoslovcia; časticové výrazy (veď, však, predsa); regionálne rozdiely; mládežnícky slang; zdrobneniny; neformálne písanie; porozumenie rýchlej reči; підсумок.
- **b2-u15 Наука й техніка** — vedecké objavy; výskum; popularizácia; technológie budúcnosti; energetika; medicína; IT a dáta; etika vedy; správa o výskume; підсумок.
- **b2-u16 Мистецтво, література, кіно** — výtvarné umenie; divadlo; film a recenzia; literatúra; hudba; múzeá; kritika; interpretácia; kultúrne podujatia; підсумок.
- **b2-u17 Словотвір** — predpony slovies; prípony podstatných mien; prípony prídavných mien; zdrobneniny a zveličeniny; skladanie slov; odvodzovanie profesií; abstraktné pojmy; internacionalizmy; rodiny slov; підсумок.
- **b2-u18 Презентації й виступи** — štruktúra prezentácie; úvod; prechody; práca s dátami; záver; otázky publika; argumentačný prejav; neverbálna komunikácia; hodnotenie prejavu; підсумок B2.

### C1 — Просунутий
- **c1-u01 Функціональні стилі** — prehľad štýlov; hovorový; publicistický; odborný; administratívny; umelecký; rečnícky; miešanie štýlov; štylistická analýza; підсумок.
- **c1-u02 Академічне письмо** — štruktúra odbornej práce; abstrakt; citovanie a parafráza; argumentácia; hedging; terminológia; recenzia; plagiátorstvo; prezentácia výskumu; підсумок.
- **c1-u03 Правова та урядова мова** — zákony a vyhlášky; právne termíny; zmluvné klauzuly; rozhodnutie a odôvodnenie; správne konanie; lehoty a opravné prostriedky; súdne podanie; notár; výklad textu; підсумок.
- **c1-u04 Ділові переговори** — príprava; otvorenie; ponuka a protiponuka; ústupky; tlak a odmietnutie; dohoda; zmluvné podmienky; interkultúrne rozdiely; e-mail po rokovaní; підсумок.
- **c1-u05 Публіцистика і коментар** — úvodník; komentár; glosa; fejtón; rozhovor; recenzia; argumentačné stratégie; rétorické otázky; irónia v publicistike; підсумок.
- **c1-u06 Фразеологія II** — idiomy v práci; v politike; v emóciách; biblické a antické frazémy; frazeologická obmena; hovorové idiomy; falošní priatelia; preklad idiomov; štylistické využitie; підсумок.
- **c1-u07 Імплікатура та іронія** — nepriamy význam; zdvorilostné stratégie; irónia; sarkazmus; podtext; eufemizmy; náznaky v práci; kritika medzi riadkami; humor; підсумок.
- **c1-u08 Синтаксис і порядок слів** — aktuálne členenie vety; slovosled a dôraz; príklonky; zložené súvetie; vsuvky; elipsa; nominálne konštrukcie; interpunkcia; štylistika vety; підсумок.
- **c1-u09 Фахова комунікація** — zdravotníctvo; IT; stavebníctvo; logistika; financie; pedagogika; sociálna práca; gastronómia a hotelierstvo; odborná správa; підсумок.
- **c1-u10 Література та культурний контекст** — ľudová slovesnosť; štúrovci; realizmus; medzivojnová literatúra; povojnová a súčasná próza; poézia; dráma; film a literatúra; slovensko-ukrajinské kultúrne väzby; підсумок.
- **c1-u11 Дискурс і когезія** — konektory; odkazovanie (anafora); tematická progresia; odseky; zhrnutie a parafráza; kontrast a koncesia; rámcovanie; metatext; súdržný text; підсумок.
- **c1-u12 Медіація і переклад** — sprostredkovanie informácií; tlmočenie v bežných situáciách; preklad úradného textu; kalky z ukrajinčiny; falošní priatelia; zhrnutie pre tretiu osobu; zjednodušenie textu; interkultúrne vysvetlenie; kvalita prekladu; підсумок C1.

### C2 — Майстерність (публікується на треку C1)
- **c2-u01 Норма і кодифікація** — kodifikačné príručky; pravopisné jemnosti; veľké písmená; spojovník a pomlčka; interpunkcia náročná; skloňovanie cudzích slov; kolísanie tvarov; jazyková kultúra; jazykové poradne; підсумок.
- **c2-u02 Стилістична віртуозність** — zmena registra; parafráza v rôznych štýloch; zhusťovanie a rozvádzanie; štylistická hodnota slov; archaizmy a knižné výrazy; expresivita; eufemizácia; štylizácia postáv; vlastný štýl; підсумок.
- **c2-u03 Гумор і гра слів** — slovné hry; dvojzmysly; vtipy a anekdoty; satira; paródia; kalambúry; humor v reklame; kultúrne narážky; nepreložiteľné; підсумок.
- **c2-u04 Риторика** — rétorické figúry; tropy; argumentačné klamy; presvedčovanie; príhovor; slávnostný prejav; debata na vysokej úrovni; rétorika v politike; analýza prejavu; підсумок.
- **c2-u05 Високі фахові тексти** — súdne rozhodnutia; odborné posudky; vedecké štúdie; normy a štandardy; zmluvy na vysokej úrovni; auditné správy; strategické dokumenty; kritická recenzia; syntéza zdrojov; підсумок.
- **c2-u06 Літературна мова** — básnický jazyk; metafora v próze; rozprávač a perspektíva; archaický jazyk; neologizmy; intertextualita; preklad literatúry; interpretácia; tvorivé písanie; підсумок.
- **c2-u07 Діалекти, сленг, покоління** — nárečové oblasti; západoslovenské nárečia; stredoslovenské nárečia; východoslovenské nárečia; slang mladých; profesijný žargón; internetový jazyk; jazyk generácií; jazykové postoje; підсумок.
- **c2-u08 Майстерність: комплексні завдання** — mediácia zložitého textu; kritická analýza; argumentácia bez prípravy; štylistická transformácia; odborná diskusia; úradná komunikácia bez chýb; kultúrna kompetencia; interpretácia implicitného; jazykové jemnosti; záverečný test C2.
