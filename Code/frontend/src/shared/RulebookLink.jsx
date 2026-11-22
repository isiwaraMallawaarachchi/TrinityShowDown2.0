import { useId, useRef } from 'react';
import { rulebookUpdateNotice } from '../../../shared/rulebook-status.mjs';
import './rulebook-notice.css';

export default function RulebookLink({ gameId, href, className, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  const messageId = useId();
  const notice = rulebookUpdateNotice('trinity-showdown', gameId);
  if (!notice) {
    return href ? <a className={className} href={href} download>{children}</a> : <div className={className}>{children}</div>;
  }
  return <>
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current.showModal()}>
      {children}
    </button>
    <dialog ref={dialog} className="rulebook-notice" aria-labelledby={titleId} aria-describedby={messageId}
      onClose={(event) => event.stopPropagation()}>
      <span className="rulebook-notice-symbol" aria-hidden="true">!</span>
      <p className="eyebrow">COD Mobile</p>
      <h2 id={titleId}>Rulebook update</h2>
      <p id={messageId}>{notice}</p>
      <button type="button" className="rulebook-notice-dismiss" autoFocus onClick={() => dialog.current.close()}>Got it</button>
    </dialog>
  </>;
}
