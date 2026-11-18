import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ReportMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
}

/** A report-type button that opens a dropdown listing a group of related reports. */
export default function ReportGroupMenu({ label, icon, items, activeId, onSelect }: {
  label: string;
  icon: ReactNode;
  items: ReportMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeItem = items.find(item => item.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative max-w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`flex max-w-full items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all
          ${activeItem
            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700'
          }`}
      >
        <span className={`shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 ${activeItem ? 'text-white' : 'text-slate-400'}`}>{icon}</span>
        <span className="truncate">{activeItem ? `${label}: ${activeItem.label}` : label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" aria-label={label} className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map(item => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { onSelect(item.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold cursor-pointer transition-colors
                  ${selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-700'}`}
              >
                <span className={`shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {selected && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
