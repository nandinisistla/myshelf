// Every change from the app comes through here and returns the fresh state.
import { handler, today } from '../lib/http.js';
import * as core from '../lib/core.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { action, ...d } = req.json;
  const t = today(req);
  switch (action) {
    case 'product.add': await core.addProduct({ ...d, today: t }); break;
    case 'product.update': await core.updateProduct(d.id, d.patch || {}); break;
    case 'product.stop': await core.stopProduct(d.id, d.date, t); break;
    case 'product.restart': await core.restartProduct(d.id, d.date, t); break;
    case 'product.delete': await core.deleteProduct(d.id); break;
    case 'product.photo': await core.setPhoto(d.id, d.data || null); break;
    case 'reaction.add': await core.addReaction(d); break;
    case 'reaction.update': await core.updateReaction(d.id, d.patch || {}); break;
    case 'reaction.delete': await core.deleteReaction(d.id); break;
    case 'routine.add': await core.addRoutine(d.name, d.setId); break;
    case 'set.add': await core.addSet(d.name, d.fromId); break;
    case 'set.rename': await core.renameSet(d.id, d.name); break;
    case 'set.delete': await core.deleteSet(d.id); break;
    case 'routine.rename': await core.renameRoutine(d.id, d.name); break;
    case 'routine.delete': await core.deleteRoutine(d.id); break;
    case 'profile.set': await core.setProfile(d); break;
    case 'insight.status': await core.setInsightStatus(d.family, d.status); break;
    default: return res.status(400).json({ error: `Unknown action: ${action}` });
  }
  res.status(200).json(await core.getState(t));
});
