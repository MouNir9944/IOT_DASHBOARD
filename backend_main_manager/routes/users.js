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
      users = await User.find({ role: { $in: ['user', 'technicien', 'admin', 'sous admin'] } });
    } else if (role === 'admin') {
      // Admin can only see users they created (including other admins they created)
      if (createdBy) {
        users = await User.find({ 
          role: { $in: ['user', 'technicien', 'sous admin'] },
          createdBy: createdBy
        });
      } else {
        // Fallback: show all users, techniciens, and sous admins (for backward compatibility)
        users = await User.find({ role: { $in: ['user', 'technicien', 'sous admin'] } });
      }
    } else if (role === 'sous admin') {
      // Sous admin can only see users they created
      if (createdBy) {
        users = await User.find({ 
          role: { $in: ['user', 'technicien'] },
          createdBy: createdBy
        });
      } else {
        // Fallback: show all users and techniciens (for backward compatibility)
        users = await User.find({ role: { $in: ['user', 'technicien'] } });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - create user with role-based access control
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, sites, createdBy, creatorRole } = req.body;
    
    // Role-based access control for user creation
    if (creatorRole === 'superadmin') {
      // Superadmin can create all roles
      if (!['user', 'technicien', 'sous admin', 'admin'].includes(role)) {
        return res.status(403).json({ error: 'Invalid role for creation' });
      }
    } else if (creatorRole === 'admin') {
      // Admin can create: sous admin, technicien, user (but NOT admin)
      if (!['user', 'technicien', 'sous admin'].includes(role)) {
        return res.status(403).json({ error: 'Admin users cannot create other admin users' });
      }
    } else if (creatorRole === 'sous admin') {
      // Sous admin can create: technicien, user
      if (!['user', 'technicien'].includes(role)) {
        return res.status(403).json({ error: 'Sous admin users can only create technicien and user roles' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to create users' });
    }
    
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

// PUT /api/users/:id - update user with role-based access control
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, password, role, sites, createdBy, creatorRole } = req.body;
    
    // Role-based access control for role updates
    if (role !== undefined) {
      if (creatorRole === 'superadmin') {
        // Superadmin can update to any role
        if (!['user', 'technicien', 'sous admin', 'admin'].includes(role)) {
          return res.status(403).json({ error: 'Invalid role for update' });
        }
      } else if (creatorRole === 'admin') {
        // Admin can update to: sous admin, technicien, user (but NOT admin)
        if (!['user', 'technicien', 'sous admin'].includes(role)) {
          return res.status(403).json({ error: 'Admin users cannot update users to admin role' });
        }
      } else if (creatorRole === 'sous admin') {
        // Sous admin can update to: technicien, user
        if (!['user', 'technicien'].includes(role)) {
          return res.status(403).json({ error: 'Sous admin users can only update users to technicien and user roles' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions to update user roles' });
      }
    }
    
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

// DELETE /api/users/:id - delete user with role-based access control
router.delete('/:id', async (req, res) => {
  try {
    const { creatorRole, createdBy } = req.query;
    
    // Role-based access control for user deletion
    if (creatorRole === 'superadmin') {
      // Superadmin can delete any user
    } else if (creatorRole === 'admin') {
      // Admin can only delete users they created
      if (createdBy) {
        const user = await User.findById(req.params.id);
        if (!user || user.createdBy?.toString() !== createdBy) {
          return res.status(403).json({ error: 'Admin users can only delete users they created' });
        }
      } else {
        return res.status(400).json({ error: 'CreatedBy parameter required for admin deletion' });
      }
    } else if (creatorRole === 'sous admin') {
      // Sous admin can only delete users they created
      if (createdBy) {
        const user = await User.findById(req.params.id);
        if (!user || user.createdBy?.toString() !== createdBy) {
          return res.status(403).json({ error: 'Sous admin users can only delete users they created' });
        }
      } else {
        return res.status(400).json({ error: 'CreatedBy parameter required for sous admin deletion' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to delete users' });
    }
    
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