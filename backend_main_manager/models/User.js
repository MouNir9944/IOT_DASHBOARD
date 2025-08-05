import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin','superadmin','installator'], 
    default: 'user' 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sites: [{
    type: mongoose.Schema.Types.ObjectId,

  }]
}, { 
  timestamps: true 
});

// Create index for email
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);
export default User;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
} 