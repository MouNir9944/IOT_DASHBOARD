import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';




const router = express.Router();


// GET /api/users - superadmin gets all users except superadmin, admin gets only users created by them
router.get('/', async (req, res) => {
  try {
    const role = req.query.role;
    const createdBy = req.query.createdBy; // User ID of the admin creating the request
    
    let users;
    if (role === 'superadmin') {
      // Superadmin can see all users except other superadmins
      users = await User.find({ role: { $in: ['user', 'installator', 'admin'] } });
    } else if (role === 'admin') {
      // Admin can only see users they created (including other admins they created)
      if (createdBy) {
        users = await User.find({ 
          role: { $in: ['user', 'installator', 'admin'] },
          createdBy: createdBy
        });
      } else {
        // Fallback: show all users, installators, and admins (for backward compatibility)
        users = await User.find({ role: { $in: ['user', 'installator', 'admin'] } });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - create user (superadmin and admin can create users)
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, sites, createdBy } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role, 
      sites,
      createdBy: createdBy || null // Set createdBy field
    });
    await user.save();

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - update user
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, password, role, sites, createdBy } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (password !== undefined) {
      user.password = await bcrypt.hash(password, 10);
    }
    if (role !== undefined) user.role = role;
    if (sites !== undefined) user.sites = sites;
    if (createdBy !== undefined) user.createdBy = createdBy;
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/created-by/:creatorId - get users created by a specific user
router.get('/created-by/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const users = await User.find({ createdBy: creatorId });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 