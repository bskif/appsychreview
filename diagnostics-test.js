/* diagnostics-test.js - taking one diagnostic test
   Autosaves every change. A finished test is written to history and the student is sent to the results page. */
(function () {
    'use strict';
    var h = DX.h;
    var $ = function (id) { return document.getElementById(id); };
    var preview = DX.isPreview();
    var previewSuffix = preview ? '&preview=1' : '';

    var ctx, test, flat, S;          // S = saved state for the attempt in progress
    var tickTimer = null, lastTick = 0, lastSave = 0, warned = false, finished = false;

    function notify(kind, text, keep) {
        var box = $('dxNotices');
        var n = h('div', { class: 'dx-notice' + (kind === 'warn' ? ' warn' : '') }, [h('p', { text: text })]);
        if (!keep) { box.textContent = ''; }
        box.appendChild(n);
        return n;
    }

    function total() { return S.qids.length; }
    function answeredCount() { return S.qids.filter(function (id) { return S.answers[id]; }).length; }
    function flaggedCount() { return S.qids.filter(function (id) { return S.flags[id]; }).length; }

    /* ---------- saving ---------- */
    var savedTimeout = null;
    function save(showSaved) {
        S.savedAt = Date.now();
        DX.setProgress(test.test_id, S);
        if (showSaved) {
            var el = $('dxSaved');
            el.textContent = DX.storageProblem ? 'Not saved (browser is blocking storage)' : 'Saved';
            clearTimeout(savedTimeout);
            savedTimeout = setTimeout(function () { el.textContent = ''; }, 1800);
        }
    }

    function newState(timed) {
        return {
            testId: test.test_id, version: test.version, name: test.name, type: test.type, unit: test.unit || null,
            qids: flat.qids.slice(), answers: {}, flags: {}, crossed: {}, idx: 0,
            startedAt: Date.now(), activeMs: 0, timed: !!timed, limitMin: test.time_limit_minutes || Math.round(flat.qids.length * 72 / 60),
            hideTimer: false
        };
    }

    /* ---------- timer ---------- */
    function remainingMs() { return S.limitMin * 60000 - S.activeMs; }

    function paintTimer() {
        var el = $('dxTimer');
        if (S.hideTimer) { el.textContent = 'Time hidden'; el.classList.remove('low'); return; }
        if (S.timed) {
            var r = remainingMs();
            el.textContent = DX.fmtClock(r) + ' left';
            el.classList.toggle('low', r < 5 * 60000);
        } else {
            el.textContent = DX.fmtClock(S.activeMs) + ' on test';
            el.classList.remove('low');
        }
    }

    function tick() {
        var now = Date.now();
        S.activeMs += Math.min(now - lastTick, 2000);   /* time while the page is in the background is not counted */
        lastTick = now;
        paintTimer();
        if (S.timed) {
            var r = remainingMs();
            if (!warned && r <= 5 * 60000 && S.limitMin >= 10) {
                warned = true;
                notify('warn', 'About 5 minutes left. Your answers are saved.');
            }
            if (r <= 0) { submit(true); return; }
        }
        if (now - lastSave > 10000) { lastSave = now; save(false); }
    }

    function startTicking() {
        lastTick = Date.now();
        lastSave = lastTick;
        clearInterval(tickTimer);
        tickTimer = setInterval(tick, 1000);
        paintTimer();
    }

    /* ---------- the question screen ---------- */
    var els = {};   /* choice buttons for the current question */

    function go(i) {
        if (i < 0 || i >= total()) { return; }
        S.idx = i;
        showScreen('test');
        renderQuestion();
        refreshPalette();
        save(false);
        window.scrollTo({ top: $('dxTest').getBoundingClientRect().top + window.scrollY - 12, behavior: 'auto' });
    }

    function renderQuestion() {
        var i = S.idx, qid = S.qids[i], q = ctx.questions[qid];
        var panel = $('dxQPanel');
        panel.textContent = '';
        els = {};
        if (!q) {
            panel.appendChild(h('p', { class: 'dx-empty', text: 'This question is not available.' }));
            return;
        }
        var b = flat.blocks[flat.blockOf[i]];
        var hasStim = b.kind === 'set' && b.stimulusId && ctx.stimuli[b.stimulusId];

        var head = h('div', { class: 'dx-qhead' });
        var num = h('div', { class: 'dx-qnum', text: 'Question ' + (i + 1) });
        num.appendChild(h('small', { text: 'of ' + total() }));
        head.appendChild(num);
        var flag = h('button', { type: 'button', class: 'dx-flag', id: 'dxFlag', 'aria-pressed': S.flags[qid] ? 'true' : 'false', text: S.flags[qid] ? 'Flagged for review' : 'Flag for review' });
        flag.addEventListener('click', toggleFlag);
        head.appendChild(flag);
        panel.appendChild(head);

        var body = h('div', { class: 'dx-body' + (hasStim ? ' has-stim' : '') });
        if (hasStim) {
            var first = b.start + 1, last = b.start + b.qids.length;
            var col = h('div', { class: 'dx-stim-col' });
            col.appendChild(h('p', { class: 'dx-set-label', text: first === last ? 'Question ' + first + ' refers to this information' : 'Questions ' + first + ' to ' + last + ' refer to this information' }));
            col.appendChild(DX.stimulusEl(ctx, b.stimulusId));
            body.appendChild(col);
        }
        var qcol = h('div');
        var stimFigs = hasStim ? (ctx.stimuli[b.stimulusId].figure_ids || []) : [];
        (q.figure_ids || []).forEach(function (fid) {
            if (stimFigs.indexOf(fid) >= 0) { return; }
            var fe = DX.figureEl(ctx, fid);
            if (fe) { qcol.appendChild(fe); }
        });
        qcol.appendChild(h('p', { class: 'dx-qtext', id: 'dxQText', text: q.question }));

        var group = h('div', { class: 'dx-choices', role: 'radiogroup', 'aria-labelledby': 'dxQText' });
        DX.LETTERS.forEach(function (L, k) {
            var row = h('div', { class: 'dx-choice' });
            var opt = h('button', { type: 'button', class: 'dx-opt', role: 'radio', 'aria-checked': 'false' }, [
                h('span', { class: 'L', text: L, 'aria-hidden': 'true' }),
                h('span', { class: 'T', text: q.options[k] })
            ]);
            opt.setAttribute('aria-label', 'Choice ' + L + ': ' + q.options[k]);
            opt.addEventListener('click', function () { choose(L); });
            var x = h('button', { type: 'button', class: 'dx-x', 'aria-pressed': 'false', title: 'Cross out choice ' + L, text: 'X' });
            x.setAttribute('aria-label', 'Cross out choice ' + L);
            x.addEventListener('click', function () { cross(L); });
            row.appendChild(opt);
            row.appendChild(x);
            group.appendChild(row);
            els[L] = { opt: opt, x: x };
        });
        qcol.appendChild(group);

        var foot = h('div', { class: 'dx-qfoot' });
        var prev = h('button', { type: 'button', class: 'dx-btn outline', text: 'Previous' });
        if (i === 0) { prev.setAttribute('disabled', ''); } else { prev.addEventListener('click', function () { go(i - 1); }); }
        var clear = h('button', { type: 'button', class: 'dx-clear', id: 'dxClear', text: 'Clear my answer' });
        clear.addEventListener('click', function () { delete S.answers[qid]; refreshChoices(); refreshPalette(); save(true); });
        var last = i === total() - 1;
        var next = h('button', { type: 'button', class: 'dx-btn solid', text: last ? 'Review and submit' : 'Next' });
        next.addEventListener('click', function () { if (last) { showReview(); } else { go(i + 1); } });
        foot.appendChild(prev);
        foot.appendChild(clear);
        foot.appendChild(next);
        body.appendChild(qcol);
        panel.appendChild(body);
        panel.appendChild(foot);
        panel.appendChild(h('p', { class: 'dx-hint', text: 'Keyboard: A to D choose an answer, F flags, the left and right arrow keys move between questions.' }));
        refreshChoices();
    }

    function refreshChoices() {
        var qid = S.qids[S.idx];
        var mine = S.answers[qid] || null;
        var crossed = S.crossed[qid] || [];
        DX.LETTERS.forEach(function (L) {
            var e = els[L];
            if (!e) { return; }
            e.opt.setAttribute('aria-checked', mine === L ? 'true' : 'false');
            e.opt.classList.toggle('crossed', crossed.indexOf(L) >= 0);
            e.x.setAttribute('aria-pressed', crossed.indexOf(L) >= 0 ? 'true' : 'false');
        });
        var clear = $('dxClear');
        if (clear) { clear.style.display = mine ? '' : 'none'; }
    }

    function choose(L) {
        var qid = S.qids[S.idx];
        S.answers[qid] = L;
        var crossed = S.crossed[qid] || [];
        var at = crossed.indexOf(L);
        if (at >= 0) { crossed.splice(at, 1); S.crossed[qid] = crossed; }
        refreshChoices();
        refreshPalette();
        save(true);
    }

    function cross(L) {
        var qid = S.qids[S.idx];
        var crossed = S.crossed[qid] || [];
        var at = crossed.indexOf(L);
        if (at >= 0) { crossed.splice(at, 1); } else { crossed.push(L); }
        S.crossed[qid] = crossed;
        if (S.answers[qid] === L && at < 0) { delete S.answers[qid]; refreshPalette(); }
        refreshChoices();
        save(true);
    }

    function toggleFlag() {
        var qid = S.qids[S.idx];
        if (S.flags[qid]) { delete S.flags[qid]; } else { S.flags[qid] = true; }
        var f = $('dxFlag');
        if (f) {
            f.setAttribute('aria-pressed', S.flags[qid] ? 'true' : 'false');
            f.textContent = S.flags[qid] ? 'Flagged for review' : 'Flag for review';
        }
        refreshPalette();
        save(true);
    }

    function buildPalette() {
        var ol = $('dxPalette');
        ol.textContent = '';
        S.qids.forEach(function (id, i) {
            var li = h('li');
            var b = h('button', { type: 'button', class: 'dx-pq', text: String(i + 1) });
            b.addEventListener('click', function () { go(i); });
            li.appendChild(b);
            ol.appendChild(li);
        });
    }

    function refreshPalette() {
        var btns = $('dxPalette').querySelectorAll('.dx-pq');
        S.qids.forEach(function (id, i) {
            var b = btns[i];
            if (!b) { return; }
            var done = !!S.answers[id], fl = !!S.flags[id];
            b.className = 'dx-pq' + (done ? ' done' : '') + (fl ? ' flagged' : '') + (i === S.idx ? ' cur' : '');
            b.setAttribute('aria-label', 'Question ' + (i + 1) + (done ? ', answered' : ', not answered') + (fl ? ', flagged' : ''));
            if (i === S.idx) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); }
        });
    }

    /* ---------- review and submit ---------- */
    function showReview() {
        var left = total() - answeredCount();
        var fl = flaggedCount();
        var parts = [answeredCount() + ' of ' + total() + ' answered'];
        if (fl) { parts.push(fl + ' flagged'); }
        $('dxReviewSummary').textContent = parts.join(', ') + '.' + (left ? ' Unanswered questions count as incorrect.' : '');
        var ul = $('dxReviewList');
        ul.textContent = '';
        S.qids.forEach(function (id, i) {
            var ans = S.answers[id];
            var li = h('li');
            li.appendChild(h('button', { type: 'button', class: 'dx-btn quiet', text: 'Question ' + (i + 1) }));
            li.firstChild.addEventListener('click', function () { go(i); });
            if (S.flags[id]) { li.appendChild(h('span', { class: 'dx-chip', text: 'Flagged' })); }
            li.appendChild(h('span', { class: 'st ' + (ans ? 'ok' : 'un'), text: ans ? 'Answered' : 'Not answered' }));
            ul.appendChild(li);
        });
        showScreen('review');
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function submit(timedOut) {
        if (finished) { return; }
        finished = true;
        clearInterval(tickTimer);
        var attempt = {
            id: DX.newId(), testId: S.testId, version: S.version, name: S.name, type: S.type, unit: S.unit,
            qids: S.qids.slice(), answers: S.answers, flags: Object.keys(S.flags),
            startedAt: S.startedAt, submittedAt: Date.now(), activeMs: S.activeMs,
            timed: S.timed, limitMin: S.limitMin, timedOut: !!timedOut
        };
        DX.saveAttempt(attempt);
        DX.dropProgress(S.testId);
        location.href = 'diagnostic-results?attempt=' + encodeURIComponent(attempt.id) + previewSuffix;
    }

    /* ---------- screens ---------- */
    function showScreen(which) {
        $('dxIntro').hidden = which !== 'intro';
        $('dxTest').hidden = which !== 'test';
        $('dxReview').hidden = which !== 'review';
        $('dxHero').hidden = which !== 'intro';
        $('dxMain').style.marginTop = which === 'intro' ? '' : '18px';
    }

    function beginTest(resume) {
        if (!resume) {
            var timed = document.querySelector('input[name="dxTimer"]:checked').value === 'on';
            S = newState(timed);
            save(false);
        }
        $('dxBarTitle').textContent = S.name + (S.timed ? ' (timed)' : '');
        $('dxHideTimer').setAttribute('aria-pressed', S.hideTimer ? 'true' : 'false');
        $('dxHideTimer').textContent = S.hideTimer ? 'Show time' : 'Hide time';
        buildPalette();
        showScreen('test');
        renderQuestion();
        refreshPalette();
        startTicking();
        $('dxNotices').textContent = '';
    }

    function showIntro() {
        var n = flat.qids.length;
        var limit = test.time_limit_minutes || Math.round(n * 72 / 60);
        $('dxTestTitle').textContent = test.name;
        $('dxTestLede').textContent = n + ' questions, about ' + limit + ' minutes.';
        $('dxTimedLabel').textContent = '';
        $('dxTimedLabel').appendChild(document.createTextNode('Timed: ' + limit + ' minutes'));
        $('dxTimedLabel').appendChild(h('small', { text: 'About 72 seconds per question, like the real exam. The timer pauses if you leave the page.' }));
        document.title = test.name + ' - Psych Review Hub';

        var saved = DX.getProgress(test.test_id);
        var resumeBox = $('dxResume');
        resumeBox.textContent = '';
        var usable = saved && saved.version === test.version && JSON.stringify(saved.qids) === JSON.stringify(flat.qids);
        if (saved && !usable) { DX.dropProgress(test.test_id); }
        if (usable) {
            var done = Object.keys(saved.answers || {}).filter(function (k) { return saved.answers[k]; }).length;
            var box = h('div', { class: 'dx-notice' }, [
                h('p', { text: 'You have an unfinished attempt: ' + done + ' of ' + saved.qids.length + ' answered' + (saved.timed ? ', timed' : '') + '.' })
            ]);
            var r = h('button', { type: 'button', class: 'dx-btn solid', text: 'Resume where I left off' });
            var s = h('button', { type: 'button', class: 'dx-btn outline', text: 'Start over' });
            r.addEventListener('click', function () { S = saved; beginTest(true); go(Math.min(S.idx || 0, total() - 1)); });
            s.addEventListener('click', function () {
                DX.dropProgress(test.test_id);
                box.remove();
                $('dxStart').focus();
            });
            box.appendChild(r);
            box.appendChild(document.createTextNode(' '));
            box.appendChild(s);
            box.appendChild(h('p', { text: 'Starting over discards that attempt. Finished results are not affected.' }));
            resumeBox.appendChild(box);
        }
        showScreen('intro');
    }

    /* ---------- boot ---------- */
    DX.load().then(function (ctxLoaded) {
        ctx = ctxLoaded;
        var id = DX.param('test');
        test = id ? DX.findTest(ctx, id) : null;
        if (!test || (!DX.testReady(ctx, test))) {
            $('dxTestTitle').textContent = 'Test not found';
            $('dxTestLede').textContent = 'That test is not available yet.';
            notify('warn', 'We could not find that test. Head back to the Diagnostic Tests page to pick one.');
            $('dxNotices').firstChild.appendChild(h('a', { class: 'dx-btn solid', href: 'diagnostics', text: 'Diagnostic Tests' }));
            return;
        }
        flat = DX.flatten(ctx, test);
        if (preview) { notify('warn', 'Preview mode: this test may include draft or reviewed questions that students cannot see.', true); }
        if (!DX.checkStorage()) { notify('warn', 'This browser is blocking saved data, so your progress will not be saved if you leave the page.', true); }

        $('dxStart').addEventListener('click', function () { beginTest(false); });
        $('dxToReview').addEventListener('click', showReview);
        $('dxBack').addEventListener('click', function () { go(Math.min(S.idx, total() - 1)); });
        $('dxSubmit').addEventListener('click', function () { submit(false); });
        $('dxHideTimer').addEventListener('click', function () {
            S.hideTimer = !S.hideTimer;
            this.setAttribute('aria-pressed', S.hideTimer ? 'true' : 'false');
            this.textContent = S.hideTimer ? 'Show time' : 'Hide time';
            paintTimer();
            save(false);
        });
        document.addEventListener('keydown', function (e) {
            if (!S || $('dxTest').hidden || e.ctrlKey || e.metaKey || e.altKey) { return; }
            var tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
            var k = e.key;
            if (/^[a-dA-D]$/.test(k)) { choose(k.toUpperCase()); e.preventDefault(); }
            else if (k === 'f' || k === 'F') { toggleFlag(); e.preventDefault(); }
            else if (k === 'ArrowRight') { go(S.idx + 1); e.preventDefault(); }
            else if (k === 'ArrowLeft') { go(S.idx - 1); e.preventDefault(); }
        });
        window.addEventListener('pagehide', function () { if (S && !finished) { save(false); } });
        showIntro();
    }).catch(function (err) {
        $('dxTestTitle').textContent = 'Could not load the test';
        notify('warn', 'The test could not be loaded. Please refresh the page.');
        if (window.console) { console.error(err); }
    });
})();
