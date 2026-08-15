const express = require('express');
const router = express.Router();
const TestMethod = require('../models/TestMethod');
const { protect } = require('../middlewares/authMiddleware');
const { cacheMiddleware, invalidateByPrefix } = require('../utils/serverCache');

router.get('/', protect, cacheMiddleware('methods'), async (req, res) => {
  try {
    const methods = await TestMethod.find().sort({ text: 1 });
    res.json(methods);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching test methods', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Text is required' });
    
    const existing = await TestMethod.findOne({ text: { $regex: new RegExp(`^${text.trim().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Test method already exists' });

    const method = await TestMethod.create({ text: text.trim(), createdBy: req.user._id });
    invalidateByPrefix('methods');
    res.status(201).json(method);
  } catch (err) {
    res.status(500).json({ message: 'Error creating test method', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Text is required' });

    const existing = await TestMethod.findOne({ 
      text: { $regex: new RegExp(`^${text.trim().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') },
      _id: { $ne: req.params.id }
    });
    if (existing) return res.status(400).json({ message: 'Test method already exists' });

    const updated = await TestMethod.findByIdAndUpdate(req.params.id, { text: text.trim() }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating test method', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await TestMethod.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    invalidateByPrefix('methods');
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting test method', error: err.message });
  }
});

module.exports = router;
