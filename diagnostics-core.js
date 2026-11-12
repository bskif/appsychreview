/* diagnostics-core.js
   Shared engine for the Diagnostic Tests pages (hub, test, results).
   - Loads data/diagnostic_tests.json, topics.json and data/diagnostic_topic_weights.json
   - Saves progress and results in this browser only (localStorage). No accounts.
   - All question text is rendered with textContent, never as HTML. */
(function (global) {
    'use strict';

    var DX = {};
    var LETTERS = ['A', 'B', 'C', 'D'];
    var PATHS = {
        data: 'diagnostic_tests.json',
        topics: 'topics.json',
        weights: 'diagnostic_topic_weights.json'
    };
    /* Folder that holds the figure images, relative to the site root.
       A figure's "file" in the JSON can be just a file name (fig-0001.svg); it is looked up here.
       A "file" that already contains a slash is used exactly as written. */
    var IMAGE_DIR = 'images/diagnostics/';
    var STORE = 'psychhub.dx.v1.';
    var K_HISTORY = STORE + 'history';
    var K_PROGRESS = STORE + 'progress.';

    DX.LETTERS = LETTERS;
    DX.UNIT_TITLES = {
        'Unit 0': 'Scientific Foundations',
        'Unit 1': 'Biological Bases of Behavior',
        'Unit 2': 'Cognition',
        'Unit 3': 'Development and Learning',
        'Unit 4': 'Social Psychology and Personality',
        'Unit 5': 'Mental and Physical Health'
    };
    DX.PRACTICE = {
        P1: 'Concept Application',
        P2: 'Research Methods and Design',
        P3: 'Data Interpretation'
    };
    DX.SKILL_NAMES = {
        '1.A': 'Apply concepts to a scenario',
        '1.B': 'Cultural norms and cognitive biases',
        '2.A': 'Identify the research design',
        '2.B': 'Experimental design elements',
        '2.C': 'Non-experimental design elements',
        '2.D': 'Research ethics',
        '3.A': 'Identify concepts in data',
        '3.B': 'Central tendency, variation, percentile',
        '3.C': 'Interpret trends and inferential data'
    };
    /* Which Unit 0 study guides help with which skill */
    var SKILL_GUIDE = {
        '1.A': [], '1.B': ['0.1'], '2.A': ['0.3'], '2.B': ['0.2', '0.3'], '2.C': ['0.4'],
        '2.D': ['0.4'], '3.A': ['0.5'], '3.B': ['0.5'], '3.C': ['0.5', '0.3']
    };
    var PRACTICE_GUIDE = { P1: [], P2: ['0.3', '0.4'], P3: ['0.5'] };
    var GAMES = [
        { href: 'connectionsgame', name: 'Connections' },
        { href: 'boardgame', name: 'Psych Land' },
        { href: 'battleship', name: 'Cortex Commander' },
        { href: 'oddball', name: 'Oddball' },
        { href: 'wordsearch', name: 'Word Search' },
        { href: 'crossword', name: 'Crossword' }
    ];

    /* ---------- tiny DOM helper ---------- */
    DX.h = function (tag, attrs, kids) {
        var el = document.createElement(tag);
        attrs = attrs || {};
        Object.keys(attrs).forEach(function (k) {
            var v = attrs[k];
            if (v === null || v === undefined || v === false) { return; }
            if (k === 'text') { el.textContent = v; }
            else if (k === 'class') { el.className = v; }
            else if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2), v); }
            else { el.setAttribute(k, v === true ? '' : v); }
        });
        (kids || []).forEach(function (c) {
            if (c === null || c === undefined || c === false) { return; }
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return el;
    };
    var h = DX.h;

    DX.param = function (name) {
        try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
    };
    DX.isPreview = function () { return DX.param('preview') === '1'; };

    /* ---------- storage (falls back to memory if the browser blocks it) ---------- */
    var mem = {};
    DX.storageProblem = false;
    function rawGet(k) {
        var v = null;
        try { v = localStorage.getItem(k); } catch (e) { DX.storageProblem = true; }
        if (v === null && Object.prototype.hasOwnProperty.call(mem, k)) { v = mem[k]; }
        return v;
    }
    function rawSet(k, s) {
        mem[k] = s;
        try { localStorage.setItem(k, s); } catch (e) { DX.storageProblem = true; }
    }
    function rawDel(k) {
        delete mem[k];
        try { localStorage.removeItem(k); } catch (e) { DX.storageProblem = true; }
    }
    function jget(k) {
        var s = rawGet(k);
        if (s === null) { return null; }
        try { return JSON.parse(s); } catch (e) { return null; }
    }
    function jset(k, v) { rawSet(k, JSON.stringify(v)); }
    function allKeys() {
        var keys = Object.keys(mem);
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && keys.indexOf(k) < 0) { keys.push(k); }
            }
        } catch (e) { DX.storageProblem = true; }
        return keys;
    }
    DX.checkStorage = function () {
        try {
            localStorage.setItem(STORE + 'probe', '1');
            localStorage.removeItem(STORE + 'probe');
            return true;
        } catch (e) { DX.storageProblem = true; return false; }
    };

    DX.getHistory = function () {
        var hist = jget(K_HISTORY);
        return Array.isArray(hist) ? hist : [];
    };
    DX.saveAttempt = function (attempt) {
        var hist = DX.getHistory();
        hist.push(attempt);
        jset(K_HISTORY, hist);
    };
    DX.getProgress = function (testId) { return jget(K_PROGRESS + testId); };
    DX.setProgress = function (testId, p) { jset(K_PROGRESS + testId, p); };
    DX.dropProgress = function (testId) { rawDel(K_PROGRESS + testId); };
    DX.listProgress = function () {
        return allKeys().filter(function (k) { return k.indexOf(K_PROGRESS) === 0; })
            .map(function (k) { return jget(k); }).filter(Boolean);
    };
    DX.clearAll = function () {
        allKeys().filter(function (k) { return k.indexOf(STORE) === 0; }).forEach(rawDel);
    };
    DX.newId = function () { return 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

    /* ---------- loading ---------- */
    function fetchJSON(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (r) {
            if (!r.ok) { throw new Error(url + ' returned ' + r.status); }
            return r.json();
        });
    }

    DX.load = function () {
        var preview = DX.isPreview();
        return Promise.all([
            fetchJSON(PATHS.data),
            fetchJSON(PATHS.topics).catch(function () { return { topics: [] }; }),
            fetchJSON(PATHS.weights).catch(function () { return { topics: {} }; })
        ]).then(function (r) {
            var data = r[0];
            var topics = {};
            var unitTitles = {};
            Object.keys(DX.UNIT_TITLES).forEach(function (u) { unitTitles[u] = DX.UNIT_TITLES[u]; });
            (r[1].topics || []).forEach(function (t) {
                topics[t.topic_id] = { title: t.topic_title, unit: t.unit };
                if (t.unit_title) { unitTitles[t.unit] = t.unit_title; }
            });
            return {
                preview: preview,
                questions: data.questions || {},
                figures: data.figures || {},
                stimuli: data.stimuli || {},
                tests: data.tests || [],
                topics: topics,
                unitTitles: unitTitles,
                weights: (r[2] && r[2].topics) || {}
            };
        });
    };

    DX.isLive = function (ctx, q) {
        return !!q && (ctx.preview || q.status === 'published');
    };

    DX.testQids = function (t) {
        var out = [];
        (t.items || []).forEach(function (it) {
            if (it.set) { out = out.concat(it.qids || []); } else if (it.qid) { out.push(it.qid); }
        });
        return out;
    };

    /* ---------- drawn tests ----------
       A fixed test lists its questions in "items". A drawn test has a "recipe" instead:
         { "order": "mixed" | "slots",
           "slots": [ { "topic": "2.1", "count": 4 },
                      { "unit": "Unit 2", "skill_focused": true, "kind": "set", "size": 3, "count": 1 },
                      { "unit": "Unit 2", "skill_focused": true, "count": 3 } ] }
       A slot picks from published, non-retired questions. A slot matches on "topic", "topics" or "unit";
       skill_focused is false unless the slot says true (or "any"). "kind": "set" draws whole sets of "size"
       questions (default 3), shown in question-id order. */
    DX.isDraw = function (t) { return !!(t && t.recipe && t.recipe.slots); };

    function liveBank(ctx) {
        return Object.keys(ctx.questions).map(function (id) { return ctx.questions[id]; })
            .filter(function (q) { return DX.isLive(ctx, q) && !q.retired; });
    }
    function slotMatch(q, slot) {
        var sf = slot.skill_focused === undefined ? false : slot.skill_focused;
        if (sf !== 'any' && !!q.skill_focused !== !!sf) { return false; }
        if (slot.topic) { return q.topic === slot.topic; }
        if (slot.topics) { return slot.topics.indexOf(q.topic) >= 0; }
        if (slot.unit) { return q.unit === slot.unit; }
        return true;
    }
    function slotCandidates(ctx, slot, bank) {
        if (slot.kind === 'set') {
            var size = slot.size || 3, groups = {};
            Object.keys(ctx.questions).forEach(function (id) {
                var q = ctx.questions[id];
                if (q.setid) { (groups[q.setid] = groups[q.setid] || []).push(q); }
            });
            return Object.keys(groups).map(function (sid) {
                var qs = groups[sid].slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
                var ok = qs.length === size && qs.every(function (q) {
                    return DX.isLive(ctx, q) && !q.retired && slotMatch(q, slot) && q.stimulus_id === qs[0].stimulus_id;
                });
                return ok ? { kind: 'set', setid: sid, stimulus_id: qs[0].stimulus_id, qs: qs } : null;
            }).filter(Boolean);
        }
        return bank.filter(function (q) { return !q.setid && slotMatch(q, slot); })
            .map(function (q) { return { kind: 'q', qs: [q] }; });
    }
    function slotLabel(s) {
        var w = s.topic ? 'Topic ' + s.topic : (s.topics ? 'Topics ' + s.topics.join(', ') : (s.unit || 'Any topic'));
        if (s.skill_focused === true) { w += ' research and data'; }
        return w + (s.kind === 'set' ? ', sets of ' + (s.size || 3) : '');
    }
    function shuffle(a, rnd) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* How many times each question has already appeared in this student's finished tests */
    DX.seenCounts = function () {
        var m = {};
        DX.getHistory().forEach(function (a) { (a.qids || []).forEach(function (id) { m[id] = (m[id] || 0) + 1; }); });
        return m;
    };

    DX.testSize = function (t) {
        if (!DX.isDraw(t)) { return DX.testQids(t).length; }
        return t.recipe.slots.reduce(function (n, s) { return n + (s.count || 0) * (s.kind === 'set' ? (s.size || 3) : 1); }, 0);
    };

    /* Per slot: how many questions (or sets) the bank has versus how many a draw needs */
    DX.poolReport = function (ctx, t) {
        var bank = liveBank(ctx);
        return (t.recipe.slots || []).map(function (s) {
            return { label: slotLabel(s), need: s.count || 0, have: slotCandidates(ctx, s, bank).length, unit: s.kind === 'set' ? 'sets' : 'questions' };
        });
    };

    function keyPenalty(picks) {
        var keys = [];
        picks.forEach(function (c) { c.qs.forEach(function (q) { keys.push(q.answer); }); });
        var pen = 0, i;
        for (i = 2; i < keys.length; i++) { if (keys[i] === keys[i - 1] && keys[i] === keys[i - 2]) { pen++; } }
        if (keys.length >= 12) {
            var counts = { A: 0, B: 0, C: 0, D: 0 };
            keys.forEach(function (k) { if (counts[k] !== undefined) { counts[k]++; } });
            LETTERS.forEach(function (L) { var dev = Math.abs(counts[L] - keys.length / 4); if (dev > 2) { pen += dev - 2; } });
        }
        return pen;
    }

    /* Draw one test. Prefers questions this student has not seen, then balances the answer key.
       Throws if a slot does not have enough questions. opts: { rng, seen, tries } */
    DX.draw = function (ctx, t, opts) {
        opts = opts || {};
        var rnd = opts.rng || Math.random;
        var seen = opts.seen || DX.seenCounts();
        var bank = liveBank(ctx);
        var slots = t.recipe.slots;
        var pools = slots.map(function (s) { return slotCandidates(ctx, s, bank); });
        var best = null, bestPen = Infinity, tries = opts.tries || 250;
        for (var n = 0; n < tries; n++) {
            var used = {}, picks = [];
            for (var si = 0; si < slots.length; si++) {
                var need = slots[si].count || 0;
                var cands = pools[si].filter(function (c) { return !c.qs.some(function (q) { return used[q.id]; }); });
                if (cands.length < need) {
                    var err = new Error('The question pool is too small for ' + slotLabel(slots[si]) + ': needs ' + need + ', has ' + cands.length + '.');
                    err.slotIndex = si;
                    throw err;
                }
                var keyed = cands.map(function (c) {
                    var s = c.qs.reduce(function (m, q) { return Math.max(m, seen[q.id] || 0); }, 0);
                    return { c: c, k: s + rnd() * 0.99 };
                }).sort(function (a, b) { return a.k - b.k; });
                keyed.slice(0, need).forEach(function (x) { x.c.qs.forEach(function (q) { used[q.id] = 1; }); picks.push(x.c); });
            }
            if (t.recipe.order !== 'slots') { shuffle(picks, rnd); }
            var pen = keyPenalty(picks);
            if (pen < bestPen) { bestPen = pen; best = picks; }
            if (pen === 0) { break; }
        }
        var items = best.map(function (c, i) {
            return c.kind === 'set'
                ? { order: i + 1, set: c.setid, stimulus_id: c.stimulus_id, qids: c.qs.map(function (q) { return q.id; }) }
                : { order: i + 1, qid: c.qs[0].id };
        });
        return { items: items, penalty: bestPen };
    };

    /* A test can be taken only when every question it needs is available */
    DX.testReady = function (ctx, t) {
        if (!ctx.preview && t.status !== 'published') { return false; }
        if (DX.isDraw(t)) {
            try { DX.draw(ctx, t, { tries: 1, seen: {} }); return true; } catch (e) { return false; }
        }
        var ids = DX.testQids(t);
        if (!ids.length) { return false; }
        return ids.every(function (id) { return DX.isLive(ctx, ctx.questions[id]); });
    };

    DX.findTest = function (ctx, testId, version) {
        for (var i = 0; i < ctx.tests.length; i++) {
            var t = ctx.tests[i];
            if (t.test_id === testId && (version === undefined || t.version === version)) { return t; }
        }
        return null;
    };

    /* Newest ready version of each test family (unit-2-v1, unit-2-v2 ... share "unit-2") */
    DX.latestTests = function (ctx) {
        var best = {};
        ctx.tests.forEach(function (t) {
            var fam = String(t.test_id).replace(/-v\d+$/, '');
            if (!DX.testReady(ctx, t)) { return; }
            if (!best[fam] || (t.version || 0) > (best[fam].version || 0)) { best[fam] = t; }
        });
        return Object.keys(best).map(function (k) { return best[k]; });
    };

    /* Flatten a test into numbered questions and blocks (single question or set) */
    DX.flatten = function (ctx, t) {
        var items = (t.items || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        var qids = [], blocks = [], blockOf = [];
        items.forEach(function (it) {
            var ids = it.set ? (it.qids || []) : [it.qid];
            var b = { kind: it.set ? 'set' : 'q', setId: it.set || null, stimulusId: it.stimulus_id || null, start: qids.length, qids: ids.slice() };
            blocks.push(b);
            ids.forEach(function (id) { qids.push(id); blockOf.push(blocks.length - 1); });
        });
        return { qids: qids, blocks: blocks, blockOf: blockOf };
    };

    /* ---------- content checks (the style guide, as code) ---------- */
    DX.validate = function (ctx) {
        var probs = [];
        function p(id, msg) { probs.push({ id: id, msg: msg }); }
        Object.keys(ctx.questions).forEach(function (id) {
            var q = ctx.questions[id];
            if (!q.options || q.options.length !== 4) { p(id, 'needs exactly 4 options'); }
            if (LETTERS.indexOf(q.answer) < 0) { p(id, 'answer must be A, B, C or D'); }
            else if (!q.explanation || q.explanation.indexOf('Correct: ' + q.answer + '.') !== 0) { p(id, 'explanation should start with "Correct: ' + q.answer + '."'); }
            if (/\bNOT\b|\bEXCEPT\b|\bLEAST\b/.test(q.question || '')) { p(id, 'negative stem (NOT, EXCEPT, LEAST)'); }
            if (/all of the above|none of the above/i.test((q.options || []).join(' '))) { p(id, 'uses "all/none of the above"'); }
            if (/[\u2014\u2013]/.test(JSON.stringify(q))) { p(id, 'contains a dash character the site avoids'); }
            (q.figure_ids || []).forEach(function (f) { if (!ctx.figures[f]) { p(id, 'unknown figure ' + f); } });
            if (q.stimulus_id && !ctx.stimuli[q.stimulus_id]) { p(id, 'unknown stimulus ' + q.stimulus_id); }
            if (!q.skill) { p(id, 'missing skill'); }
            if (q.options && q.answer && q.options.length === 4) {
                var lens = q.options.map(function (o) { return o.length; });
                var ai = LETTERS.indexOf(q.answer);
                var longest = Math.max.apply(null, lens);
                if (lens[ai] === longest && lens.filter(function (n) { return n === longest; }).length === 1 && longest > 40) {
                    p(id, 'the correct option is the single longest (graders notice this)');
                }
            }
        });
        ctx.tests.forEach(function (t) {
            if (DX.isDraw(t)) {
                var keyCount = { A: 0, B: 0, C: 0, D: 0 }, total = 0, bank = liveBank(ctx);
                DX.poolReport(ctx, t).forEach(function (r) {
                    if (r.have < r.need) { p(t.test_id, r.label + ' has ' + r.have + ' ' + r.unit + ' but a draw needs ' + r.need); }
                });
                t.recipe.slots.forEach(function (s) {
                    slotCandidates(ctx, s, bank).forEach(function (c) { c.qs.forEach(function (q) { if (keyCount[q.answer] !== undefined) { keyCount[q.answer]++; total++; } }); });
                });
                if (total >= 20) {
                    LETTERS.forEach(function (L) {
                        var share = keyCount[L] / total;
                        if (share < 0.18 || share > 0.32) { p(t.test_id, 'pool answer key is lopsided: ' + L + ' is ' + Math.round(share * 100) + '% of ' + total + ' questions'); }
                    });
                }
                return;
            }
            var ids = DX.testQids(t);
            var seen = {};
            ids.forEach(function (id) {
                if (!ctx.questions[id]) { p(t.test_id, 'lists missing question ' + id); }
                if (seen[id]) { p(t.test_id, 'lists ' + id + ' twice'); }
                seen[id] = 1;
            });
            var keys = ids.map(function (id) { return ctx.questions[id] && ctx.questions[id].answer; }).filter(Boolean);
            if (keys.length >= 12) {
                var counts = { A: 0, B: 0, C: 0, D: 0 };
                keys.forEach(function (k) { counts[k]++; });
                var quarter = keys.length / 4;
                LETTERS.forEach(function (L) { if (Math.abs(counts[L] - quarter) > 1.5) { p(t.test_id, 'answer key is lopsided: ' + L + ' appears ' + counts[L] + ' times of ' + keys.length); } });
            }
            for (var i = 2; i < keys.length; i++) {
                if (keys[i] === keys[i - 1] && keys[i] === keys[i - 2]) { p(t.test_id, 'answer ' + keys[i] + ' repeats 3 times in a row near question ' + (i + 1)); break; }
            }
        });
        return probs;
    };

    /* ---------- formatting helpers ---------- */
    DX.pct = function (c, n) { return n ? Math.round((c / n) * 100) : 0; };
    DX.band = function (pct) {
        if (pct >= 80) { return { key: 'strong', label: 'Strong' }; }
        if (pct >= 60) { return { key: 'developing', label: 'Developing' }; }
        return { key: 'priority', label: 'Priority' };
    };
    DX.fmtDuration = function (ms) {
        var s = Math.max(0, Math.round(ms / 1000));
        var m = Math.floor(s / 60);
        var r = s % 60;
        if (m >= 60) { return Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
        return m + ' min ' + (r < 10 ? '0' : '') + r + ' s';
    };
    DX.fmtClock = function (ms) {
        var s = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return m + ':' + (r < 10 ? '0' : '') + r;
    };
    DX.fmtDate = function (ts) {
        try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
    };
    DX.unitLabel = function (ctx, u) { return u + ': ' + (ctx.unitTitles[u] || ''); };
    DX.topicLabel = function (ctx, id) { return id + ' ' + ((ctx.topics[id] && ctx.topics[id].title) || ''); };

    /* ---------- figures, tables, stimuli (shared by test and review) ---------- */
    DX.figureEl = function (ctx, fid) {
        var f = ctx.figures[fid];
        if (!f) { return null; }
        var fig = h('figure', { class: 'dx-figure' });
        var src = String(f.file || '');
        if (src && src.indexOf('/') < 0) { src = IMAGE_DIR + src; }
        fig.appendChild(h('img', { src: src, alt: f.alt || '' }));
        if (f.caption) { fig.appendChild(h('figcaption', { class: 'dx-sr', text: f.caption })); }
        return fig;
    };

    DX.tableEl = function (tbl) {
        var t = h('table', { class: 'dx-table' });
        if (tbl.title) { t.appendChild(h('caption', { text: tbl.title })); }
        var thead = h('thead'), tr = h('tr');
        (tbl.columns || []).forEach(function (c) { tr.appendChild(h('th', { scope: 'col', text: c })); });
        thead.appendChild(tr);
        t.appendChild(thead);
        var tb = h('tbody');
        (tbl.rows || []).forEach(function (row) {
            var r = h('tr');
            row.forEach(function (cell, i) { r.appendChild(h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row', text: String(cell) } : { text: String(cell) })); });
            tb.appendChild(r);
        });
        t.appendChild(tb);
        return h('div', { class: 'dx-table-wrap' }, [t]);
    };

    DX.stimulusEl = function (ctx, sid) {
        var s = ctx.stimuli[sid];
        if (!s) { return null; }
        var box = h('div', { class: 'dx-stimulus' });
        if (s.text) { box.appendChild(h('p', { class: 'dx-stim-text', text: s.text })); }
        if (s.table) { box.appendChild(DX.tableEl(s.table)); }
        (s.figure_ids || []).forEach(function (fid) {
            var fe = DX.figureEl(ctx, fid);
            if (fe) { box.appendChild(fe); }
        });
        return box;
    };

    /* ---------- scoring and analysis ---------- */
    function bucket() { return { n: 0, c: 0, att: {} }; }
    function add(map, key, r) {
        var b = map[key] || (map[key] = bucket());
        b.n++;
        if (r.correct) { b.c++; }
        b.att[r.attempt] = (b.att[r.attempt] || 0) + 1;
    }
    function stats(map) {
        var S = { all: bucket(), unit: {}, practice: {}, skill: {}, topic: {} };
        Object.keys(map).forEach(function (id) {
            var r = map[id], q = r.q;
            S.all.n++; if (r.correct) { S.all.c++; } S.all.att[r.attempt] = (S.all.att[r.attempt] || 0) + 1;
            add(S.practice, 'P' + String(q.skill).charAt(0), r);
            add(S.skill, q.skill, r);
            var secondary0 = (q.topic_secondary || []).filter(function (t) { return String(t).indexOf('0.') === 0; });
            if (q.unit === 'Unit 0') {
                add(S.unit, 'Unit 0', r);
                add(S.topic, q.topic, r);
            } else if (q.skill_focused) {
                add(S.unit, 'Unit 0', r);
                secondary0.forEach(function (t) { add(S.topic, t, r); });
            } else {
                add(S.unit, q.unit, r);
                add(S.topic, q.topic, r);
            }
        });
        return S;
    }

    /* Latest answer per question id across the given attempts */
    function latestPerQuestion(ctx, attempts) {
        var m = {};
        attempts.forEach(function (a) {
            a.qids.forEach(function (id) {
                var q = ctx.questions[id];
                if (!q) { return; }
                var ch = (a.answers && a.answers[id]) || null;
                m[id] = { q: q, chosen: ch, correct: ch === q.answer, attempt: a.id };
            });
        });
        return m;
    }

    DX.analyze = function (ctx, attemptId) {
        var attempts = DX.getHistory().slice().sort(function (a, b) { return a.submittedAt - b.submittedAt; });
        var current = null;
        attempts.forEach(function (a) { if (a.id === attemptId) { current = a; } });
        if (!current && !attemptId && attempts.length) { current = attempts[attempts.length - 1]; }
        var thisMap = latestPerQuestion(ctx, current ? [current] : []);
        return {
            attempts: attempts,
            current: current,
            thisMap: thisMap,
            thisStats: stats(thisMap),
            poolStats: stats(latestPerQuestion(ctx, attempts))
        };
    };

    /* How much can we say? Follows Blueprint D in the analysis document. */
    function maxPerAttempt(b) {
        return Object.keys(b.att || {}).reduce(function (m, k) { return Math.max(m, b.att[k]); }, 0);
    }
    DX.rule = {
        /* A topic gets a full score with 3+ questions in one test, or 5+ pooled across tests */
        topic: function (b, scope) {
            if (scope === 'this') { return b.n >= 3 ? 'full' : 'thin'; }
            return (b.n >= 5 || maxPerAttempt(b) >= 3) ? 'full' : 'thin';
        },
        unit: function (n) { return n >= 10 ? 'full' : (n >= 4 ? 'early' : 'thin'); },
        practice: function (n) { return n >= 8 ? 'full' : (n >= 3 ? 'early' : 'thin'); },
        skill: function (b) { return (b.n >= 5 && Object.keys(b.att).length >= 2) ? 'full' : 'hidden'; }
    };

    /* Up to 3 content priorities, ranked by (1 - score) x how often the topic is on the real exam */
    DX.priorities = function (ctx, A) {
        var out = [];
        var P = A.poolStats.topic;
        Object.keys(P).forEach(function (id) {
            var b = P[id];
            if (DX.rule.topic(b, 'all') !== 'full') { return; }
            var pct = DX.pct(b.c, b.n);
            if (pct >= 80) { return; }
            var w = ctx.weights[id] ? ctx.weights[id].avg : 1;
            out.push({ id: id, pct: pct, n: b.n, c: b.c, weight: w, score: (1 - pct / 100) * w });
        });
        out.sort(function (a, b) { return b.score - a.score; });
        return out.slice(0, 3);
    };

    DX.skillPriorities = function (A) {
        var out = [];
        Object.keys(A.poolStats.practice).forEach(function (k) {
            if (k === 'P1') { return; }
            var b = A.poolStats.practice[k];
            if (DX.rule.practice(b.n) !== 'full') { return; }
            var pct = DX.pct(b.c, b.n);
            if (pct < 60) { out.push({ key: k, pct: pct, n: b.n, c: b.c, guides: PRACTICE_GUIDE[k] || [] }); }
        });
        return out;
    };

    DX.activityLinks = function (topicId) {
        var parts = String(topicId).split('.');
        var game = GAMES[((parseInt(parts[0], 10) || 0) * 3 + (parseInt(parts[1], 10) || 0)) % GAMES.length];
        return [
            { href: 'overviews/topic' + topicId, label: 'Study guide ' + topicId },
            { href: 'flashcards', label: 'Flashcards' },
            { href: 'quiz', label: 'Quick Check quiz' },
            { href: game.href, label: 'Play ' + game.name }
        ];
    };
    DX.guideLink = function (id) { return 'overviews/topic' + id; };

    global.DX = DX;
})(window);
