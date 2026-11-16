import { useEffect, useRef } from 'react';
import { AmbientField } from '../shared/motion.jsx';

function Ornament() {
  return <span className="ornament" aria-hidden="true"><i /><i /><i /></span>;
}

export function NavigationMenu({ open, onClose, navigate, links, logo }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="world-menu" aria-labelledby="menu-title" onClose={onClose}>
    <div className="menu-frame">
      {open && <AmbientField scene="dialog" active />}
      <div className="menu-top"><span className="eyebrow" id="menu-title">Trinity Showdown</span>
        <form method="dialog"><button className="close-menu" autoFocus>Close <span aria-hidden="true">×</span></button></form>
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
