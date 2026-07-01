// Format check for the twelve-point circle.
//
// Runs the REAL js/twelvepoints.js under jsdom against in-memory CSV rows (no
// HTTP, no file fetch) and asserts on the rendered SVG DOM. Two scenarios:
// every month "yes" and every month "no". Run with: npm test
//
// .gitignore ignores `test*`, so this lives in checks/ with a name that does
// not start with "test" (keeps it tracked by git).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const d3Src = readFileSync(join(root, 'd3', 'd3.v4.js'), 'utf8');
const d3MultiSrc = readFileSync(join(root, 'd3', 'd3-selection-multi.js'), 'utf8');
const appSrc = readFileSync(join(root, 'js', 'twelvepoints.js'), 'utf8');

// The year under test: July 2026 -> June 2027 (matches twelvepoints.csv).
const MONTHS = [
    '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01',
];
const EXPECTED_LABELS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const rowsWith = (status) => MONTHS.map((month) => ({ month, status }));

function inject(window, src) {
    const el = window.document.createElement('script');
    el.textContent = src;
    window.document.head.appendChild(el);
}

// Render the real app for one scenario and return the drawn SVG elements.
// fixedNowISO pins what `new Date()` returns inside the app, so colour classes
// (which depend on "now") are deterministic.
function render(rows, fixedNowISO) {
    const { window } = new JSDOM(
        `<!DOCTYPE html><html><head></head><body>
           <svg width="800px" height="800px">
             <g class="circle" transform="translate(330,330)"></g>
           </svg>
         </body></html>`,
        { runScripts: 'dangerously' },
    );

    // Load the vendored d3 + the .attrs plugin into the window.
    inject(window, d3Src);
    inject(window, d3MultiSrc);

    // Deterministic "now": zero-arg `new Date()` -> fixed instant; any-arg
    // (e.g. new Date(d.month)) passes through unchanged.
    const RealDate = window.Date;
    const fixedTime = new RealDate(fixedNowISO).getTime();
    class FakeDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) super(fixedTime);
            else super(...args);
        }
        static now() { return fixedTime; }
    }
    window.Date = FakeDate;

    // Feed scenario rows instead of fetching twelvepoints.csv.
    window.d3.csv = (path, cb) => cb(null, rows);

    // Run the app; it draws into g.circle synchronously via the stubbed d3.csv.
    inject(window, appSrc);

    const q = (sel) => [...window.document.querySelectorAll(sel)];
    return {
        lines: q('g.circle line'),
        dots: q('g.circle circle'),
        labels: q('g.circle text'),
    };
}

// Shared shape: 12 ordered segments / dots / labels forming a closed ring.
function assertStructure(r) {
    assert.equal(r.lines.length, 12, 'should draw 12 line segments');
    assert.equal(r.dots.length, 12, 'should draw 12 vertex dots');
    assert.equal(r.labels.length, 12, 'should draw 12 month labels');
    assert.deepEqual(
        r.labels.map((t) => t.textContent),
        EXPECTED_LABELS,
        'labels should read Jul..Jun in order',
    );
    // Last segment's end point should meet the first segment's start point.
    // Compare numerically with a tolerance: the wrap angle yields equivalent
    // coordinates but with trig float noise (~1e-13), so exact equality fails.
    const first = r.lines[0];
    const last = r.lines[11];
    const num = (el, attr) => parseFloat(el.getAttribute(attr));
    const closes = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `ring should close (${a} vs ${b})`);
    closes(num(last, 'x2'), num(first, 'x1'));
    closes(num(last, 'y2'), num(first, 'y1'));
}

const classesOf = (r) => r.lines.map((l) => l.getAttribute('class'));

test('all "yes" -> closed ring of 12 green (yes) lines, labels in order', () => {
    const r = render(rowsWith('yes'), '2027-09-15T12:00:00Z');
    assertStructure(r);
    assert.deepEqual(classesOf(r), Array(12).fill('yes'), 'every segment should be class "yes"');
});

test('all "no" (now after the year) -> closed ring of 12 red (no) lines', () => {
    // 2027-09-15 is after the whole year AND a September -> same calendar month
    // as the 2026-09 row. With the month-only bug that row would be "now";
    // with the year+month fix it is "no". So this guards the fix.
    const r = render(rowsWith('no'), '2027-09-15T12:00:00Z');
    assertStructure(r);
    assert.deepEqual(classesOf(r), Array(12).fill('no'), 'every segment should be class "no"');
});
