const express = require('express');
const router = express.Router();
const ParameterGroup = require('../models/ParameterGroup');
const Parameter = require('../models/Parameter');
const Job = require('../models/Job');
const { protect } = require('../middlewares/authMiddleware');
const { invalidateByPrefix } = require('../utils/serverCache');

// ═══════════════════════════════════
//  GROUPS
// ═══════════════════════════════════

// POST /api/data-settings/groups — Create a new group (with a placeholder subgroup)
router.post('/groups', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Group name is required' });

    const trimmed = name.trim();
    const exists = await ParameterGroup.findOne({ group: trimmed });
    if (exists) return res.status(400).json({ message: `Group "${trimmed}" already exists` });

    // Create a placeholder doc so the group appears in distinct queries
    // The officer will add real subgroups afterward
    await ParameterGroup.create({
      group: trimmed,
      subGroup: '__placeholder__',
      productCategories: [],
      parameters: [],
      isPesticidePanel: false
    });

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.status(201).json({ message: `Group "${trimmed}" created`, group: trimmed });
  } catch (err) {
    res.status(500).json({ message: 'Error creating group', error: err.message });
  }
});

// PUT /api/data-settings/groups/:oldName — Rename a group (cascading)
router.put('/groups/:oldName', protect, async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.oldName);
    const { newName } = req.body;
    if (!newName?.trim()) return res.status(400).json({ message: 'New name is required' });

    const trimmed = newName.trim();
    if (trimmed === oldName) return res.json({ message: 'No change' });

    // Check if new name already exists
    const conflict = await ParameterGroup.findOne({ group: trimmed });
    if (conflict) return res.status(400).json({ message: `Group "${trimmed}" already exists` });

    // Cascade rename to all ParameterGroup docs
    const pgResult = await ParameterGroup.updateMany({ group: oldName }, { $set: { group: trimmed } });
    // Cascade rename to Parameter model
    await Parameter.updateMany({ group: oldName }, { $set: { group: trimmed } });

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json({ message: `Renamed "${oldName}" to "${trimmed}"`, updated: pgResult.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Error renaming group', error: err.message });
  }
});

// DELETE /api/data-settings/groups/:name — Delete entire group
router.delete('/groups/:name', protect, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);

    // Check if any incomplete jobs reference parameters from this group
    const groupDocs = await ParameterGroup.find({ group: name });
    const allParamIds = [];
    groupDocs.forEach(d => {
      d.parameters.forEach(p => allParamIds.push(p.parameterId));
      (d.pesticideSubPanels || []).forEach(sp => sp.parameters.forEach(p => allParamIds.push(p.parameterId)));
    });

    if (allParamIds.length > 0) {
      const incompleteJobs = await Job.countDocuments({
        'parameters.parameterId': { $in: allParamIds },
        $or: [
          { 'distribution.micro.status': { $nin: ['COMPLETED', undefined] } },
          { 'distribution.chemical.status': { $nin: ['COMPLETED', undefined] } }
        ]
      });
      if (incompleteJobs > 0) {
        return res.status(400).json({
          message: `Cannot delete: "${name}" has parameters used in ${incompleteJobs} incomplete job(s). Complete those jobs first.`
        });
      }
    }

    await ParameterGroup.deleteMany({ group: name });
    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json({ message: `Group "${name}" and all its subgroups deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting group', error: err.message });
  }
});

// ═══════════════════════════════════
//  SUBGROUPS
// ═══════════════════════════════════

// POST /api/data-settings/subgroups — Create a new subgroup under a group
router.post('/subgroups', protect, async (req, res) => {
  try {
    const { group, subGroup } = req.body;
    if (!group?.trim() || !subGroup?.trim()) {
      return res.status(400).json({ message: 'Both group and subGroup are required' });
    }

    const exists = await ParameterGroup.findOne({ group: group.trim(), subGroup: subGroup.trim() });
    if (exists) return res.status(400).json({ message: `Subgroup "${subGroup.trim()}" already exists under "${group.trim()}"` });

    // Remove placeholder if it exists
    await ParameterGroup.deleteOne({ group: group.trim(), subGroup: '__placeholder__' });

    const doc = await ParameterGroup.create({
      group: group.trim(),
      subGroup: subGroup.trim(),
      productCategories: [],
      parameters: [],
      isPesticidePanel: false
    });

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error creating subgroup', error: err.message });
  }
});

// PUT /api/data-settings/subgroups/:id — Rename a subgroup
router.put('/subgroups/:id', protect, async (req, res) => {
  try {
    const { newName } = req.body;
    if (!newName?.trim()) return res.status(400).json({ message: 'New name is required' });

    const doc = await ParameterGroup.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Subgroup not found' });

    // Check for conflict within the same group
    const conflict = await ParameterGroup.findOne({ group: doc.group, subGroup: newName.trim(), _id: { $ne: doc._id } });
    if (conflict) return res.status(400).json({ message: `Subgroup "${newName.trim()}" already exists under "${doc.group}"` });

    // Cascade to Parameter model
    await Parameter.updateMany({ group: doc.group, subGroup: doc.subGroup }, { $set: { subGroup: newName.trim() } });

    doc.subGroup = newName.trim();
    await doc.save();

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error renaming subgroup', error: err.message });
  }
});

// DELETE /api/data-settings/subgroups/:id — Delete a subgroup
router.delete('/subgroups/:id', protect, async (req, res) => {
  try {
    const doc = await ParameterGroup.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Subgroup not found' });

    // Check for incomplete jobs
    const paramIds = doc.parameters.map(p => p.parameterId);
    if (paramIds.length > 0) {
      const incompleteJobs = await Job.countDocuments({
        'parameters.parameterId': { $in: paramIds },
        $or: [
          { 'distribution.micro.status': { $nin: ['COMPLETED', undefined] } },
          { 'distribution.chemical.status': { $nin: ['COMPLETED', undefined] } }
        ]
      });
      if (incompleteJobs > 0) {
        return res.status(400).json({
          message: `Cannot delete: "${doc.subGroup}" has parameters used in ${incompleteJobs} incomplete job(s).`
        });
      }
    }

    await ParameterGroup.findByIdAndDelete(req.params.id);

    // If this was the last subgroup in the group, add placeholder back
    const remaining = await ParameterGroup.countDocuments({ group: doc.group });
    if (remaining === 0) {
      await ParameterGroup.create({
        group: doc.group,
        subGroup: '__placeholder__',
        productCategories: [],
        parameters: [],
        isPesticidePanel: false
      });
    }

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json({ message: `Subgroup "${doc.subGroup}" deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting subgroup', error: err.message });
  }
});

// ═══════════════════════════════════
//  PRODUCT CATEGORIES
// ═══════════════════════════════════

// PUT /api/data-settings/subgroups/:id/categories — Update product categories
router.put('/subgroups/:id/categories', protect, async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ message: 'categories must be an array' });

    const doc = await ParameterGroup.findByIdAndUpdate(
      req.params.id,
      { productCategories: categories.map(c => c.trim()).filter(Boolean) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Subgroup not found' });

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error updating categories', error: err.message });
  }
});

// ═══════════════════════════════════
//  PARAMETERS (within a subgroup)
// ═══════════════════════════════════

// POST /api/data-settings/subgroups/:id/parameters — Add a parameter to a subgroup
router.post('/subgroups/:id/parameters', protect, async (req, res) => {
  try {
    const { name, type, unit } = req.body;
    if (!name?.trim() || !type || !unit?.trim()) {
      return res.status(400).json({ message: 'name, type, and unit are required' });
    }

    const subGroupDoc = await ParameterGroup.findById(req.params.id);
    if (!subGroupDoc) return res.status(404).json({ message: 'Subgroup not found' });

    // Upsert the Parameter in the global parameters collection
    let param = await Parameter.findOne({ name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (!param) {
      const last = await Parameter.findOne({}, {}, { sort: { s_no: -1 } });
      const s_no = (last?.s_no || 0) + 1;
      param = await Parameter.create({
        name: name.trim(),
        type,
        unit: unit.trim(),
        s_no,
        group: subGroupDoc.group,
        subGroup: subGroupDoc.subGroup
      });
    }

    // Check if already in this subgroup
    if (subGroupDoc.parameters.some(p => p.parameterId.toString() === param._id.toString())) {
      return res.status(400).json({ message: `Parameter "${param.name}" is already in this subgroup` });
    }

    subGroupDoc.parameters.push({ parameterId: param._id, name: param.name });
    await subGroupDoc.save();

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.status(201).json({ parameter: param, subGroup: subGroupDoc });
  } catch (err) {
    res.status(500).json({ message: 'Error adding parameter', error: err.message });
  }
});

// DELETE /api/data-settings/subgroups/:id/parameters/:paramId — Remove a parameter from a subgroup
router.delete('/subgroups/:id/parameters/:paramId', protect, async (req, res) => {
  try {
    const subGroupDoc = await ParameterGroup.findById(req.params.id);
    if (!subGroupDoc) return res.status(404).json({ message: 'Subgroup not found' });

    // Check for incomplete jobs using this parameter
    const incompleteJobs = await Job.countDocuments({
      'parameters.parameterId': req.params.paramId,
      $or: [
        { 'distribution.micro.status': { $nin: ['COMPLETED', undefined] } },
        { 'distribution.chemical.status': { $nin: ['COMPLETED', undefined] } }
      ]
    });
    if (incompleteJobs > 0) {
      return res.status(400).json({
        message: `Cannot remove: this parameter is used in ${incompleteJobs} incomplete job(s).`
      });
    }

    subGroupDoc.parameters = subGroupDoc.parameters.filter(
      p => p.parameterId.toString() !== req.params.paramId
    );
    await subGroupDoc.save();

    invalidateByPrefix('groups'); invalidateByPrefix('parameters'); res.json({ message: 'Parameter removed from subgroup' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing parameter', error: err.message });
  }
});

module.exports = router;
