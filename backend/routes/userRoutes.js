const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { audit } = require('../utils/auditLogger');
const { cacheMiddleware, invalidateByPrefix } = require('../utils/serverCache');

// Get all users (Admin sees all, Admin Officer sees all except Admin maybe? Let's just let Admin/Admin Officer see all. Head sees their assistants)
router.get('/', protect, authorize('ADMIN', 'ADMIN_OFFICER', 'HEAD'), cacheMiddleware('users'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'HEAD') {
      // Head can see all assistants in their department
      query = { role: 'ASSISTANT', department: req.user.department };
    }
    const users = await User.find(query).select('-password').populate('createdBy', 'name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new user
router.post('/', protect, authorize('ADMIN', 'ADMIN_OFFICER', 'HEAD'), async (req, res) => {
  try {
    const { name, email, phone, role, department, branch } = req.body;

    // Validation logic for role hierarchy
    if (req.user.role === 'ADMIN' && !['ADMIN_OFFICER', 'ADMIN'].includes(role)) {
      return res.status(403).json({ message: 'Admin can only create ADMIN_OFFICER or ADMIN users' });
    }
    if (req.user.role === 'ADMIN_OFFICER' && !['HEAD', 'ASSISTANT'].includes(role)) {
      return res.status(403).json({ message: 'Admin Officer can only create HEAD or ASSISTANT users' });
    }
    if (req.user.role === 'HEAD' && role !== 'ASSISTANT') {
      return res.status(403).json({ message: 'Head can only create ASSISTANT users' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Assign password from request or fall back
    const defaultPassword = req.body.password || 'DefaultPassword123!';

    const user = await User.create({
      name,
      email,
      phone,
      role,
      department: req.user.role === 'HEAD' ? req.user.department : department, 
      branch: req.user.role === 'HEAD' ? req.user.branch : branch,
      password: defaultPassword,
      requiresPasswordChange: true,
      createdBy: req.user._id
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      temporaryPassword: defaultPassword 
    });

    invalidateByPrefix('users');

    audit('USER_CREATED', {
      req,
      message: `User ${user.email} (${user.role}) created`,
      target: { model: 'User', documentId: user._id.toString(), identifier: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a user
router.put('/:id', protect, authorize('ADMIN_OFFICER', 'HEAD'), async (req, res) => {
  try {
    const userToEdit = await User.findById(req.params.id);
    const beforeSnapshot = userToEdit ? userToEdit.toObject() : null;
    
    if (!userToEdit) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure they have permission
    if (req.user.role === 'HEAD' && (userToEdit.department !== req.user.department || userToEdit.role !== 'ASSISTANT')) {
      return res.status(403).json({ message: 'Not authorized to edit this user' });
    }
    if (req.user.role === 'ADMIN_OFFICER' && userToEdit.role === 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to edit Admin users' });
    }

    const { name, email, phone, department, branch } = req.body;
    userToEdit.name = name || userToEdit.name;
    userToEdit.email = email || userToEdit.email;
    userToEdit.phone = phone || userToEdit.phone;
    if (req.user.role === 'ADMIN_OFFICER') {
      userToEdit.department = department || userToEdit.department;
      userToEdit.branch = branch || userToEdit.branch;
    }

    await userToEdit.save();

    audit('USER_UPDATED', {
      req,
      message: `User ${userToEdit.email} updated`,
      target: { model: 'User', documentId: userToEdit._id.toString(), identifier: userToEdit.email },
      before: beforeSnapshot,
      after: userToEdit.toObject(),
      fields: ['name', 'email', 'phone', 'department', 'branch']
    });

    invalidateByPrefix('users');
    res.json(userToEdit);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a user
router.delete('/:id', protect, authorize('ADMIN', 'ADMIN_OFFICER', 'HEAD'), async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure they have permission
    if (req.user.role === 'HEAD' && (userToDelete.department !== req.user.department || userToDelete.role !== 'ASSISTANT')) {
      return res.status(403).json({ message: 'Not authorized to delete this user' });
    }
    if (req.user.role === 'ADMIN_OFFICER' && userToDelete.role === 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to delete Admin users' });
    }
    if (String(req.user._id) === String(userToDelete._id)) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    await User.deleteOne({ _id: req.params.id });

    audit('USER_DELETED', {
      req,
      message: `User ${userToDelete.email} (${userToDelete.role}) deleted`,
      target: { model: 'User', documentId: userToDelete._id.toString(), identifier: userToDelete.email }
    });

    invalidateByPrefix('users');
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
