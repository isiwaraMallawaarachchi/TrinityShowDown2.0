export function rulebookUpdateNotice(edition, game) {
  if (edition === 'trinity-showdown' && game === 'cod-mobile') {
    return 'The COD Mobile rulebook is getting an update. We’ll publish it as soon as it’s ready.';
  }
  return null;
}
