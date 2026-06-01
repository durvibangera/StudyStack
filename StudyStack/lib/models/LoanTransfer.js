import mongoose from 'mongoose';

const LoanTransferSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Current Loan Details
  currentLoan: {
    lenderName: {
      type: String,
      required: true,
    },
    outstandingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
    currentEMI: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingTenure: {
      type: Number,
      required: true,
      min: 1,
    },
    loanSanctionDate: {
      type: Date,
    },
    disbursementDate: {
      type: Date,
    },
    repaymentStartDate: {
      type: Date,
    },
    monthsOfRepayment: {
      type: Number,
      min: 0,
    },
  },

  // Selected Poonawala Scheme
  selectedScheme: {
    type: String,
    enum: ['standard', 'premium', 'topup'],
    required: true,
  },

  // Poonawala Loan Details (calculated)
  poonawalaLoan: {
    proposedInterestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
    proposedEMI: {
      type: Number,
      required: true,
      min: 0,
    },
    proposedTenure: {
      type: Number,
      required: true,
      min: 1,
    },
    processingFee: {
      type: Number,
      required: true,
      min: 0,
    },
    totalInterestPayable: {
      type: Number,
      required: true,
      min: 0,
    },
  },

  // Savings Calculation
  savings: {
    monthlyEMISavings: {
      type: Number,
      required: true,
    },
    totalInterestSavings: {
      type: Number,
      required: true,
    },
    breakEvenMonths: {
      type: Number,
      required: true,
    },
    netSavings: {
      type: Number,
      required: true,
    },
  },

  // Eligibility Assessment
  eligibility: {
    isEligible: {
      type: Boolean,
      default: false,
    },
    eligibilityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    reasons: [String],
    blockers: [String],
  },

  // Application Status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'disbursed'],
    default: 'draft',
  },

  // Application Documents
  documents: {
    loanSanctionLetter: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    repaymentTrackRecord: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    noc: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    identityProof: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    incomeProof: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    collateralDocuments: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    admissionLetter: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
    currentLoanStatement: {
      fileName: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false },
    },
  },

  // Application Timeline
  submittedAt: {
    type: Date,
  },
  approvedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  disbursedAt: {
    type: Date,
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
LoanTransferSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for efficient querying
LoanTransferSchema.index({ userId: 1, createdAt: -1 });
LoanTransferSchema.index({ status: 1 });
LoanTransferSchema.index({ userId: 1, status: 1 });

export default mongoose.models.LoanTransfer || mongoose.model('LoanTransfer', LoanTransferSchema);
