/* topic-terms.js
   Fills the "Key Terms" block on a study guide page from terms.json.

   Usage on a page:
     <div class="key-terms" data-topic="1.6" data-src="/terms.json"> ... </div>
     <script src="../topic-terms.js" defer></script>

   - Matches every entry whose "topic" equals data-topic.
   - Drops duplicate terms (case-insensitive) and sorts A to Z.
   - 12 terms or fewer show as chips; more than that show as columns.
   - If terms.json can't be loaded (or has nothing for the topic), the block
     quietly keeps its fallback text and just shows the Glossary button. */
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

    document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.key-terms[data-topic]'), init);
    });
})();
