import { useEffect, useRef } from 'react';
import { AmbientField } from '../shared/motion.jsx';

function Ornament() {
  return <span className="ornament" aria-hidden="true"><i /><i /><i /></span>;
}

export function ThemeToggle({ dark, onToggle }) {
  return <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Dark mode"
    aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>
        : <path d="M20.8 14.4A9 9 0 0 1 9.6 3.2a9 9 0 1 0 11.2 11.2Z" />}
    </svg>
  </button>;
}

export function NavigationMenu({ open, onClose, navigate, themeControl, links, logo }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="world-menu" aria-labelledby="menu-title" onClose={onClose}>
    <div className="menu-frame">
      {open && <AmbientField scene="dialog" active />}
      <div className="menu-top"><span className="eyebrow" id="menu-title">Trinity Showdown</span>
        <div className="toolbar-actions">{themeControl}
          <form method="dialog"><button className="close-menu" autoFocus>Close <span aria-hidden="true">×</span></button></form>
        </div>
      </div>
      <div className="menu-layout">
        <div className="menu-art" aria-hidden="true"><Ornament /><img src={logo} alt="" /></div>
        <nav aria-label="Main navigation" className="menu-chapters">
          {links.map(([id, label]) => <a href={'#' + id} key={id} onClick={(e) => {
            e.preventDefault();
            dialog.current.close();
            onClose();
            navigate(id);
          }}><span>{label}</span><i aria-hidden="true" /></a>)}
        </nav>
      </div>
    </div>
  </dialog>;
}
