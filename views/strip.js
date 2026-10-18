// views/strip.js
// The week strip: seven large tappable days with today highlighted. Used on Today (in the dark header),
// on the Habits page (phone week grid) and on the Training page. Swipe left/right or use the arrows.
import { tr, LOC } from '../i18n.js';
import { addDays, parse, today, ymd } from '../core.js';

// mon: Date (Monday) · selected: 'YYYY-MM-DD' · pick/week: action names · marks: { 'YYYY-MM-DD': 'done' | 'part' }
export function weekStrip(mon, selected, { pick, week, marks = {}, cls = '', arrows = true } = {}) {
  const t = today();
  const days = [...Array(7)].map((_, i) => ymd(addDays(mon, i)));
  return `<div class="strip ${cls}" data-swipe="${week}">
    ${arrows ? `<button class="strip-arrow" data-action="${week}" data-dir="-1" aria-label="${tr('Previous week')}">‹</button>` : ''}
    <div class="strip-days" role="group" aria-label="${tr('Week')}">${days.map(d => {
      const dt = parse(d);
      return `<button class="strip-day ${d === t ? 'is-today' : ''} ${marks[d] ? 'mark-' + marks[d] : ''}" data-action="${pick}" data-d="${d}" aria-pressed="${d === selected}" aria-label="${dt.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' })}">
        <span class="sd-wd">${dt.toLocaleDateString(LOC(), { weekday: 'short' }).replace('.', '')}</span><span class="sd-n">${String(dt.getDate()).padStart(2, '0')}</span><i aria-hidden="true"></i></button>`;
    }).join('')}</div>
    ${arrows ? `<button class="strip-arrow" data-action="${week}" data-dir="1" aria-label="${tr('Next week')}">›</button>` : ''}
  </div>`;
}
