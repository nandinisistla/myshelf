// Little notes on the back of each bottle: short, warm, a bit cheeky.
export const QUOTES = [
  'You look amazing today.',
  'That glow? All you.',
  'Confidence looks good on you.',
  'Hydrated. Moisturized. Unbothered.',
  'You’re glowing. Just saying.',
  'Main character energy, as usual.',
  'Look in the mirror. Yep, still gorgeous.',
  'SPF on? Then you’re unstoppable.',
  'Radiant is your default setting.',
  'Bad skin day? Still a great face.',
  'Your skin is doing its best. So are you.',
  'Good skin day loading…',
  'No filter needed.',
  'Self-care looks good on you.',
  'Today’s look: effortlessly you.',
  'Be gentle with your skin, and with yourself.',
];

export function quoteFor(id) {
  const n = Math.abs(Number(id) || 0);
  return QUOTES[n % QUOTES.length];
}
