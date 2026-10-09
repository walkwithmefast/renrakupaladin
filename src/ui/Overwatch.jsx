// Matrix Marks & Overwatch Score, shown next to the Matrix devices table (Gear tab's Programs subtab in
// Build, the Gear & Matrix tab in Play). See engine/overwatch.js for why Overwatch Score is a manual
// clock rather than something this app calculates for you.
import { useState } from 'preact/hooks';
import { playState } from '../engine/edge.js';
import {
  MARK_MAX, OS_CONVERGENCE, MARKS_PAGE, OS_PAGE, addMarkTarget, setMarks, removeMarkTarget, addOverwatch, setOverwatch, resetOverwatch,
} from '../engine/overwatch.js';
import { Panel, Dots, Empty, bookUrl, cx } from './common.jsx';

export function OverwatchPanel({ ch, update, compact }) {
  const [name, setName] = useState('');
  const play = playState(ch);
  const os = play.overwatch;
  const over = os >= OS_CONVERGENCE;
  const near = !over && os >= OS_CONVERGENCE - 10;
  const marksUrl = bookUrl('SR5', MARKS_PAGE);
  const osUrl = bookUrl('SR5', OS_PAGE);
  const submit = (e) => {
    e.preventDefault();
    const t = name.trim();
    if (!t) return;
    update((x) => addMarkTarget(x, t), { record: false });
    setName('');
  };

  if (compact) {
    // one strip: marks as chips with their dots, and the Overwatch clock (Play-mode Matrix tab)
    return (
      <Panel title="Marks & Overwatch" sub="a clock you (or your GM) advance by hand"
        right={<span class="dim small">{marksUrl && <a class="src" href={marksUrl} target="_blank" rel="noopener">Marks p.{MARKS_PAGE} ↗</a>} {osUrl && <a class="src" href={osUrl} target="_blank" rel="noopener">Overwatch p.{OS_PAGE} ↗</a>}</span>}>
        <div class="ow-strip">
          <div class="ow-marks">
            {play.marks.map((m) => (
              <span key={m.uid} class="mark-chip">
                <span>{m.target}</span>
                <Dots value={m.marks} max={MARK_MAX} onChange={(v) => update((x) => setMarks(x, m.uid, v), { record: false })} />
                <button type="button" class="ghost sm" aria-label={`Remove marks on ${m.target}`} onClick={() => update((x) => removeMarkTarget(x, m.uid), { record: false })}>✕</button>
              </span>
            ))}
            <form class="row gap mark-add" onSubmit={submit}>
              <input placeholder="Mark a target…" value={name} onInput={(e) => setName(e.currentTarget.value)} aria-label="New mark target" />
              <button type="submit" class="sm">+ Mark</button>
            </form>
          </div>
          <div class="ow-clock">
            <span class="os-readout"><small>OS </small><b class={cx(over && 'bad', near && 'warn')}>{os}</b><small> / {OS_CONVERGENCE}</small></span>
            {[1, 2, 3, 5].map((n) => <button key={n} type="button" class="sm" onClick={() => update((x) => addOverwatch(x, n), { record: false })}>+{n}</button>)}
            <input type="number" min="0" class="var" value={os} aria-label="Set Overwatch Score exactly"
              onChange={(e) => update((x) => setOverwatch(x, e.currentTarget.value), { record: false })} />
            <button type="button" class="ghost sm" onClick={() => update((x) => resetOverwatch(x), { record: false })}>Reset</button>
          </div>
        </div>
        {over && <p class="hint bad">Convergence: the target has found you (SR5 core p.232).</p>}
      </Panel>
    );
  }

  return (
    <Panel title="Matrix Marks & Overwatch Score" sub="marks: SR5 core p.231 · Overwatch Score: p.232 (normally tracked secretly by the GM)">
      <div class="cols-2 overwatch-grid">
        <div>
          <h4 class="sub">Marks you've placed</h4>
          {play.marks.length === 0 ? <Empty>No marks placed yet.</Empty> : (
            <ul class="plain marks-list">
              {play.marks.map((m) => (
                <li key={m.uid}>
                  <span class="grow">{m.target}</span>
                  <Dots value={m.marks} max={MARK_MAX} onChange={(v) => update((x) => setMarks(x, m.uid, v), { record: false })} />
                  <button type="button" class="ghost sm" aria-label={`Remove marks on ${m.target}`} onClick={() => update((x) => removeMarkTarget(x, m.uid), { record: false })}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <form class="row gap" onSubmit={submit}>
            <input class="grow" placeholder="Target (device, host, persona…)" value={name} onInput={(e) => setName(e.currentTarget.value)} aria-label="New mark target" />
            <button type="submit" class="primary sm">+ Mark</button>
          </form>
          {marksUrl && <p class="hint"><a class="src" href={marksUrl} target="_blank" rel="noopener">SR5 core p.{MARKS_PAGE} ↗</a></p>}
        </div>
        <div>
          <h4 class="sub">Overwatch Score</h4>
          <div class="os-readout">
            <b class={cx(over && 'bad', near && 'warn')}>{os}</b><small> / {OS_CONVERGENCE}</small>
          </div>
          {over && <p class="hint bad">Convergence: the target has found you (SR5 core p.232).</p>}
          <div class="roll-actions">
            {[1, 2, 3, 5].map((n) => <button key={n} type="button" onClick={() => update((x) => addOverwatch(x, n), { record: false })}>+{n}</button>)}
            <input type="number" min="0" class="var" value={os} aria-label="Set Overwatch Score exactly"
              onChange={(e) => update((x) => setOverwatch(x, e.currentTarget.value), { record: false })} />
            <button type="button" class="ghost" onClick={() => update((x) => resetOverwatch(x), { record: false })}>Reset</button>
          </div>
          <p class="hint">A clock you (or your GM) advance by hand: the exact test used to add hits is a GM call, and Overwatch Score is normally kept secret from the player.</p>
          {osUrl && <p class="hint"><a class="src" href={osUrl} target="_blank" rel="noopener">SR5 core p.{OS_PAGE} ↗</a></p>}
        </div>
      </div>
    </Panel>
  );
}
