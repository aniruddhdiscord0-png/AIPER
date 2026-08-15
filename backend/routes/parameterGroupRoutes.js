const express = require('express');
const router = express.Router();
const ParameterGroup = require('../models/ParameterGroup');
const { protect } = require('../middlewares/authMiddleware');
const { cacheMiddleware } = require('../utils/serverCache');

// GET /api/parameter-groups/all — fetch everything in one shot for local filtering
router.get('/all', protect, cacheMiddleware('groups'), async (req, res) => {
  try {
    const docs = await ParameterGroup.find()
      .populate('parameters.parameterId', 'name type unit')
      .populate('pesticideSubPanels.parameters.parameterId', 'name type unit')
      .sort({ group: 1, subGroup: 1 });

    const results = docs.map(d => {
      if (d.isPesticidePanel) {
        return {
          _id: d._id,
          group: d.group,
          subGroup: d.subGroup,
          productCategories: d.productCategories || [],
          isPesticidePanel: true,
          pesticidePanelType: d.pesticidePanelType,
          pesticideSubPanels: (d.pesticideSubPanels || []).map(sp => ({
            panelName: sp.panelName,
            parameterCount: sp.parameters.length
          })),
          parameters: []
        };
      }
      return {
        _id: d._id,
        group: d.group,
        subGroup: d.subGroup,
        productCategories: d.productCategories || [],
        isPesticidePanel: false,
        pesticidePanelType: null,
        pesticideSubPanels: [],
        parameters: (d.parameters || []).map(p => {
          const param = p.parameterId;
          return param ? { _id: param._id, name: param.name, type: param.type, unit: param.unit } : null;
        }).filter(Boolean)
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching all parameter groups', error: err.message });
  }
});

// GET /api/parameter-groups/groups — distinct group names
router.get('/groups', protect, cacheMiddleware('groups'), async (req, res) => {
  try {
    const groups = await ParameterGroup.distinct('group');
    res.json(groups.sort());
  } catch (err) {
    res.status(500).json({ message: 'Error fetching groups', error: err.message });
  }
});

// GET /api/parameter-groups/subgroups?groups=GroupA,GroupB
router.get('/subgroups', protect, cacheMiddleware('groups'), async (req, res) => {
  try {
    const groupNames = req.query.groups ? req.query.groups.split(',').map(g => g.trim()) : [];
    if (groupNames.length === 0) return res.json([]);

    const docs = await ParameterGroup.find(
      { group: { $in: groupNames } },
      { group: 1, subGroup: 1, isPesticidePanel: 1, pesticidePanelType: 1 }
    ).sort({ group: 1, subGroup: 1 });

    res.json(docs.map(d => ({
      group: d.group,
      subGroup: d.subGroup,
      isPesticidePanel: d.isPesticidePanel,
      pesticidePanelType: d.pesticidePanelType || null
    })));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subgroups', error: err.message });
  }
});

// GET /api/parameter-groups/details?groups=...&subGroups=...
router.get('/details', protect, cacheMiddleware('groups'), async (req, res) => {
  try {
    const groupNames = req.query.groups ? req.query.groups.split(',').map(g => g.trim()) : [];
    const subGroupNames = req.query.subGroups ? req.query.subGroups.split(',').map(s => s.trim()) : [];
    if (groupNames.length === 0 || subGroupNames.length === 0) return res.json([]);

    const docs = await ParameterGroup.find({
      group: { $in: groupNames },
      subGroup: { $in: subGroupNames }
    }).populate('parameters.parameterId', 'name type unit')
      .populate('pesticideSubPanels.parameters.parameterId', 'name type unit');

    const results = docs.map(d => {
      if (d.isPesticidePanel) {
        return {
          group: d.group,
          subGroup: d.subGroup,
          productCategories: d.productCategories || [],
          isPesticidePanel: true,
          pesticidePanelType: d.pesticidePanelType,
          pesticideSubPanels: (d.pesticideSubPanels || []).map(sp => ({
            panelName: sp.panelName,
            parameterCount: sp.parameters.length
          })),
          totalPesticideParams: (d.pesticideSubPanels || []).reduce((sum, sp) => sum + sp.parameters.length, 0)
        };
      }
      return {
        group: d.group,
        subGroup: d.subGroup,
        productCategories: d.productCategories || [],
        parameters: (d.parameters || []).map(p => {
          const param = p.parameterId;
          return param ? { _id: param._id, name: param.name, type: param.type, unit: param.unit } : null;
        }).filter(Boolean),
        isPesticidePanel: false
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching group details', error: err.message });
  }
});

module.exports = router;
