import { fileURLToPath } from 'node:url';
import { rulebookUpdateNotice } from '../../shared/rulebook-status.mjs';

const catalogue = new Map([
  ['trinity-showdown', new Map([
    ['cod-mobile', ['1']],
    ['pubg-mobile', ['1']],
    ['mlbb', ['1', '2']],
    ['clash-of-clans', ['1']],
  ])],
]);

export function bundledRulebook(edition, game, version) {
  if (!catalogue.get(edition)?.get(game)?.includes(version)) return null;
  const name = `${game}-v${version}.pdf`;
  return {
    key: `bundled-rulebooks/${edition}/${game}/${version}`,
    name,
    path: fileURLToPath(new URL(`../rulebooks/${edition}/${name}`, import.meta.url)),
  };
}

export function bundledRulebookSettings(edition) {
  const games = catalogue.get(edition) ?? [];
  return new Map(Array.from(games, ([game, versions]) => {
    const version = versions.at(-1);
    const notice = rulebookUpdateNotice(edition, game);
    return [game, { open: false, rulebookVersion: version, rulebookNotice: notice,
      rulebookUrl: notice ? null : `/api/public/rulebooks/files/${game}/${version}` }];
  }));
}
