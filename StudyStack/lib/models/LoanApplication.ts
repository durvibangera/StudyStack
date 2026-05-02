import mongoose, { Schema, Document } from 'mongoose';

// ── TypeScript Interfaces ────────────────────────────────────────────────────

export interface ILoanOffer {
  lender: string;
  interestRateMin: number;
  interestRateMax: number;
  maxLoanAmountINR: number;
  collateralRequired: boolean;
  moratoriumMonths: number;
  processingFeePercent: number;
  matchScore: number;           // 0–100
  matchReason: string;          // one sentence, deterministic
  applyUrl: string;
}

export interface IEMIScenario {
  label: string;
  principalINR: number;
  tenureMonths: number;
  interestRatePercent: number;
  monthlyEMI: number;
  totalRepayableINR: number;
  totalInterestINR: number;
}

export interface IDocumentItem {
  name: string;
  required: boolean;
  status: 'pending' | 'uploaded' | 'verified';
  lenders: string[];
}

export interface IROIProjection {
  estimatedTuitionINR: number;
  estimatedLivingCostINR: number;
  totalCostINR: number;
  expectedSalaryYear1INR: number;
  paybackPeriodMonths: number;
}

export interface IScoreBreakdown {
  academic: number;
  testScore: number;
  countryRisk: number;
  programTier: number;
  familyIncome: number;
  coApplicant: number;
}

export interface ILoanApplication extends Document {
  userId: mongoose.Types.ObjectId;
  eligibilityScore: number;
  eligibilityBand: 'High' | 'Medium' | 'Low' | 'Not Eligible';
  eligibilityNarrative: string;
  scoreBreakdown: IScoreBreakdown;
  matchedOffers: ILoanOffer[];
  roiProjection: IROIProjection | null;
  emiScenarios: IEMIScenario[];
  documentChecklist: IDocumentItem[];
  applicationStatus: 'not_started' | 'docs_pending' | 'submitted' | 'under_review' | 'approved' | 'disbursed';
  selectedLender: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const LoanOfferSchema = new Schema({
  lender:             { type: String, required: true },
  interestRateMin:    { type: Number, default: 0 },
  interestRateMax:    { type: Number, default: 0 },
  maxLoanAmountINR:   { type: Number, default: 0 },
  collateralRequired: { type: Boolean, default: false },
  moratoriumMonths:   { type: Number, default: 0 },
  processingFeePercent: { type: Number, default: 0 },
  matchScore:         { type: Number, default: 0 },
  matchReason:        { type: String, default: '' },
  applyUrl:           { type: String, default: '' },
}, { _id: false });

const EMIScenarioSchema = new Schema({
  label:              { type: String, required: true },
  principalINR:       { type: Number, default: 0 },
  tenureMonths:       { type: Number, default: 0 },
  interestRatePercent: { type: Number, default: 0 },
  monthlyEMI:         { type: Number, default: 0 },
  totalRepayableINR:  { type: Number, default: 0 },
  totalInterestINR:   { type: Number, default: 0 },
}, { _id: false });

const DocumentItemSchema = new Schema({
  name:     { type: String, required: true },
  required: { type: Boolean, default: true },
  status:   { type: String, enum: ['pending', 'uploaded', 'verified'], default: 'pending' },
  lenders:  { type: [String], default: [] },
}, { _id: false });

const ROIProjectionSchema = new Schema({
  estimatedTuitionINR:    { type: Number, default: 0 },
  estimatedLivingCostINR: { type: Number, default: 0 },
  totalCostINR:           { type: Number, default: 0 },
  expectedSalaryYear1INR: { type: Number, default: 0 },
  paybackPeriodMonths:    { type: Number, default: 0 },
}, { _id: false });

const ScoreBreakdownSchema = new Schema({
  academic:     { type: Number, default: 0 },
  testScore:    { type: Number, default: 0 },
  countryRisk:  { type: Number, default: 0 },
  programTier:  { type: Number, default: 0 },
  familyIncome: { type: Number, default: 0 },
  coApplicant:  { type: Number, default: 0 },
}, { _id: false });

// ── Main Schema ──────────────────────────────────────────────────────────────

const LoanApplicationSchema = new Schema<ILoanApplication>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  eligibilityScore:     { type: Number, default: 0 },
  eligibilityBand:      { type: String, enum: ['High', 'Medium', 'Low', 'Not Eligible'], default: 'Not Eligible' },
  eligibilityNarrative: { type: String, default: '' },
  scoreBreakdown:       { type: ScoreBreakdownSchema, default: () => ({}) },
  matchedOffers:        { type: [LoanOfferSchema], default: [] },
  roiProjection:        { type: ROIProjectionSchema, default: null },
  emiScenarios:         { type: [EMIScenarioSchema], default: [] },
  documentChecklist:    { type: [DocumentItemSchema], default: [] },
  applicationStatus:    {
    type: String,
    enum: ['not_started', 'docs_pending', 'submitted', 'under_review', 'approved', 'disbursed'],
    default: 'not_started',
  },
  selectedLender: { type: String, default: null },
}, {
  timestamps: true,
});

export default mongoose.models.LoanApplication || mongoose.model<ILoanApplication>('LoanApplication', LoanApplicationSchema);
