const artwork = {
  cod: { file: 'codm.jpg', ratio: '1920 / 744', sideways: true, x: '43%', y: '23%' },
  pubg: { file: 'pubg.jpg', ratio: '1308 / 736', sideways: true, x: '50%', y: '28%' },
  mlbb: { file: 'mlbb.jpg', ratio: '1097 / 572', sideways: true, x: '54%', y: '35%' },
  coc: { file: 'coc.jpg', ratio: '1200 / 676', x: '42%', y: '67%' },
};

export default function GameArtwork({ game, className = '', loading = 'lazy' }) {
  const { file, ratio, sideways, x, y } = artwork[game.art];
  return <span className={`game-artwork${sideways ? ' is-sideways' : ''} ${className}`}
    style={{ '--art-ratio': ratio, '--art-x': x, '--art-y': y }}>
    <img src={`${import.meta.env.BASE_URL}art/game-art/${file}`} alt="" loading={loading} decoding="async" />
  </span>;
}
