const updates = {};

export function rulebookUpdateNotice(edition, game) {
  return updates[edition]?.[game] ?? null;
}
