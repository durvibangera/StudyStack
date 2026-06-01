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
  prosAndCons?: {
    pros: string[];
    cons: string[];
  };
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
  expectedSalaryYear3INR?: number;
  expectedSalaryYear5INR?: number;
  paybackPeriodMonths: number;
  roiPercentage?: number;
  salarySourceUrls?: string[];
  salaryNotes?: string;
  currencyConversionNote?: string;
}

export interface IScoreBreakdown {
  academic: number;
  testScore: number;
  countryRisk: number;
  programTier: number;
  familyIncome: number;
  coApplicant: number;
}

export interface IPolicyMatchResult {
  policyId: string;
  lenderName: string;
  productName: string;
  eligible: boolean;
  partiallyEligible: boolean;
  matchScore: number;
  reasons: { criterion: string; met: boolean; detail: string }[];
  interestRateRange: string;
  maxLoanAmountINR: number;
  collateralRequired: boolean;
}

export interface IUploadedDocument {
  documentName: string;
  cloudinaryUrl: string;
  uploadedAt: Date;
  aiValidation: {
    status: 'valid' | 'issues_found' | 'unreadable' | 'pending';
    extractedData: Record<string, any>;
    issues: string[];
    confidenceScore: number;
  };
}

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: { type: string; label: string; data?: any }[];
}

export interface IScholarship {
  name: string;
  provider: string;
  amount: string;
  deadline?: string;
  eligibility: string;
  applyUrl?: string;
  sourceUrl?: string;
  impact?: string;
  competitiveness?: string;
}

export interface IForumInsight {
  title: string;
  url: string;
  platform: string;
  keyTakeaway: string;
  sentiment?: string;
  relevanceScore?: number;
}

export interface IGovernmentScheme {
  name: string;
  description: string;
  benefits: string;
  eligibility: string;
  applyUrl?: string;
  sourceUrl?: string;
}

export interface ISource {
  title: string;
  url: string;
  sourceType: string;
  favicon?: string;
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
  // Persisted loan intelligence data
  kpis: Record<string, any> | null;
  analysis: Record<string, any> | null;
  scholarships: IScholarship[];
  forumInsights: IForumInsight[];
  governmentSchemes: IGovernmentScheme[];
  searchParams: Record<string, any> | null;
  sources: ISource[];
  profileSnapshot: Record<string, any> | null;
  lastAnalyzedAt: Date | null;
  // Policy-driven loan conversion layer
  policyMatchResults: IPolicyMatchResult[];
  uploadedDocuments: IUploadedDocument[];
  chatHistory: IChatMessage[];
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
  prosAndCons: {
    pros: { type: [String], default: [] },
    cons: { type: [String], default: [] },
  }
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
  selectedLender:       { type: String, default: null },
  // Persisted loan intelligence data
  kpis:                 { type: Schema.Types.Mixed, default: null },
  analysis:             { type: Schema.Types.Mixed, default: null },
  scholarships:         [Schema.Types.Mixed],
  forumInsights:        [Schema.Types.Mixed],
  governmentSchemes:    [Schema.Types.Mixed],
  searchParams:         { type: Schema.Types.Mixed, default: null },
  sources:              [Schema.Types.Mixed],
  profileSnapshot:      { type: Schema.Types.Mixed, default: null },
  lastAnalyzedAt:       { type: Date, default: null },
  // Policy-driven loan conversion layer
  policyMatchResults:   [Schema.Types.Mixed],
  uploadedDocuments:    [Schema.Types.Mixed],
  chatHistory:          [Schema.Types.Mixed],
}, {
  timestamps: true,
});

export default mongoose.models.LoanApplication || mongoose.model<ILoanApplication>('LoanApplication', LoanApplicationSchema);
