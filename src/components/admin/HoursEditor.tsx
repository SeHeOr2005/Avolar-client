import { Switch } from '../ui';
import { hhmm, hhmmToMin, WEEKDAYS } from '../../lib/format';
import type { Hours } from '../../lib/types';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function defaultHours(src?: Hours[]): Hours[] {
  return Array.from({ length: 7 }, (_, weekday) => src?.find((h) => h.weekday === weekday) ?? { weekday, isOpen: false, openMinute: 600, closeMinute: 1320 });
}

/** Editor de horario semanal. 24:00 se representa como 1440. */
export function HoursEditor({ value, onChange }: { value: Hours[]; onChange: (v: Hours[]) => void }) {
  const set = (wd: number, patch: Partial<Hours>) => onChange(value.map((h) => (h.weekday === wd ? { ...h, ...patch } : h)));
  return (
    <div className="hours-editor">
      {ORDER.map((wd) => {
        const h = value.find((x) => x.weekday === wd)!;
        const invalid = h.isOpen && h.closeMinute <= h.openMinute;
        return (
          <div key={wd} className="hours-row" style={invalid ? { outline: '2px solid var(--danger)' } : undefined}>
            <strong className="small">{WEEKDAYS[wd]}</strong>
            <Switch checked={h.isOpen} onChange={(v) => set(wd, { isOpen: v })} label={h.isOpen ? 'Abierto' : 'Cerrado'} />
            <input
              type="time"
              className="input"
              aria-label={`Apertura ${WEEKDAYS[wd]}`}
              value={hhmm(h.openMinute)}
              disabled={!h.isOpen}
              step={900}
              onChange={(e) => e.target.value && set(wd, { openMinute: hhmmToMin(e.target.value) })}
            />
            <input
              type="time"
              className="input"
              aria-label={`Cierre ${WEEKDAYS[wd]}`}
              value={h.closeMinute >= 1440 ? '23:59' : hhmm(h.closeMinute)}
              disabled={!h.isOpen}
              step={900}
              onChange={(e) => {
                if (!e.target.value) return;
                const m = hhmmToMin(e.target.value);
                set(wd, { closeMinute: m === 1439 ? 1440 : m });
              }}
            />
          </div>
        );
      })}
      <p className="tiny muted">Para cerrar a medianoche usa 23:59. El horario no puede cruzar la medianoche.</p>
    </div>
  );
}

export const hoursValid = (h: Hours[]) => h.every((x) => !x.isOpen || x.closeMinute > x.openMinute);
