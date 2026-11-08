import { send } from '../lib/chain.js';
import { coachGoal } from '../lib/gemini.js';

// POST { goal }: Gemini sharpens a vague goal into one a photo can prove, plus the proof it needs.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const goal = req.body?.goal;
  if (typeof goal !== 'string' || !goal.trim() || goal.length > 200) return send(res, 400, { error: 'Goal required (max 200 characters)' });
  try {
    const out = await coachGoal(goal.trim());
    if (!out.goal) return send(res, 400, { error: 'The coach would not take that goal. Try another.' });
    send(res, 200, out);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
