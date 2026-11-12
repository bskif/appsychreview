/* diagnostics-hub.js - the Diagnostic Tests landing page */
(function () {
    'use strict';
    var h = DX.h;
    var preview = DX.isPreview();
    var previewSuffix = preview ? '&preview=1' : '';

    function notice(kind, nodes) {
        var box = h('div', { class: 'dx-notice' + (kind === 'warn' ? ' warn' : '') }, nodes);
        document.getElementById('dxNotices').appendChild(box);
        return box;
    }

    function familyOf(t) { return String(t.test_id).replace(/-v\d+$/, ''); }

    function attemptsFor(history, t) {
        var fam = familyOf(t);
        return history.filter(function (a) { return familyOf({ test_id: a.testId }) === fam; })
            .sort(function (a, b) { return b.submittedAt - a.submittedAt; });
    }

    function scoreOf(ctx, a) {
        var c = 0;
        a.qids.forEach(function (id) { var q = ctx.questions[id]; if (q && a.answers && a.answers[id] === q.answer) { c++; } });
        return { c: c, n: a.qids.length };
    }

    function testCard(ctx, t, history, progress, title, eyebrow) {
        var count = DX.testSize(t);
        var mine = attemptsFor(history, t);
        var prog = progress.filter(function (p) { return familyOf({ test_id: p.testId }) === familyOf(t); })[0];
        var card = h('div', { class: 'dx-card' });
        card.appendChild(h('p', { class: 'dx-unit', text: eyebrow }));
        var heading = h('h3', { text: title });
        if (prog) { heading.appendChild(h('span', { class: 'dx-chip', text: 'In progress' })); }
        card.appendChild(heading);
        var meta = h('ul', { class: 'dx-meta' }, [
            h('li', { text: count + ' questions' }),
            h('li', { text: 'about ' + (t.time_limit_minutes || Math.round(count * 72 / 60)) + ' min' })
        ]);
        card.appendChild(meta);
        card.appendChild(h('div', { class: 'dx-spacer' }));
        if (mine.length) {
            var s = scoreOf(ctx, mine[0]);
            card.appendChild(h('p', { class: 'dx-last', text: 'Last result: ' + s.c + ' of ' + s.n + ' (' + DX.pct(s.c, s.n) + '%) on ' + DX.fmtDate(mine[0].submittedAt) }));
        } else if (prog) {
            var answered = Object.keys(prog.answers || {}).filter(function (k) { return prog.answers[k]; }).length;
            card.appendChild(h('p', { class: 'dx-last', text: answered + ' of ' + (prog.qids || []).length + ' answered so far.' }));
        }
        var actions = h('div', { class: 'dx-actions' });
        var startLabel = prog ? 'Resume' : (mine.length ? 'Take again' : 'Start');
        actions.appendChild(h('a', { class: 'dx-btn solid', href: 'diagnostic-test?test=' + encodeURIComponent(t.test_id) + previewSuffix, text: startLabel }));
        if (mine.length) {
            actions.appendChild(h('a', { class: 'dx-btn outline', href: 'diagnostic-results?attempt=' + encodeURIComponent(mine[0].id) + previewSuffix, text: 'Last results' }));
        }
        card.appendChild(actions);
        return card;
    }

    function soonCard(title, eyebrow, line) {
        return h('div', { class: 'dx-card soon' }, [
            h('p', { class: 'dx-unit', text: eyebrow }),
            h('h3', { text: title }),
            h('ul', { class: 'dx-meta' }, [h('li', { text: 'Coming soon' })]),
            h('p', { class: 'dx-last', text: line || '' })
        ]);
    }

    function renderHistory(ctx) {
        var box = document.getElementById('dxHistory');
        box.textContent = '';
        var history = DX.getHistory().slice().sort(function (a, b) { return b.submittedAt - a.submittedAt; });
        if (!history.length) {
            box.appendChild(h('p', { class: 'dx-empty', text: 'No saved results yet. Finish a test and it will appear here.' }));
        } else {
            var table = h('table', { class: 'dx-history' });
            table.appendChild(h('thead', {}, [h('tr', {}, ['Date', 'Test', 'Score', 'Time', ''].map(function (x) { return h('th', { scope: 'col', text: x }); }))]));
            var tb = h('tbody');
            history.forEach(function (a) {
                var s = scoreOf(ctx, a);
                tb.appendChild(h('tr', {}, [
                    h('td', { text: DX.fmtDate(a.submittedAt) }),
                    h('td', { text: a.name || a.testId }),
                    h('td', { text: s.c + ' of ' + s.n + ' (' + DX.pct(s.c, s.n) + '%)' }),
                    h('td', { text: a.timed ? DX.fmtDuration(a.activeMs) + ' (timed)' : DX.fmtDuration(a.activeMs) }),
                    h('td', {}, [h('a', { href: 'diagnostic-results?attempt=' + encodeURIComponent(a.id) + previewSuffix, text: 'View results' })])
                ]));
            });
            table.appendChild(tb);
            box.appendChild(table);
        }

        var row = h('div', { class: 'dx-clear-row' });
        var confirmBox = h('span');
        var clearBtn = h('button', { type: 'button', class: 'dx-btn quiet', text: 'Clear history' });
        clearBtn.addEventListener('click', function () {
            confirmBox.textContent = '';
            confirmBox.appendChild(h('span', { class: 'dx-note', text: 'This deletes every saved result and any unfinished test from this browser. It cannot be undone. ' }));
            var yes = h('button', { type: 'button', class: 'dx-btn warm', text: 'Yes, delete everything' });
            var no = h('button', { type: 'button', class: 'dx-btn quiet', text: 'Cancel' });
            yes.addEventListener('click', function () { DX.clearAll(); location.reload(); });
            no.addEventListener('click', function () { confirmBox.textContent = ''; clearBtn.focus(); });
            confirmBox.appendChild(yes);
            confirmBox.appendChild(document.createTextNode(' '));
            confirmBox.appendChild(no);
            yes.focus();
        });
        row.appendChild(clearBtn);
        row.appendChild(confirmBox);
        box.appendChild(row);
        box.appendChild(h('p', { class: 'dx-note', text: 'Saved in this browser only. On a shared or school computer, use Clear history when you are done.' }));
    }

    DX.load().then(function (ctx) {
        if (!DX.checkStorage()) {
            notice('warn', [h('p', { text: 'This browser is blocking saved data, so your progress and results will be lost when you leave the page. Try a regular (not private) window.' })]);
        }
        if (preview) {
            var probs = DX.validate(ctx);
            var box = notice('warn', [h('p', { text: 'Preview mode: draft and reviewed questions are included. Students do not see these.' })]);
            if (probs.length) {
                var det = h('details', {}, [h('summary', { text: probs.length + ' content check item' + (probs.length === 1 ? '' : 's') })]);
                var ul = h('ul');
                probs.slice(0, 80).forEach(function (p) { ul.appendChild(h('li', { text: p.id + ': ' + p.msg })); });
                det.appendChild(ul);
                box.appendChild(det);
            } else {
                box.appendChild(h('p', { text: 'Content checks: no problems found.' }));
            }
            ctx.tests.filter(DX.isDraw).forEach(function (t) {
                var rows = DX.poolReport(ctx, t);
                var short = rows.filter(function (r) { return r.have < r.need; }).length;
                var det = h('details', {}, [h('summary', { text: 'Question pool: ' + t.name + (short ? ' (' + short + ' slot' + (short === 1 ? '' : 's') + ' short)' : ' (ready)') })]);
                var ul = h('ul');
                rows.forEach(function (r) {
                    var depth = r.need ? Math.round((r.have / r.need) * 10) / 10 : 0;
                    ul.appendChild(h('li', { text: r.label + ': ' + r.have + ' ' + (r.have === 1 ? r.unit.replace(/s$/, '') : r.unit) + ' for ' + r.need + ' needed (' + depth + 'x)' }));
                });
                det.appendChild(ul);
                box.appendChild(det);
            });
        }

        var history = DX.getHistory();
        var progress = DX.listProgress();
        var ready = DX.latestTests(ctx);

        var unitGrid = document.getElementById('dxUnitGrid');
        unitGrid.textContent = '';
        ['Unit 0', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'].forEach(function (u) {
            var t = ready.filter(function (x) { return x.type === 'unit' && x.unit === u; })[0];
            var title = ctx.unitTitles[u] || u;
            unitGrid.appendChild(t ? testCard(ctx, t, history, progress, title, u) : soonCard(title, u, 'This unit test is being written.'));
        });

        var fullGrid = document.getElementById('dxFullGrid');
        fullGrid.textContent = '';
        var others = ready.filter(function (x) { return x.type === 'full' || x.type === 'quick'; })
            .sort(function (a, b) { return String(a.test_id).localeCompare(String(b.test_id)); });
        if (others.length) {
            others.forEach(function (t) { fullGrid.appendChild(testCard(ctx, t, history, progress, t.name, t.type === 'quick' ? 'Quick diagnostic' : 'Full practice exam')); });
        } else {
            fullGrid.appendChild(soonCard('Full practice exams', 'Full-length', '75 questions each, timed or untimed.'));
            fullGrid.appendChild(soonCard('Quick diagnostic', 'Short check', '24 questions across all units.'));
        }

        renderHistory(ctx);
    }).catch(function (err) {
        document.getElementById('dxUnitGrid').textContent = '';
        notice('warn', [h('p', { text: 'The tests could not be loaded. Please refresh the page, and let me know if it keeps happening.' })]);
        if (window.console) { console.error(err); }
    });
})();
