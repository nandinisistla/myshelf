// Example history for demos: five months of real products (looked up live, like any
// product you add), a few bad days, and the patterns that come out of them.
// Everything added here is marked demo = true so it can be removed in one go.

export const DEMO_PRODUCTS = [
  // still on the shelf
  { name: 'Niacinamide 10% + TXA 4% Serum', brand: 'Anua', routine: 'Night', area: 'face', started: '2026-10-16', match: 'niacinamide' },
  { name: 'Heartleaf Pore Control Cleansing Oil', brand: 'Anua', routine: 'Night', area: 'face', started: '2026-10-14', match: 'cleansing oil' },
  { name: 'Multi-Peptide Serum for Hair Density', brand: 'The Ordinary', routine: 'Hair', area: 'scalp', started: '2026-07-08', match: 'peptide' },
  { name: '100% Plant-Derived Squalane', brand: 'The Ordinary', routine: 'Hair', area: 'scalp', started: '2026-08-12', match: 'squalane' },
  { name: 'Deodorant Coconut & Vanilla', brand: 'Native', routine: 'Body', area: 'body', started: '2026-08-01', match: 'deodorant' },
  { name: 'Pure Peace Body Wash', brand: 'Method', routine: 'Body', area: 'body', started: '2026-09-03', match: 'body wash' },
  // used in the past, then stopped
  { name: 'Rose Deep Hydration Face Cream', brand: 'Fresh', routine: 'Night', area: 'face', started: '2026-06-25', stopped: '2026-10-10', match: 'rose deep' },
  { name: 'Glow Tonic', brand: 'Pixi', routine: 'Morning', area: 'face', started: '2026-07-12', stopped: '2026-09-22', match: 'glow tonic' },
  { name: 'Japanese Cherry Blossom Body Lotion', brand: 'Bath & Body Works', routine: 'Body', area: 'body', started: '2026-06-10', stopped: '2026-09-01', match: 'cherry blossom' },
];

export const DEMO_REACTIONS = [
  { date: '2026-07-03', area: 'face', severity: 1, note: 'A few small bumps on my cheeks' },
  { date: '2026-07-19', area: 'body', severity: 2, note: 'Itchy arms after putting on lotion' },
  { date: '2026-07-24', area: 'face', severity: 2, note: 'Red, itchy patches next to my nose' },
  { date: '2026-08-11', area: 'face', severity: 3, note: 'Breakout along my jaw, stinging at night' },
  { date: '2026-08-20', area: 'body', severity: 1, note: 'Dry, itchy patch on my legs' },
  { date: '2026-09-02', area: 'face', severity: 2, note: 'Redness after my night routine' },
  { date: '2026-10-01', area: 'face', severity: 2, note: 'Itchy cheeks again' },
  { date: '2026-10-08', area: 'face', severity: 1, note: 'Slight redness, calmer than before' },
];
