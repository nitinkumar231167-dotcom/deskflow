const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

const SLA_TARGETS = { urgent: 60, high: 240, medium: 1440, low: 4320 };
const FORWARD = { open: 'in_progress', in_progress: 'resolved', resolved: 'closed' };
const BACK = { in_progress: 'open', resolved: 'in_progress', closed: 'resolved' };

function computeDerived(ticket) {
  const now = new Date();
  const end = (ticket.status === 'resolved' || ticket.status === 'closed') ? (ticket.resolvedAt || now) : now;
  const ageMinutes = Math.floor((end - ticket.createdAt) / 60000);
  const slaBreached = ageMinutes > SLA_TARGETS[ticket.priority];
  return { ...ticket.toObject(), ageMinutes, slaBreached };
}

router.post('/', async (req, res) => {
  try {
    const { subject, description, customerEmail, priority } = req.body;
    if (!subject || !description || !customerEmail || !priority)
      return res.status(400).json({ error: 'All fields are required.' });
    const ticket = await Ticket.create({ subject, description, customerEmail, priority });
    res.status(201).json(computeDerived(ticket));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const tickets = await Ticket.find();
    const derived = tickets.map(computeDerived);
    const stats = { byStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0 }, byPriority: { low: 0, medium: 0, high: 0, urgent: 0 }, slaBreached: 0 };
    derived.forEach(t => { stats.byStatus[t.status]++; stats.byPriority[t.priority]++; if (t.slaBreached && t.status !== 'closed') stats.slaBreached++; });
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, priority, breached } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    let tickets = await Ticket.find(query);
    let result = tickets.map(computeDerived);
    if (breached === 'true') result = result.filter(t => t.slaBreached);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });
    const isForward = FORWARD[ticket.status] === status;
    const isBack = BACK[ticket.status] === status;
    if (!isForward && !isBack) return res.status(400).json({ error: `Transition from '${ticket.status}' to '${status}' is not allowed.` });
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = new Date();
    else if (status === 'in_progress' && ticket.resolvedAt) ticket.resolvedAt = null;
    await ticket.save();
    res.json(computeDerived(ticket));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
