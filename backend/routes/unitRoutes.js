const express = require('express');
const router = express.Router();
const Unit = require('../models/Unit');
const { protect } = require('../middlewares/authMiddleware');
const { cacheMiddleware, invalidateByPrefix } = require('../utils/serverCache');

router.get('/', protect, cacheMiddleware('units'), async (req, res) => {
  try {
    const units = await Unit.find().sort({ text: 1 });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching units', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Unit text is required' });

    const existing = await Unit.findOne({ text: { $regex: new RegExp(`^${text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Unit already exists' });

    const unit = await Unit.create({ text: text.trim(), createdBy: req.user._id });
    invalidateByPrefix('units');
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ message: 'Error creating unit', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Unit.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    invalidateByPrefix('units');
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting unit', error: err.message });
  }
});

module.exports = router;
