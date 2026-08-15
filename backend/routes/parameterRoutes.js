const express = require('express');
const router = express.Router();
const Parameter = require('../models/Parameter');
const Job = require('../models/Job');
const { protect } = require('../middlewares/authMiddleware');
const { cacheMiddleware, invalidateByPrefix } = require('../utils/serverCache');

// Get all parameters, optionally search by name (ranked by relevance)
router.get('/', protect, cacheMiddleware('parameters'), async (req, res) => {
  try {
    const query = {};
    const searchTerm = req.query.search;
    if (searchTerm) {
      query.name = { $regex: searchTerm, $options: 'i' };
    }
    const parameters = await Parameter.find(query)
      .collation({ locale: 'en', strength: 2 })
      .sort({ name: 1 });

    // Rank results by relevance if a search term was provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      parameters.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Tier 1: Exact match
        const aExact = aName === term;
        const bExact = bName === term;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        // Tier 2: Starts with search term
        const aPrefix = aName.startsWith(term);
        const bPrefix = bName.startsWith(term);
        if (aPrefix && !bPrefix) return -1;
        if (bPrefix && !aPrefix) return 1;

        // Tier 3: Word boundary match (e.g. "Total Coliform" matches "col")
        const aWord = aName.split(/\s+/).some(w => w.startsWith(term));
        const bWord = bName.split(/\s+/).some(w => w.startsWith(term));
        if (aWord && !bWord) return -1;
        if (bWord && !aWord) return 1;

        // Tier 4: Alphabetical
        return aName.localeCompare(bName);
      });
    }

    res.json(parameters);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching parameters', error: err.message });
  }
});

// Add a new parameter
router.post('/', protect, async (req, res) => {
  try {
    const { name, type, unit, specification } = req.body;
    if (!name || !type || !unit) {
      return res.status(400).json({ message: 'name, type, and unit are all required' });
    }

    // Check if exists
    const existing = await Parameter.findOne({ name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: `Parameter "${name}" already exists in the library` });
    }

    // Assign s_no manually to avoid pre-save race conditions
    const last = await Parameter.findOne({}, {}, { sort: { s_no: -1 } });
    const s_no = (last && last.s_no) ? last.s_no + 1 : 1;

    const parameter = await Parameter.create({ name: name.trim(), type, unit: unit.trim(), s_no, specification: specification || '' });
    invalidateByPrefix('parameters');
    res.status(201).json(parameter);
  } catch (err) {
    res.status(500).json({ message: 'Error creating parameter', error: err.message });
  }
});

// Update a parameter
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, type, unit, specification } = req.body;
    const parameterId = req.params.id;

    // Build update object
    const updateData = {};
    if (unit !== undefined) updateData.unit = unit.trim();
    if (type !== undefined) updateData.type = type;
    if (specification !== undefined) updateData.specification = specification;
    if (name !== undefined) {
      updateData.name = name.trim();
      
      // Check for name collision if name is being changed
      const existing = await Parameter.findOne({ 
        name: { $regex: new RegExp(`^${updateData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        _id: { $ne: parameterId }
      });
      if (existing) {
        return res.status(400).json({ message: `Parameter "${updateData.name}" already exists in the library` });
      }
    }

    const updated = await Parameter.findByIdAndUpdate(
      parameterId,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Parameter not found' });
    }

    invalidateByPrefix('parameters');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating parameter', error: err.message });
  }
});

// Delete a parameter from the library
router.delete('/:id', protect, async (req, res) => {
  try {
    const paramId = req.params.id;

    // Check if any job references this parameter
    const usageCount = await Job.countDocuments({ 'parameters.parameterId': paramId });
    if (usageCount > 0) {
      return res.status(400).json({
        message: `Cannot delete: this parameter is used in ${usageCount} job(s). Remove it from those jobs first.`
      });
    }

    const deleted = await Parameter.findByIdAndDelete(paramId);
    if (!deleted) {
      return res.status(404).json({ message: 'Parameter not found' });
    }

    invalidateByPrefix('parameters');
    res.json({ message: `Parameter "${deleted.name}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting parameter', error: err.message });
  }
});



module.exports = router;
