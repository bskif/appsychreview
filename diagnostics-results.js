/* diagnostics-results.js - results for one finished test, plus pooled results across all tests */
(function () {
    'use strict';
    var h = DX.h;
    var $ = function (id) { return document.getElementById(id); };
    var preview = DX.isPreview();
    var previewSuffix = preview ? '&preview=1' : '';

    var ctx, A, attempt;
    var scope = 'all';          /* "this" or "all" on the Units and Topics tab */
    var unitsPanel;

    function notice(kind, text) {
        var box = h('div', { class: 'dx-notice' + (kind === 'warn' ? ' warn' : '') }, [h('p', { text: text })]);
        $('dxNotices').appendChild(box);
        return box;
    }

    /* ---------- one row of bars ---------- */
    function attCount(b) { return Object.keys(b.att || {}).length; }

    function makeRow(o) {
        /* o: {label, sub, b (bucket), status ('full'|'early'|'thin'|'none'), exam, pooled} */
        var li = h('li', { class: 'dx-row' + (o.status === 'thin' || o.status === 'none' ? ' thin' : '') });
        var lbl = h('div', { class: 'lbl' });
        if (o.href) { lbl.appendChild(h('a', { class: 'dx-toplink', href: o.href, text: o.label })); } else { lbl.appendChild(document.createTextNode(o.label)); }
        if (o.sub) { lbl.appendChild(h('small', { text: o.sub })); }
        li.appendChild(lbl);
        var track = h('div', { class: 'dx-track', role: 'img' });
        var val = h('div', { class: 'dx-val' });
        if (o.status === 'none') {
            track.setAttribute('aria-label', 'No questions yet');
            val.appendChild(h('span', { class: 'dx-tag thin', text: o.noneText || 'Not taken yet' }));
        } else {
            var pct = DX.pct(o.b.c, o.b.n);
            var band = DX.band(pct);
            var fillClass = o.status === 'thin' ? 'thin' : band.key;
            track.appendChild(h('div', { class: 'dx-fill ' + fillClass, style: 'width:' + Math.max(pct, 2) + '%' }));
            track.setAttribute('aria-label', pct + ' percent correct');
            if (o.status === 'thin') {
                val.appendChild(h('span', { text: o.b.c + ' of ' + o.b.n + ' correct' }));
                val.appendChild(h('span', { class: 'dx-tag thin', text: 'Not enough to judge' }));
            } else {
                var txt = h('span', {}, [h('b', { text: pct + '%' }), ' (' + o.b.c + ' of ' + o.b.n + ')']);
                val.appendChild(txt);
                val.appendChild(h('span', { class: 'dx-tag ' + (o.status === 'early' ? 'thin' : band.key), text: o.status === 'early' ? 'Early signal' : band.label }));
            }
            if (o.pooled && attCount(o.b) > 1) {
                val.appendChild(h('span', { class: 'dx-exam', text: o.b.n + ' questions across ' + attCount(o.b) + ' tests' }));
            }
        }
        if (o.exam) { val.appendChild(h('span', { class: 'dx-exam', text: o.exam })); }
        li.appendChild(track);
        li.appendChild(val);
        return li;
    }

    function examTag(id) {
        var w = ctx.weights[id];
        return w ? w.band + ' on the exam' : '';
    }

    function unitRows(S, pooled) {
        var ul = h('ul', { class: 'dx-rows' });
        ['Unit 0', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'].forEach(function (u) {
            var b = S.unit[u];
            var label = u + ': ' + (ctx.unitTitles[u] || '');
            if (!b) { ul.appendChild(makeRow({ label: label, status: 'none', noneText: pooled ? 'Not taken yet' : 'Not on this test' })); return; }
            ul.appendChild(makeRow({ label: label, b: b, status: DX.rule.unit(b.n), pooled: pooled }));
        });
        return ul;
    }

    function practiceRows(S, pooled) {
        var ul = h('ul', { class: 'dx-rows' });
        ['P1', 'P2', 'P3'].forEach(function (k, i) {
            var b = S.practice[k];
            var label = 'Skill practice ' + (i + 1) + ': ' + DX.PRACTICE[k];
            if (!b) { ul.appendChild(makeRow({ label: label, status: 'none', noneText: 'Not on this test' })); return; }
            ul.appendChild(makeRow({ label: label, b: b, status: DX.rule.practice(b.n), pooled: pooled }));
        });
        return ul;
    }

    /* ---------- summary panel ---------- */
    function renderSummary() {
        var qs = attempt.qids.filter(function (id) { return ctx.questions[id]; });
        var c = 0, unanswered = 0;
        qs.forEach(function (id) {
            var a = attempt.answers && attempt.answers[id];
            if (!a) { unanswered++; }
            if (a === ctx.questions[id].answer) { c++; }
        });
        var n = qs.length;
        var pct = DX.pct(c, n);

        $('dxResTitle').textContent = attempt.name || 'Results';
        $('dxResLede').textContent = 'Finished ' + DX.fmtDate(attempt.submittedAt) + '. One test cannot predict your AP score, but it can show you where to look next.';
        document.title = 'Results: ' + (attempt.name || 'Diagnostic Test') + ' - Psych Review Hub';

        var box = $('dxSummary');
        box.textContent = '';
        var big = h('div', { class: 'dx-big' }, [String(c), h('small', { text: 'of ' + n + ' correct (' + pct + '%)' })]);
        var facts = h('dl', { class: 'dx-facts' });
        function fact(k, v) { facts.appendChild(h('dt', { text: k })); facts.appendChild(h('dd', { text: v })); }
        fact('Time', attempt.timed ? DX.fmtDuration(attempt.activeMs) + ' of ' + attempt.limitMin + ' min' : DX.fmtDuration(attempt.activeMs) + ' (untimed)');
        fact('Not answered', String(unanswered));
        fact('Flagged', String((attempt.flags || []).length));
        box.appendChild(h('div', { class: 'dx-score' }, [big, facts]));
        if (attempt.timedOut) {
            box.appendChild(h('div', { class: 'dx-notice warn' }, [h('p', { text: 'Time ran out, so questions you had not answered count as incorrect.' })]));
        }
        if (unanswered && !attempt.timedOut) {
            box.appendChild(h('p', { class: 'dx-note', text: 'Unanswered questions count as incorrect.' }));
        }

        var actions = $('dxTopActions');
        actions.textContent = '';
        var printBtn = h('button', { type: 'button', class: 'dx-btn solid', text: 'Print or save as PDF' });
        printBtn.addEventListener('click', function () { window.print(); });
        actions.appendChild(printBtn);
        actions.appendChild(h('a', { class: 'dx-btn outline', href: 'diagnostic-test?test=' + encodeURIComponent(attempt.testId) + previewSuffix, text: 'Take this test again' }));
        actions.appendChild(h('a', { class: 'dx-btn outline', href: 'diagnostics', text: 'All diagnostic tests' }));

        var ph = $('dxPrintHead');
        ph.textContent = '';
        ph.appendChild(h('h1', { text: attempt.name || 'Diagnostic Test Results' }));
        ph.appendChild(h('p', { text: 'Psych Review Hub, appsychreviewhub.com. ' + c + ' of ' + n + ' correct (' + pct + '%). Finished ' + DX.fmtDate(attempt.submittedAt) + '.' }));
        $('dxResPanel').hidden = false;
    }

    /* ---------- tab: overview ---------- */
    function overviewPanel() {
        var p = h('div');
        var many = A.attempts.length > 1;
        p.appendChild(h('h2', { text: 'Where you stand' }));
        var pri = DX.priorities(ctx, A);
        var lead;
        if (pri.length) {
            lead = 'Your best next step is ' + DX.topicLabel(ctx, pri[0].id) + '. See the Study Plan tab for links.';
        } else {
            lead = 'There are not enough questions on any one topic yet to name a priority area. Take more tests and the picture sharpens.';
        }
        p.appendChild(h('p', { class: 'dx-sub', text: lead }));

        p.appendChild(h('h3', { class: 'dx-group-title', text: 'By unit' }));
        p.appendChild(unitRows(A.poolStats, true));
        p.appendChild(h('p', { class: 'dx-note', text: 'Bars combine' + (many ? ' all of your tests' : ' your test') + '. A unit needs at least 10 questions for a full score and 4 for an early signal. Research and data questions count toward skills and Unit 0, not toward the unit they are set in. Strong is 80% or higher, developing is 60 to 79%, and priority is below 60%.' }));

        p.appendChild(h('h3', { class: 'dx-group-title', text: 'By skill' }));
        p.appendChild(practiceRows(A.poolStats, true));
        p.appendChild(h('p', { class: 'dx-note', text: 'Concept Application is how you use psychology in a scenario. Research Methods and Data Interpretation are the skills the AP exam tests inside every unit.' }));
        return p;
    }

    /* ---------- tab: units and topics ---------- */
    function unitsAndTopics() {
        var p = unitsPanel || (unitsPanel = h('div'));
        p.textContent = '';
        var S = scope === 'this' ? A.thisStats : A.poolStats;
        var pooled = scope === 'all';

        p.appendChild(h('h2', { text: 'Units and topics' }));
        var tog = h('div', { class: 'dx-toggle', role: 'group', 'aria-label': 'Which results to show' });
        [['this', 'This test'], ['all', 'All my tests']].forEach(function (o) {
            var b = h('button', { type: 'button', 'aria-pressed': scope === o[0] ? 'true' : 'false', text: o[1] });
            b.addEventListener('click', function () { scope = o[0]; unitsAndTopics(); });
            tog.appendChild(b);
        });
        p.appendChild(tog);
        p.appendChild(h('p', { class: 'dx-note', text: pooled
            ? 'Questions never repeat from one test to the next, so combining tests gives a bigger sample for each topic. If you retake a test, only your newest answers count.'
            : 'Only the questions from this test.' }));

        p.appendChild(h('h3', { class: 'dx-group-title', text: 'Units' }));
        p.appendChild(unitRows(S, pooled));

        p.appendChild(h('h3', { class: 'dx-group-title', text: 'Topics' }));
        p.appendChild(h('p', { class: 'dx-note', text: 'A topic gets a full score with at least 3 questions in one test, or 5 across your tests. With fewer, a score swings too much to trust, so it is shown in gray. The tag shows how often the topic appears on real AP practice exams.' }));
        var ids = Object.keys(S.topic).sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
        if (!ids.length) {
            p.appendChild(h('p', { class: 'dx-empty', text: 'No topic questions in these results.' }));
        }
        var lastUnit = null;
        var ul = null;
        ids.forEach(function (id) {
            var u = 'Unit ' + String(id).split('.')[0];
            if (u !== lastUnit) {
                lastUnit = u;
                p.appendChild(h('h4', { class: 'dx-group-title', style: 'font-size:1rem;margin-top:16px', text: u + ': ' + (ctx.unitTitles[u] || '') }));
                ul = h('ul', { class: 'dx-rows' });
                p.appendChild(ul);
            }
            var b = S.topic[id];
            var status = DX.rule.topic(b, scope);
            var title = (ctx.topics[id] && ctx.topics[id].title) || '';
            ul.appendChild(makeRow({ label: id + ' ' + title, href: DX.guideLink(id), b: b, status: status, pooled: pooled, exam: examTag(id) }));
        });

        if (pooled) {
            var skillIds = Object.keys(A.poolStats.skill).sort();
            var shown = skillIds.filter(function (k) { var b = A.poolStats.skill[k]; return DX.rule.skill(b) === 'full'; });
            p.appendChild(h('h3', { class: 'dx-group-title', text: 'Single skills' }));
            if (shown.length) {
                var sul = h('ul', { class: 'dx-rows' });
                shown.forEach(function (k) {
                    var b = A.poolStats.skill[k];
                    sul.appendChild(makeRow({ label: k + ' ' + DX.SKILL_NAMES[k], b: b, status: 'full', pooled: true }));
                });
                p.appendChild(sul);
            } else {
                p.appendChild(h('p', { class: 'dx-note', text: 'Single skills such as 2.B or 3.C need at least 5 questions combined across 2 or more tests before a score is shown.' }));
            }
        }
        return p;
    }

    /* ---------- tab: study plan ---------- */
    function linkRow(links) {
        var row = h('div', { class: 'dx-links' });
        links.forEach(function (l, i) { row.appendChild(h('a', { class: 'dx-btn ' + (i === 0 ? 'solid' : 'quiet'), href: l.href, text: l.label })); });
        return row;
    }

    function studyPlan() {
        var p = h('div');
        p.appendChild(h('h2', { text: 'Your study plan' }));
        var pri = DX.priorities(ctx, A);
        var skills = DX.skillPriorities(A);

        if (pri.length) {
            p.appendChild(h('p', { class: 'dx-sub', text: 'Topics are ranked by how much room you have to improve and how often the topic shows up on real AP practice exams.' }));
            var list = h('ol', { class: 'dx-prio-list' });
            pri.forEach(function (x) {
                var w = ctx.weights[x.id];
                var why = x.pct + '% correct (' + x.c + ' of ' + x.n + ' questions).';
                if (w) { why += ' ' + w.band + ' on real exams: about ' + (Math.round(w.avg * 10) / 10) + ' of 75 questions.'; }
                list.appendChild(h('li', { class: 'dx-prio' }, [
                    h('h3', {}, [h('a', { class: 'dx-toplink', href: DX.guideLink(x.id), text: DX.topicLabel(ctx, x.id) })]),
                    h('p', { class: 'why', text: why }),
                    linkRow(DX.activityLinks(x.id))
                ]));
            });
            p.appendChild(list);
        } else {
            var weakest = null;
            Object.keys(A.poolStats.unit).forEach(function (u) {
                var b = A.poolStats.unit[u];
                if (DX.rule.unit(b.n) === 'thin') { return; }
                var pc = DX.pct(b.c, b.n);
                if (!weakest || pc < weakest.pct) { weakest = { u: u, pct: pc, n: b.n }; }
            });
            p.appendChild(h('div', { class: 'dx-notice' }, [
                h('p', { text: 'No priority topics yet. That can mean two things: no topic has enough questions to judge, or every topic with enough questions is above 80%.' }),
                h('p', { text: 'A topic needs 3 questions in one test, or 5 across your tests, before it can be ranked.' })
            ]));
            if (weakest) {
                p.appendChild(h('p', { text: 'Your lowest unit so far is ' + weakest.u + ': ' + (ctx.unitTitles[weakest.u] || '') + ' at ' + weakest.pct + '%.' }));
                p.appendChild(linkRow([{ href: 'studyguide', label: 'Open the study guides' }, { href: 'flashcards', label: 'Flashcards' }, { href: 'quiz', label: 'Quick Check quiz' }]));
            }
        }

        if (skills.length) {
            p.appendChild(h('h3', { class: 'dx-group-title', text: 'Skills to work on' }));
            skills.forEach(function (s) {
                var links = s.guides.map(function (g) { return { href: DX.guideLink(g), label: 'Study guide ' + g }; });
                links.push({ href: 'quiz', label: 'Quick Check quiz' });
                p.appendChild(h('div', { class: 'dx-prio' }, [
                    h('h3', { text: DX.PRACTICE[s.key] }),
                    h('p', { class: 'why', text: s.pct + '% correct (' + s.c + ' of ' + s.n + ' questions). These questions appear in every unit, so improving here raises every score.' }),
                    linkRow(links)
                ]));
            });
        }

        p.appendChild(h('h3', { class: 'dx-group-title', text: 'A simple routine' }));
        var ol = h('ol', { class: 'plain' });
        ['Read the study guide for your top priority topic.', 'Drill it with flashcards, then the Quick Check quiz.', 'Play a game to make the terms stick.', 'Come back for another diagnostic test in a week or two. Your results combine, so the picture gets more accurate each time.'].forEach(function (t) { ol.appendChild(h('li', { text: t })); });
        p.appendChild(ol);
        return p;
    }

    /* ---------- tab: review ---------- */
    function reviewPanel() {
        var p = h('div');
        p.appendChild(h('h2', { text: 'Review your answers' }));
        var filters = h('div', { class: 'dx-filters', role: 'group', 'aria-label': 'Filter questions' });
        var cards = [];
        var flagged = {};
        (attempt.flags || []).forEach(function (id) { flagged[id] = true; });
        var defs = [
            ['all', 'All', function () { return true; }],
            ['wrong', 'Incorrect', function (c) { return c.state === 'wrong'; }],
            ['skipped', 'Not answered', function (c) { return c.state === 'skipped'; }],
            ['flagged', 'Flagged', function (c) { return c.flagged; }]
        ];
        var current = 'all';
        var empty = h('p', { class: 'dx-empty', text: 'Nothing here. Nice.', hidden: '' });
        function apply() {
            var f = defs.filter(function (d) { return d[0] === current; })[0][2];
            var any = false;
            cards.forEach(function (c) { var show = f(c); c.el.hidden = !show; if (show) { any = true; } });
            empty.hidden = any;
            Array.prototype.forEach.call(filters.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === current ? 'true' : 'false'); });
        }
        defs.forEach(function (d) {
            var b = h('button', { type: 'button', 'data-k': d[0], 'aria-pressed': d[0] === 'all' ? 'true' : 'false', text: d[1] });
            b.addEventListener('click', function () { current = d[0]; apply(); });
            filters.appendChild(b);
        });
        p.appendChild(filters);

        var list = h('div');
        var flat = (function () {
            /* rebuild the set structure from the saved test version, if it is still in the data file */
            if (attempt.items) { return DX.flatten(ctx, { items: attempt.items }); }
            var t = DX.findTest(ctx, attempt.testId, attempt.version);
            return t && !DX.isDraw(t) ? DX.flatten(ctx, t) : null;
        })();
        attempt.qids.forEach(function (id, i) {
            var q = ctx.questions[id];
            if (!q) { return; }
            var mine = (attempt.answers && attempt.answers[id]) || null;
            var state = !mine ? 'skipped' : (mine === q.answer ? 'right' : 'wrong');
            var card = h('article', { class: 'dx-rq ' + state });
            var head = h('div', { class: 'dx-rq-head' }, [h('b', { text: 'Question ' + (i + 1) })]);
            head.appendChild(h('span', { class: 'dx-tag ' + (state === 'right' ? 'strong' : (state === 'wrong' ? 'priority' : 'thin')), text: state === 'right' ? 'Correct' : (state === 'wrong' ? 'Incorrect' : 'Not answered') }));
            if (flagged[id]) { head.appendChild(h('span', { class: 'dx-chip', style: 'margin-left:0', text: 'Flagged' })); }
            card.appendChild(head);
            var tags = h('div', { class: 'dx-tag-row' });
            var topicTitle = (ctx.topics[q.topic] && ctx.topics[q.topic].title) || '';
            tags.appendChild(h('a', { class: 'dx-tag dx-taglink', href: DX.guideLink(q.topic), title: 'Open the study guide', text: 'Topic ' + q.topic + (topicTitle ? ' ' + topicTitle : '') }));
            tags.appendChild(h('span', { class: 'dx-tag', text: 'Skill ' + q.skill }));
            card.appendChild(tags);

            var stimId = q.stimulus_id;
            if (stimId && ctx.stimuli[stimId]) {
                var firstOfSet = true;
                if (flat) { var b = flat.blocks[flat.blockOf[i]]; firstOfSet = b && b.start === i; }
                var det = h('details', {}, [h('summary', { text: 'Show the information for this question' })]);
                if (firstOfSet) { det.setAttribute('open', ''); }
                det.appendChild(DX.stimulusEl(ctx, stimId));
                card.appendChild(det);
            }
            var stimFigs = stimId && ctx.stimuli[stimId] ? (ctx.stimuli[stimId].figure_ids || []) : [];
            (q.figure_ids || []).forEach(function (fid) {
                if (stimFigs.indexOf(fid) >= 0) { return; }
                var fe = DX.figureEl(ctx, fid);
                if (fe) { card.appendChild(fe); }
            });
            card.appendChild(h('p', { class: 'dx-qtext', text: q.question }));
            var ul = h('ul', { class: 'dx-ropts' });
            DX.LETTERS.forEach(function (L, k) {
                var cls = (L === q.answer ? 'key' : '') + (L === mine && L !== q.answer ? ' mine' : '');
                var li = h('li', { class: cls.trim() }, [h('span', { class: 'L', text: L }), h('span', { text: q.options[k] })]);
                var mark = [];
                if (L === q.answer) { mark.push('Correct answer'); }
                if (L === mine) { mark.push('Your answer'); }
                if (mark.length) { li.appendChild(h('span', { class: 'm', text: mark.join(', ') })); }
                ul.appendChild(li);
            });
            card.appendChild(ul);
            var ex = h('div', { class: 'dx-expl' }, [h('p', { text: q.explanation })]);
            if (mine && mine !== q.answer && q.distractor_notes && q.distractor_notes[mine]) {
                ex.appendChild(h('p', { text: 'About your answer (' + mine + '): ' + q.distractor_notes[mine] }));
            }
            card.appendChild(ex);
            cards.push({ el: card, state: state, flagged: !!flagged[id] });
            list.appendChild(card);
        });
        p.appendChild(list);
        p.appendChild(empty);
        return p;
    }

    /* ---------- tabs ---------- */
    function buildTabs() {
        var defs = [
            { key: 'overview', label: 'Overview', make: overviewPanel },
            { key: 'units', label: 'Units and Topics', make: unitsAndTopics },
            { key: 'plan', label: 'Study Plan', make: studyPlan },
            { key: 'review', label: 'Review Answers', make: reviewPanel }
        ];
        var tabs = $('dxTabs'), panels = $('dxTabPanels');
        tabs.textContent = '';
        panels.textContent = '';
        var btns = [], pans = [];
        function select(k, focus) {
            defs.forEach(function (d, i) {
                var on = d.key === k;
                btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
                btns[i].tabIndex = on ? 0 : -1;
                pans[i].hidden = !on;
                if (on && focus) { btns[i].focus(); }
            });
            try { history.replaceState(null, '', '#' + k); } catch (e) { /* ignore */ }
        }
        defs.forEach(function (d, i) {
            var b = h('button', { type: 'button', class: 'dx-tab', role: 'tab', id: 'tab-' + d.key, 'aria-controls': 'panel-' + d.key, 'aria-selected': 'false', text: d.label });
            b.addEventListener('click', function () { select(d.key, false); });
            b.addEventListener('keydown', function (e) {
                var n = null;
                if (e.key === 'ArrowRight') { n = (i + 1) % defs.length; }
                else if (e.key === 'ArrowLeft') { n = (i + defs.length - 1) % defs.length; }
                else if (e.key === 'Home') { n = 0; }
                else if (e.key === 'End') { n = defs.length - 1; }
                if (n !== null) { e.preventDefault(); select(defs[n].key, true); }
            });
            btns.push(b);
            tabs.appendChild(b);
            var panel = h('div', { role: 'tabpanel', id: 'panel-' + d.key, 'aria-labelledby': 'tab-' + d.key, 'data-print-title': d.label, hidden: '' });
            panel.appendChild(d.make());
            pans.push(panel);
            panels.appendChild(panel);
        });
        var start = (location.hash || '').replace('#', '');
        select(defs.some(function (d) { return d.key === start; }) ? start : 'overview', false);
        $('dxTabsPanel').hidden = false;
    }

    /* ---------- boot ---------- */
    DX.load().then(function (c) {
        ctx = c;
        var id = DX.param('attempt');
        A = DX.analyze(ctx, id);
        attempt = A.current;
        if (!attempt) {
            $('dxResTitle').textContent = 'No results found';
            $('dxResLede').textContent = 'We could not find those results in this browser.';
            var n = notice('warn', 'Results are saved only in the browser where you took the test. If you used a different browser or device, or cleared your history, they will not be here.');
            n.appendChild(h('a', { class: 'dx-btn solid', href: 'diagnostics', text: 'Diagnostic Tests' }));
            return;
        }
        if (!DX.checkStorage()) { notice('warn', 'This browser is blocking saved data, so these results will disappear when you leave the page.'); }
        scope = A.attempts.length > 1 ? 'all' : 'this';
        renderSummary();
        buildTabs();
    }).catch(function (err) {
        $('dxResTitle').textContent = 'Could not load results';
        notice('warn', 'The results could not be loaded. Please refresh the page.');
        if (window.console) { console.error(err); }
    });
})();
