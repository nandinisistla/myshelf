// Short quotes on beauty and confidence for the back of each bottle.
// Only quotes with a verified original source (all from public-domain works).
export const QUOTES = [
  { q: 'To love oneself is the beginning of a lifelong romance.', by: 'Oscar Wilde', src: 'An Ideal Husband, 1895' },
  { q: 'Self-trust is the first secret of success.', by: 'Ralph Waldo Emerson', src: 'Society and Solitude, 1870' },
  { q: 'Beauty is eternity gazing at itself in a mirror. But you are eternity and you are the mirror.', by: 'Kahlil Gibran', src: 'The Prophet, 1923' },
  { q: 'Trust thyself: every heart vibrates to that iron string.', by: 'Ralph Waldo Emerson', src: 'Self-Reliance, 1841' },
  { q: 'The best and most beautiful things in the world cannot be seen nor even touched, but just felt in the heart.', by: 'Helen Keller', src: 'Letter, 1891' },
  { q: 'A thing of beauty is a joy for ever.', by: 'John Keats', src: 'Endymion, 1818' },
  { q: 'I am not afraid of storms, for I am learning how to sail my ship.', by: 'Louisa May Alcott', src: 'Little Women, 1868' },
  { q: 'This above all: to thine own self be true.', by: 'William Shakespeare', src: 'Hamlet' },
  { q: 'I celebrate myself, and sing myself.', by: 'Walt Whitman', src: 'Song of Myself, 1855' },
  { q: 'Beauty is in the eye of the beholder.', by: 'Margaret Wolfe Hungerford', src: 'Molly Bawn, 1878' },
  { q: 'Self-trust is the essence of heroism.', by: 'Ralph Waldo Emerson', src: 'Heroism, 1841' },
];

export function quoteFor(id) {
  const n = Math.abs(Number(id) || 0);
  return QUOTES[n % QUOTES.length];
}
