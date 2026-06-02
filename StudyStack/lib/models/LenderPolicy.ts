import mongoose, { Schema, Document } from 'mongoose';

// ── TypeScript Interfaces ────────────────────────────────────────────────────

export interface IEligibilityCriteria {
  minGPA?: number;
  minCoApplicantIncomeINR?: number;
  supportedCountries: string[];
  supportedDegrees: string[];
  supportedCourseTypes: string[];
  minAge?: number;
  maxAge?: number;
  requiresCoApplicant: boolean;
  workExperienceRequired: boolean;
  minWorkExperienceYears?: number;
  additionalCriteria: string[];
}

export interface IFinancialTerms {
  interestRateMin: number;
  interestRateMax: number;
  maxLoanAmountINR: number;
  minLoanAmountINR: number;
  collateralRequired: boolean;
  collateralThresholdINR?: number;
  processingFeePercent: number;
  insuranceRequired: boolean;
  marginMoneyPercent?: number;
}

export interface IRepaymentTerms {
  minTenureMonths: number;
  maxTenureMonths: number;
  moratoriumMonths: number;
  repaymentOptions: string[];
  prepaymentAllowed: boolean;
  prepaymentPenaltyPercent?: number;
  emiStartCondition: string;
}

export interface IDocumentRequirement {
  name: string;
  required: boolean;
  conditions: string;
  category: 'identity' | 'academic' | 'financial' | 'property' | 'admission' | 'other';
}

export interface IRestrictions {
  approvedUniversities: string[];
  excludedPrograms: string[];
  countrySpecificNotes: Record<string, string>;
  maxCourseDurationYears?: number;
  onlyFullTime: boolean;
}

export interface IExtractedPolicies {
  eligibility: IEligibilityCriteria;
  financial: IFinancialTerms;
  repayment: IRepaymentTerms;
  documents: IDocumentRequirement[];
  restrictions: IRestrictions;
  specialFeatures: string[];
  taxBenefits: string;
  additionalNotes: string;
}

export interface IRagEvaluation {
  // Faithfulness: did the AI extract only what the doc actually says?
  faithfulnessScore: number;          // 0-100: % of extracted fields verified in source text
  faithfulnessFlags: {                // per-field verification result
    field: string;
    extractedValue: string;
    verified: boolean;
    evidence: string;                 // quote from source doc, or 'NOT FOUND'
  }[];
  // Completeness: are all critical fields present?
  completenessScore: number;          // 0-100
  missingCriticalFields: string[];
  // Overall
  overallScore: number;               // weighted: 60% faithfulness + 40% completeness
  verdict: 'excellent' | 'good' | 'partial' | 'poor';
  evaluatedAt: string;
}

export interface ILenderPolicy extends Document {
  lenderName: string;
  productName: string;
  uploadedBy: mongoose.Types.ObjectId;
  sourceDocumentUrl: string;
  sourceDocumentName: string;
  rawExtractedText: string;
  extractedPolicies: IExtractedPolicies;
  status: 'processing' | 'review' | 'active' | 'inactive';
  aiConfidenceScore: number;
  aiExtractionNotes: string;
  ragEvaluation?: IRagEvaluation;
  version: number;
  previousVersionId?: mongoose.Types.ObjectId;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const EligibilityCriteriaSchema = new Schema({
  minGPA:                    { type: Number, default: null },
  minCoApplicantIncomeINR:   { type: Number, default: null },
  supportedCountries:        { type: [String], default: [] },
  supportedDegrees:          { type: [String], default: [] },
  supportedCourseTypes:      { type: [String], default: [] },
  minAge:                    { type: Number, default: null },
  maxAge:                    { type: Number, default: null },
  requiresCoApplicant:       { type: Boolean, default: false },
  workExperienceRequired:    { type: Boolean, default: false },
  minWorkExperienceYears:    { type: Number, default: null },
  additionalCriteria:        { type: [String], default: [] },
}, { _id: false });

const FinancialTermsSchema = new Schema({
  interestRateMin:        { type: Number, default: 0 },
  interestRateMax:        { type: Number, default: 0 },
  maxLoanAmountINR:       { type: Number, default: 0 },
  minLoanAmountINR:       { type: Number, default: 0 },
  collateralRequired:     { type: Boolean, default: false },
  collateralThresholdINR: { type: Number, default: null },
  processingFeePercent:   { type: Number, default: 0 },
  insuranceRequired:      { type: Boolean, default: false },
  marginMoneyPercent:     { type: Number, default: null },
}, { _id: false });

const RepaymentTermsSchema = new Schema({
  minTenureMonths:          { type: Number, default: 12 },
  maxTenureMonths:          { type: Number, default: 180 },
  moratoriumMonths:         { type: Number, default: 0 },
  repaymentOptions:         { type: [String], default: [] },
  prepaymentAllowed:        { type: Boolean, default: true },
  prepaymentPenaltyPercent: { type: Number, default: null },
  emiStartCondition:        { type: String, default: '' },
}, { _id: false });

const DocumentRequirementSchema = new Schema({
  name:       { type: String, required: true },
  required:   { type: Boolean, default: true },
  conditions: { type: String, default: '' },
  category:   { type: String, enum: ['identity', 'academic', 'financial', 'property', 'admission', 'other'], default: 'other' },
}, { _id: false });

const RestrictionsSchema = new Schema({
  approvedUniversities:    { type: [String], default: [] },
  excludedPrograms:        { type: [String], default: [] },
  countrySpecificNotes:    { type: Schema.Types.Mixed, default: {} },
  maxCourseDurationYears:  { type: Number, default: null },
  onlyFullTime:            { type: Boolean, default: false },
}, { _id: false });

const ExtractedPoliciesSchema = new Schema({
  eligibility:     { type: EligibilityCriteriaSchema, default: () => ({}) },
  financial:       { type: FinancialTermsSchema, default: () => ({}) },
  repayment:       { type: RepaymentTermsSchema, default: () => ({}) },
  documents:       { type: [DocumentRequirementSchema], default: [] },
  restrictions:    { type: RestrictionsSchema, default: () => ({}) },
  specialFeatures: { type: [String], default: [] },
  taxBenefits:     { type: String, default: '' },
  additionalNotes: { type: String, default: '' },
}, { _id: false });

// ── Main Schema ──────────────────────────────────────────────────────────────

const LenderPolicySchema = new Schema<ILenderPolicy>({
  lenderName: {
    type: String,
    required: true,
    trim: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sourceDocumentUrl: {
    type: String,
    required: true,
  },
  sourceDocumentName: {
    type: String,
    default: '',
  },
  rawExtractedText: {
    type: String,
    default: '',
  },
  extractedPolicies: {
    type: ExtractedPoliciesSchema,
    default: () => ({}),
  },
  status: {
    type: String,
    enum: ['processing', 'review', 'active', 'inactive'],
    default: 'processing',
  },
  aiConfidenceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  aiExtractionNotes: {
    type: String,
    default: '',
  },
  ragEvaluation: {
    type: Schema.Types.Mixed,
    default: null,
  },
  version: {
    type: Number,
    default: 1,
  },
  previousVersionId: {
    type: Schema.Types.ObjectId,
    default: null,
  },
  activatedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for fast lookups
LenderPolicySchema.index({ status: 1 });
LenderPolicySchema.index({ uploadedBy: 1, status: 1 });
LenderPolicySchema.index({ lenderName: 1, productName: 1 });

export default mongoose.models.LenderPolicy || mongoose.model<ILenderPolicy>('LenderPolicy', LenderPolicySchema);
