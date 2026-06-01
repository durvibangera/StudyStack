require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const LenderPolicySchema = new mongoose.Schema({
  lenderName: { type: String, required: true },
  productName: { type: String, required: true },
  status: { type: String, enum: ['review', 'active', 'inactive'], default: 'review' },
  aiConfidenceScore: { type: Number },
  extractedPolicies: { type: mongoose.Schema.Types.Mixed },
  rawExtractedText: { type: String }
}, { timestamps: true });

const LenderPolicy = mongoose.models.LenderPolicy || mongoose.model('LenderPolicy', LenderPolicySchema);

const policies = [
  {
    lenderName: "Poonawala Fincorp",
    productName: "Unsecured Education Loan",
    status: "active",
    aiConfidenceScore: 95,
    extractedPolicies: {
      eligibility: {
        minGPA: 7.0,
        minCoApplicantIncomeINR: 800000,
        supportedCountries: ["USA", "UK", "Canada", "Australia", "Germany", "Ireland"],
        supportedDegrees: ["Masters", "MS", "MBA", "STEM", "PhD"],
        requiresCoApplicant: true
      },
      financial: {
        interestRateMin: 11.75,
        interestRateMax: 13.5,
        maxLoanAmountINR: 4500000,
        collateralRequired: false,
        processingFeePercent: 1.5
      },
      repayment: {
        maxTenureMonths: 120,
        moratoriumMonths: 6,
        prepaymentPenaltyPercent: 0
      },
      documents: [],
      restrictions: {},
      specialFeatures: [
        "Fast processing time (often 3-5 days)", 
        "Zero asset valuation or legal verification required", 
        "Best for students heading to premier global institutions"
      ]
    },
    rawExtractedText: "Lender: Poonawala Fincorp\nProduct: Unsecured Education Loan\n..."
  },
  {
    lenderName: "Poonawala Fincorp",
    productName: "Partially Secured Education Loan",
    status: "active",
    aiConfidenceScore: 95,
    extractedPolicies: {
      eligibility: {
        minGPA: 6.5,
        minCoApplicantIncomeINR: 600000,
        supportedCountries: ["USA", "UK", "Canada", "Australia", "Germany", "Ireland", "Europe"],
        supportedDegrees: ["Masters", "MS", "MBA", "STEM", "Bachelors"],
        requiresCoApplicant: true
      },
      financial: {
        interestRateMin: 10.75,
        interestRateMax: 11.75,
        maxLoanAmountINR: 7500000,
        collateralRequired: true,
        processingFeePercent: 1.0
      },
      repayment: {
        maxTenureMonths: 144,
        moratoriumMonths: 6,
        prepaymentPenaltyPercent: 0
      },
      documents: [],
      restrictions: {},
      specialFeatures: [
        "Hybrid model that lowers interest rates compared to fully unsecured loans", 
        "Moderate processing time (usually 5-7 days)", 
        "Allows families with smaller assets to unlock higher loan amounts"
      ]
    },
    rawExtractedText: "Lender: Poonawala Fincorp\nProduct: Partially Secured Education Loan\n..."
  },
  {
    lenderName: "Poonawala Fincorp",
    productName: "Secured Education Loan",
    status: "active",
    aiConfidenceScore: 95,
    extractedPolicies: {
      eligibility: {
        minGPA: 6.0,
        minCoApplicantIncomeINR: 400000,
        supportedCountries: ["USA", "UK", "Canada", "Australia", "Germany", "Ireland", "Europe", "New Zealand"],
        supportedDegrees: ["Masters", "MS", "MBA", "STEM", "Bachelors", "Diploma"],
        requiresCoApplicant: true
      },
      financial: {
        interestRateMin: 9.25,
        interestRateMax: 10.5,
        maxLoanAmountINR: 15000000,
        collateralRequired: true,
        processingFeePercent: 0.75
      },
      repayment: {
        maxTenureMonths: 180,
        moratoriumMonths: 12,
        prepaymentPenaltyPercent: 0
      },
      documents: [],
      restrictions: {},
      specialFeatures: [
        "Near-zero risk for bank yields the lowest interest rates and largest loan amounts", 
        "Longest repayment windows and most lenient academic evaluations", 
        "Slower processing time due to property legal check and asset valuation"
      ]
    },
    rawExtractedText: "Lender: Poonawala Fincorp\nProduct: Secured Education Loan\n..."
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    await LenderPolicy.deleteMany({});
    console.log('Cleared existing policies');

    await LenderPolicy.insertMany(policies);
    console.log('Inserted Poonawala Fincorp policies');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding policies:', error);
    process.exit(1);
  }
}

seed();
