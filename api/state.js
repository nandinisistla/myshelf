import { handler, today } from '../lib/http.js';
import { getState } from '../lib/core.js';

export default handler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await getState(today(req)));
});
