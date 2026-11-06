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
   Fills the live counts on a topic page's "Practice This Topic" buttons from the site's own data files.
   Markup contract: <div class="practice-hub" data-topic="0.1" data-unit="0" data-base="/"> containing
   .ph-card[data-tool] children. Cards in the topic row are hidden when nothing is tagged to the topic. */
(function () {
    var hub = document.querySelector('.practice-hub');
    if (!hub) return;
    var topic = hub.dataset.topic, unit = String(hub.dataset.unit), base = hub.dataset.base || '/';
    function get(name) {
        return fetch(base + name).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }).catch(function () { return null; });
    }
    function list(d) { return Array.isArray(d) ? d : (d && Object.keys(d).map(function (k) { return d[k]; }).filter(Array.isArray)[0]) || []; }
    function unitOf(x) { return String(x.unit).replace(/^Unit\s*/i, ''); }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

    Promise.all([get('terms.json'), get('quiz.json'), get('studyquiz.json'), get('confusingpairs.json'),
                 get('oddball.json'), get('connections.json'), get('quilt-sets.json')]).then(function (r) {
        var terms = list(r[0]), quiz = list(r[1]), quick = list(r[2]), cp = list(r[3]), odd = list(r[4]), con = list(r[5]);
        var sets = (r[6] && r[6].sets) || [];
        var counts = {
            quick: r[2] ? quick.filter(function (x) { return String(x.topic) === topic; }).length : null,
            flashcards: r[0] ? terms.filter(function (x) { return String(x.topic) === topic; }).length : null,
            quiz: r[1] ? quiz.filter(function (x) { return String(x.topic) === topic; }).length : null
        };
        var labels = {
            quick: function (n) { return plural(n, 'question'); },
            flashcards: function (n) { return plural(n, 'term'); },
            quiz: function (n) { return plural(n, 'question'); }
        };
        var unitText = {};
        if (r[3]) unitText.pairs = plural(cp.filter(function (x) { return unitOf(x) === unit; }).length, 'pair set');
        if (r[4]) unitText.oddball = plural(odd.filter(function (x) { return unitOf(x) === unit; }).length, 'puzzle');
        if (r[5]) unitText.connections = plural(con.filter(function (x) { return unitOf(x) === unit; }).length, 'category', 'categories');
        if (r[6]) {
            var mine = sets.filter(function (s) { return String(s.unit) === unit; });
            var n = mine.reduce(function (a, s) { return a + s.pairs.length; }, 0);
            unitText.quilt = plural(n, 'pair') + (mine.length > 1 ? ' \u00b7 ' + mine.length + ' sets' : '');
        }
        var topicTotal = 0;
        hub.querySelectorAll('.ph-card[data-tool]').forEach(function (card) {
            var tool = card.dataset.tool, pill = card.querySelector('[data-count]');
            if (card.classList.contains('ph-topic')) {
                var n = counts[tool];
                if (n === null) { if (pill) pill.parentNode.hidden = true; return; }      // data file missing: keep the card, drop the number
                if (n === 0) { card.hidden = true; return; }                           // nothing tagged to this topic: hide the card
                topicTotal += n;
                if (pill) pill.parentNode.innerHTML = '<b>' + labels[tool](n).split(' ')[0] + '</b> ' + labels[tool](n).split(' ').slice(1).join(' ');
            } else {
                var t = unitText[tool];
                if (!t) { if (pill) pill.parentNode.hidden = true; return; }
                var parts = t.split(' ');
                if (pill) pill.parentNode.innerHTML = '<b>' + parts[0] + '</b> ' + parts.slice(1).join(' ');
            }
        });
        var visible = hub.querySelectorAll('.ph-topic:not([hidden])').length;
        var note = hub.querySelector('.ph-note');
        if (note) note.hidden = !(topicTotal > 0 && topicTotal < 14);
        var tier = hub.querySelector('.ph-tier-topic');
        if (tier && visible === 0) tier.hidden = true;
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
