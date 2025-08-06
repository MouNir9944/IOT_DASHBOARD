import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';




const router = express.Router();


// GET /api/users - superadmin gets all users except superadmin, admin gets only installators and users
router.get('/', async (req, res) => {
  try {
    const role = req.query.role;
    let users;
    if (role === 'superadmin') {
      users = await User.find({ role: { $in: ['user', 'installator', 'admin'] } });
    } else if (role === 'admin') {
      users = await User.find({ role: { $in: ['user', 'installator'] } });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - create user (superadmin only)
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, sites } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role, sites });
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

    const { name, email, password, role, sites } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (password !== undefined) {
      user.password = await bcrypt.hash(password, 10);
    }
    if (role !== undefined) user.role = role;
    if (sites !== undefined) user.sites = sites;
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

export default router; 