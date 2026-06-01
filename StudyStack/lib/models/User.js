import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const DashboardAnalysisSchema = new mongoose.Schema({
  profileFingerprint: {
    type: String,
    default: null,
  },
  missingFields: {
    type: [String],
    default: [],
  },
  source: {
    type: String,
    enum: ['gemini', 'local'],
    default: 'local',
  },
  model: {
    type: String,
    default: 'local-rules',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  analysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, { _id: false });

/**
 * User Schema with Embedded KYC
 */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.authProvider === 'credentials';
    }
  },
  authProvider: {
    type: String,
    enum: ['credentials', 'google'],
    default: 'credentials',
    required: true
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  
  // User Role
  role: {
    type: String,
    enum: ['student', 'counsellor'],
    default: 'student',
    required: true
  },
  
  // KYC Data (Embedded) — only for students
  studentProfile: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Onboarding Status
  hasCompletedKYC: {
    type: Boolean,
    default: false
  },

  // Cached Lead Score and Classification
  leadScore: {
    type: Number,
    default: 0
  },
  leadClassification: {
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'cold'
  },
  sessionCount: {
    type: Number,
    default: 0
  },
  bookingCount: {
    type: Number,
    default: 0
  },
  voiceSessionCount: {
    type: Number,
    default: 0
  },

  // Persisted AI dashboard analysis so refreshes don't repeatedly call Gemini
  dashboardAnalysis: {
    type: DashboardAnalysisSchema,
    default: null,
  },
  
  // Social Media Tokens
  socialTokens: {
    linkedin: {
      access_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    },
    twitter: {
      access_token: { type: String, select: false },
      refresh_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    }
  },
  
  // API Keys (Optional for future integrations)
  apiKeys: {
    gemini: { type: String, select: false },
    midjourney: { type: String, select: false },
    other: { type: Map, of: String, select: false }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Prevent model recompilation in development
export default mongoose.models.User || mongoose.model('User', UserSchema);
