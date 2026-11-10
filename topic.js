/* topic.js: all the JavaScript shared by the study guide (topic) pages.

   Load it once at the bottom of a topic page:
     <script src="../topic.js" defer></script>

   Each part switches itself on only if its markup is on the page, so every topic page
   can load the same file.

   1. KEY TERMS     fills <div class="key-terms" data-topic="1.6" data-src="/terms.json"> from terms.json.
   2. PRACTICE HUB  fills the live counts on <div class="practice-hub" data-topic="0.1" data-unit="0">.
   3. CONTENTS      highlights the current section in the "On this page" list as you scroll. */

/* ---------- 1. Key terms ----------
   Matches every entry whose "topic" equals data-topic, drops duplicate terms (case-insensitive),
   sorts A to Z, and shows 12 or fewer as chips and more than that as columns. If terms.json can't be
   loaded (or has nothing for the topic), the block quietly keeps its fallback text and Glossary button. */
(function () {
    function render(block, terms) {
        var list = block.querySelector('[data-terms-list]');
        var intro = block.querySelector('[data-terms-intro]');

        list.className = terms.length <= 12 ? 'term-chips' : 'term-columns';
        list.textContent = '';
        terms.forEach(function (t) {
            var li = document.createElement('li');
            li.textContent = t;
            list.appendChild(li);
        });

        if (intro) {
            var count = document.createElement('span');
            count.className = 'term-count';
            count.textContent = terms.length + (terms.length === 1 ? ' term' : ' terms');
            intro.textContent = '';
            intro.appendChild(document.createTextNode('The glossary has '));
            intro.appendChild(count);
            intro.appendChild(document.createTextNode(
                " for this topic. If you can't explain one in your own words, look it up in the Glossary."));
        }
    }

    function init(block) {
        var topic = block.getAttribute('data-topic');
        var src = block.getAttribute('data-src') || '/terms.json';
        if (!topic || !block.querySelector('[data-terms-list]')) return;

        fetch(src)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var all = Array.isArray(data) ? data : (data.terms || []);
                var seen = {};
                var terms = [];
                all.forEach(function (item) {
                    if (String(item.topic) !== topic) return;
                    var t = String(item.term || '').trim();
                    var key = t.toLowerCase();
                    if (!t || seen[key]) return;
                    seen[key] = true;
                    terms.push(t);
                });
                if (!terms.length) return;
                terms.sort(function (a, b) {
                    return a.localeCompare(b, undefined, { sensitivity: 'base' });
                });
                render(block, terms);
            })
            .catch(function () { /* keep the fallback text and button */ });
    }

    function start() { Array.prototype.forEach.call(document.querySelectorAll('.key-terms[data-topic]'), init); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---------- 2. Practice hub ----------
   Fills a topic page's "Practice This Topic" section from the site's own data files.
   Markup contract:
     <div class="practice-hub" data-topic="0.1" data-unit="0" data-base="/" data-root="../">
        ...top row:   .ph-card.ph-topic[data-tool="quick|flashcards|quiz"]  (static cards, counts filled in here)
        ...mix row:   <div class="ph-grid cols-4" data-mix-grid></div>       (only on the last three topics of a unit)
     </div>
   The mix row is optional: a page without it just shows the top row. Add data-mix="unit" to the hub on an
   end-of-unit page so every game reviews the whole unit (Word Search switches from this topic to the unit,
   and the per-card scope labels are dropped because the section already says so).
   Optional: data-tools="pairs,battleship,..." pins a page's mix; otherwise each page gets its own shuffle
   of the games, so neighbouring pages don't match. A game only appears when it has real content. */
(function () {
    var hub = document.querySelector('.practice-hub');
    if (!hub) return;
    var topic = hub.dataset.topic, unit = String(hub.dataset.unit), base = hub.dataset.base || '/', root = hub.dataset.root || '../';
    var MIX_SIZE = 4;

    function get(name) {
        return fetch(base + name).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }).catch(function () { return null; });
    }
    function list(d) { return Array.isArray(d) ? d : (d && Object.keys(d).map(function (k) { return d[k]; }).filter(Array.isArray)[0]) || []; }
    function unitOf(x) { return String(x.unit).replace(/^Unit\s*/i, '').trim(); }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function pill(el, text) {                       // "71 pairs" -> <b>71</b> pairs
        var parts = text.split(' ');
        el.innerHTML = '';
        var b = document.createElement('b'); b.textContent = parts[0];
        el.appendChild(b); el.appendChild(document.createTextNode(' ' + parts.slice(1).join(' ')));
    }
    // same rule the Word Search page uses: letters only, 4 or more, fits a 15 x 15 grid, no duplicates
    function usableWords(terms) {
        var seen = {}, n = 0;
        terms.forEach(function (t) {
            var w = String(t.term || '').replace(/\(.*?\)/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
            if (w.length >= 4 && w.length <= 15 && !seen[w]) { seen[w] = 1; n++; }
        });
        return n;
    }

    // ---- The catalog: one entry per game. To add a game, add an entry here. ----
    // scope: 'unit' (whole unit) or 'topic' (this topic only). count(d) returns { n, text } or null when there is nothing to offer.
    var CATALOG = [
        { id: 'quilt', icon: '\uD83E\uDDE9', title: 'Piece of Mind', scope: 'unit', cta: 'Play',
          blurb: 'Fit tiles together so every term meets its matching scenario or definition.',
          href: function (x) { return root + 'quilt?set=unit-' + x.unit; },
          count: function (d, x) { var mine = d.sets.filter(function (s) { return String(s.unit) === x.unit; }), n = mine.reduce(function (a, s) { return a + s.pairs.length; }, 0);
                                return n ? { n: n, text: plural(n, 'pair') + (mine.length > 1 ? ' \u00b7 ' + mine.length + ' sets' : '') } : null; } },
        { id: 'battleship', icon: '\uD83D\uDE80', title: 'Cortex Commander', scope: 'unit', cta: 'Launch',
          blurb: 'Answer definition questions to fire on the enemy fleet and sink every ship.',
          href: function (x) { return root + 'battleship?unit=' + x.unit + '&start=1'; },
          count: function (d, x) { var n = d.terms.filter(function (t) { return unitOf(t) === x.unit; }).length; return n >= 4 ? { n: n, text: plural(n, 'term') } : null; } },
        { id: 'pairs', icon: '\u2696\uFE0F', title: 'Confusing Pairs', scope: 'unit', cta: 'Play',
          blurb: 'Tell look-alike terms apart by dropping each definition onto the right term.',
          href: function (x) { return root + 'confusingpairs?unit=' + x.unit; },
          // a set can belong to more than one unit ("0, 2"), exactly as the game itself counts it
          count: function (d, x) { var n = d.pairs.filter(function (r) { return String(r.unit).split(',').map(function (u) { return u.replace(/^Unit\s*/i, '').trim(); }).indexOf(x.unit) !== -1; }).length;
                                return n ? { n: n, text: plural(n, 'pair set') } : null; } },
        { id: 'wordsearch', icon: '\uD83D\uDD24', title: 'Word Search', scope: 'topic', cta: 'Play',
          blurb: "Hunt for this topic's key terms hidden in a letter grid.",
          href: function (x) { return root + 'wordsearch?topic=' + x.topic + '&size=15&start=1'; },
          count: function (d, x) { var n = usableWords(d.terms.filter(function (t) { return String(t.topic) === x.topic; })); return n >= 8 ? { n: n, text: plural(n, 'word') } : null; },
          // on an end-of-unit page the puzzle covers the whole unit
          unitMode: {
              blurb: "Hunt for the unit's key terms hidden in a letter grid.",
              href: function (x) { return root + 'wordsearch?unit=' + x.unit + '&size=15&start=1'; },
              count: function (d, x) { var n = usableWords(d.terms.filter(function (t) { return unitOf(t) === x.unit; })); return n >= 8 ? { n: n, text: plural(n, 'word') } : null; } } },
        { id: 'oddball', icon: '\uD83D\uDD0E', title: 'Oddball', scope: 'unit', cta: 'Play',
          blurb: "Four terms, one doesn't belong. Spot it and explain why.",
          href: function (x) { return root + 'oddball?unit=' + x.unit + '&start=1'; },
          count: function (d, x) { var n = d.odd.filter(function (r) { return unitOf(r) === x.unit; }).length; return n ? { n: n, text: plural(n, 'puzzle') } : null; } },
        { id: 'psychland', icon: '\uD83C\uDFB2', title: 'Psych Land', scope: 'unit', cta: 'Play',
          blurb: 'Race around the board by matching definitions to terms. Play solo or with friends.',
          href: function (x) { return root + 'boardgame?unit=' + x.unit + '&start=1'; },
          count: function (d, x) { var n = d.terms.filter(function (t) { return unitOf(t) === x.unit; }).length; return n >= 4 ? { n: n, text: plural(n, 'term') } : null; } },
        { id: 'connections', icon: '\uD83D\uDD17', title: 'Connections', scope: 'unit', cta: 'Play',
          blurb: 'Sort sixteen terms into four hidden categories.',
          href: function (x) { return root + 'connectionsgame?unit=' + x.unit; },
          count: function (d, x) { var n = d.con.filter(function (r) { return unitOf(r) === x.unit; }).length; return n >= 4 ? { n: n, text: plural(n, 'category', 'categories') } : null; } },
        { id: 'crossword', icon: '\u270F\uFE0F', title: 'Crossword', scope: 'unit', cta: 'Solve',
          blurb: 'Solve a crossword built from key terms and clues.',
          href: function (x) { return root + 'crossword?unit=' + x.unit + '&start=1'; },
          count: function (d, x) { var seen = {}; d.xw.forEach(function (r) { if (r.setid && unitOf(r) === x.unit) seen[r.setid] = 1; }); var n = Object.keys(seen).length; return n ? { n: n, text: plural(n, 'puzzle') } : null; } }
    ];

    // ---- Choosing a page's mix ----
    // Pinned by data-tools if the page says so. Otherwise each topic gets its own shuffle of the games that
    // have content for it. The shuffle is seeded by the topic number, so a page always shows the same mix,
    // and it is worked out down the whole topic list so two neighbouring topics never get the same four.
    function seeded(str) {                                    // small deterministic random number generator
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        var a = h >>> 0;
        return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function shuffled(arr, seedStr) {
        var out = arr.slice(), rnd = seeded(seedStr);
        for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = out[i]; out[i] = out[j]; out[j] = tmp; }
        return out;
    }
    function eligibleFor(ctx, data, available, needs, unitMode) {
        var out = [];
        CATALOG.forEach(function (t) {
            if (!available[needs[t.id]]) return;               // that data file didn't load: skip the game
            var v = (unitMode && t.unitMode) ? Object.assign({}, t, t.unitMode) : t;
            var c = v.count(data, ctx);
            if (c) out.push(Object.assign({}, v, { _count: c, _href: v.href(ctx) }));
        });
        return out;
    }
    function chooseMix(data, available, needs, allTopics, unitMode) {
        var here = { topic: topic, unit: unit };
        var mine = eligibleFor(here, data, available, needs, unitMode);
        var pinned = (hub.dataset.tools || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        if (pinned.length) return pinned.map(function (id) { return mine.filter(function (t) { return t.id === id; })[0]; }).filter(Boolean).slice(0, MIX_SIZE);
        if (mine.length <= MIX_SIZE) return mine;
        var topics = allTopics.slice();
        if (topics.indexOf(topic) === -1) topics.push(topic);
        topics.sort(function (a, b) { return parseFloat(a) - parseFloat(b); });

        // End-of-unit pages work as a set: the unit's games are shuffled once, and each of the last three
        // pages gets a different slice of that shuffle, so across the three pages overlap is small and
        // nearly every game shows up.
        if (unitMode) {
            var last3 = topics.filter(function (t) { return t.split('.')[0] === unit; }).slice(-3);
            var k = last3.indexOf(topic);
            if (k !== -1) {
                var order = shuffled(mine, 'unit|' + unit), n = order.length, startAt = Math.floor(k * n / 3), slice = [];
                for (var i = 0; i < MIX_SIZE; i++) slice.push(order[(startAt + i) % n]);
                return slice;
            }
        }
        var prevKey = '', result = null;
        topics.forEach(function (tp) {
            var ctx = { topic: tp, unit: tp.split('.')[0] }, elig = tp === topic ? mine : eligibleFor(ctx, data, available, needs, unitMode);
            if (elig.length <= MIX_SIZE) { prevKey = elig.map(function (t) { return t.id; }).sort().join(','); if (tp === topic) result = elig; return; }
            var pick, key, salt = 0;
            do {
                pick = shuffled(elig, tp + '|' + salt).slice(0, MIX_SIZE);
                key = pick.map(function (t) { return t.id; }).sort().join(',');
                salt++;
            } while (key === prevKey && salt < 12);
            prevKey = key;
            if (tp === topic) result = pick;
        });
        return result || mine.slice(0, MIX_SIZE);
    }

    function buildCard(t, c, unitMode) {
        var a = document.createElement('a');
        a.className = 'ph-card ph-unit' + (t.scope === 'topic' && !unitMode ? ' ph-scope-topic' : '');
        a.dataset.tool = t.id; a.dataset.scope = t.scope;
        a.href = t._href;
        var top = document.createElement('div'); top.className = 'ph-top';
        var chip = document.createElement('div'); chip.className = 'icon-chip'; chip.textContent = t.icon;
        var cnt = document.createElement('span'); cnt.className = 'ph-count'; pill(cnt, c.text);
        top.appendChild(chip); top.appendChild(cnt);
        var title = document.createElement('div'); title.className = 'card-title'; title.textContent = t.title;
        var p = document.createElement('p'); p.textContent = t.blurb;
        var cta = document.createElement('span'); cta.className = 'ph-cta'; cta.textContent = t.cta + ' \u2192';
        a.appendChild(top); a.appendChild(title);
        if (!unitMode) {                                           // end-of-unit rows say "the whole unit" once, in the heading
            var scope = document.createElement('span'); scope.className = 'ph-scope';
            scope.textContent = t.scope === 'topic' ? 'This topic' : 'All of Unit ' + unit;
            a.appendChild(scope);
        }
        a.appendChild(p); a.appendChild(cta);
        return a;
    }

    Promise.all([get('terms.json'), get('quiz.json'), get('studyquiz.json'), get('confusingpairs.json'),
                 get('oddball.json'), get('connections.json'), get('quilt-sets.json'), get('crossword.json'), get('studyguide-parts.json')]).then(function (r) {
        var terms = list(r[0]), quiz = list(r[1]), quick = list(r[2]);
        var data = { terms: terms, pairs: list(r[3]), odd: list(r[4]), con: list(r[5]), sets: (r[6] && r[6].sets) || [], xw: (r[7] && r[7].crossword) || [] };
        var available = { terms: !!r[0], pairs: !!r[3], odd: !!r[4], con: !!r[5], sets: !!r[6], xw: !!r[7] };
        var needs = { quilt: 'sets', battleship: 'terms', pairs: 'pairs', wordsearch: 'terms', oddball: 'odd', psychland: 'terms', connections: 'con', crossword: 'xw' };

        // ---- top row: this topic only ----
        var counts = {
            quick: r[2] ? quick.filter(function (x) { return String(x.topic) === topic; }).length : null,
            flashcards: r[0] ? terms.filter(function (x) { return String(x.topic) === topic; }).length : null,
            quiz: r[1] ? quiz.filter(function (x) { return String(x.topic) === topic; }).length : null
        };
        var labels = { quick: 'question', flashcards: 'term', quiz: 'question' };
        hub.querySelectorAll('.ph-card.ph-topic[data-tool]').forEach(function (card) {
            var tool = card.dataset.tool, el = card.querySelector('.ph-count'), n = counts[tool];
            if (n === null) { if (el) el.hidden = true; return; }          // data file missing: keep the card, drop the number
            if (n === 0) { card.hidden = true; return; }                   // nothing tagged to this topic: hide the card
            if (el) pill(el, plural(n, labels[tool]));
        });
        var visible = hub.querySelectorAll('.ph-topic:not([hidden])').length;
        var tier = hub.querySelector('.ph-tier-topic');
        if (tier && visible === 0) tier.hidden = true;

        // ---- topics with more than one study guide (1.6, 5.4): a Quick Check button for each part ----
        var partDefs = r[8] && r[8][topic] && Array.isArray(r[8][topic].parts) ? r[8][topic].parts : null;
        if (partDefs && r[2] && tier && !tier.hidden) {
            var partOf = function (q) {                      // a question's own "part" field wins, otherwise its id decides
                var own = q.part ? String(q.part).toLowerCase().trim() : '';
                var ids = partDefs.filter(function (d) { return String(d.part).toLowerCase() === own; });
                if (own && ids.length) return own;
                var id = parseInt(q.id, 10);
                for (var i = 0; i < partDefs.length; i++) {
                    var list = partDefs[i].ids || [];
                    for (var j = 0; j < list.length; j++) {
                        var x = list[j];
                        if (Array.isArray(x) ? (id >= x[0] && id <= x[1]) : id === x) return String(partDefs[i].part).toLowerCase();
                    }
                }
                return '';
            };
            var mine = quick.filter(function (x) { return String(x.topic) === topic; });
            var rows = partDefs.map(function (d) {
                var p = String(d.part).toLowerCase();
                return { part: p, label: d.label || '', n: mine.filter(function (x) { return partOf(x) === p; }).length };
            }).filter(function (x) { return x.n > 0; });
            if (rows.length) {
                var box = document.createElement('div');
                box.className = 'ph-parts';
                var lead = document.createElement('p');
                lead.className = 'ph-parts-label';
                lead.textContent = 'This topic has more than one study guide. Practice the Quick Check for just one of them:';
                box.appendChild(lead);
                var row = document.createElement('div');
                row.className = 'ph-parts-row';
                rows.forEach(function (x) {
                    var a = document.createElement('a');
                    a.className = 'ph-part';
                    a.href = root + 'quiz?mode=quick&topic=' + topic + '&part=' + x.part + '&start=1';
                    var tag = document.createElement('span'); tag.className = 'ph-part-tag'; tag.textContent = 'Part ' + x.part.toUpperCase();
                    var name = document.createElement('span'); name.className = 'ph-part-name'; name.textContent = x.label;
                    var cnt = document.createElement('span'); cnt.className = 'ph-part-count'; pill(cnt, plural(x.n, 'question'));
                    a.appendChild(tag); a.appendChild(name); a.appendChild(cnt);
                    row.appendChild(a);
                });
                box.appendChild(row);
                tier.appendChild(box);
            }
        }

        // ---- mix row: games and puzzles ----
        var grid = hub.querySelector('[data-mix-grid]');
        if (grid) {
            var topicIds = {};
            terms.forEach(function (t) { topicIds[String(t.topic)] = 1; });
            grid.innerHTML = '';
            var unitMode = hub.dataset.mix === 'unit';
            chooseMix(data, available, needs, Object.keys(topicIds), unitMode).forEach(function (t) { grid.appendChild(buildCard(t, t._count, unitMode)); });
            var mixTier = hub.querySelector('.ph-tier-mix');
            if (mixTier && !grid.children.length) mixTier.hidden = true;
        }
    });
})();

/* ---------- 3b. "Open the Games menu" link ----------
   A quiet link on pages without a games row: <a href="#top" data-open-games>. It scrolls to the top and opens the
   Games menu (the hamburger menu first, on phones), then closes it again on the next click or Escape. */
(function () {
    var link = document.querySelector('[data-open-games]');
    if (!link) return;
    var games = Array.prototype.filter.call(document.querySelectorAll('.nav-links .dropdown'), function (li) {
        var a = li.querySelector(':scope > a'); return a && /games/i.test(a.textContent);
    })[0];
    var toggle = document.getElementById('menu-toggle');
    if (!games) { link.hidden = true; return; }
    function close() {
        games.classList.remove('is-open');
        if (toggle && toggle.dataset.openedByLink) { toggle.checked = false; delete toggle.dataset.openedByLink; }
        document.removeEventListener('click', onAway, true);
        document.removeEventListener('keydown', onKey, true);
    }
    function onAway(e) { if (!games.contains(e.target) && e.target !== link) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    link.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        var phone = toggle && getComputedStyle(document.querySelector('.menu-icon')).display !== 'none';
        if (phone && !toggle.checked) { toggle.checked = true; toggle.dataset.openedByLink = '1'; }
        games.classList.add('is-open');
        setTimeout(function () {
            document.addEventListener('click', onAway, true);
            document.addEventListener('keydown', onKey, true);
        }, 0);
    });
})();

/* ---------- 3. Contents highlighting ----------
   Marks the current section in the "On this page" list (aria-current) as you scroll, and keeps the
   active chip in view on the mobile strip. */
(function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = new Map();
    links.forEach(function (a) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el) map.set(el, a);
    });
    if (map.size === 0) return;

    function setCurrent(a) {
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'true');
        // keep the active chip visible in the mobile strip
        if (a.scrollIntoView && window.innerWidth <= 1080) {
            var strip = a.closest('.toc');
            strip.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
        }
    }

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setCurrent(map.get(e.target)); });
    }, { rootMargin: '-15% 0px -70% 0px' });

    map.forEach(function (a, el) { io.observe(el); });
    setCurrent(links[0]);
})();
