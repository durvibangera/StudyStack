require('dotenv').config();
const { computeLoanReadiness, findBestLoanMatch } = require('./lib/lead-scoring');

const mockProfile = {
  gpaPercentage: "9.2 CGPA",
  budgetRange: "₹30-35 Lakhs",
  targetCountries: ["USA"],
  englishTestStatus: "IELTS score 7.5",
  courseInterest: "MSc Computer Science"
};

console.log("Mock Profile:", mockProfile);

// Test Loan Readiness Scoring
const readiness = computeLoanReadiness(mockProfile);
console.log("\nComputed Loan Readiness:");
console.log("Score:", readiness.score);
console.log("Band:", readiness.band);
console.log("Preference:", readiness.loanTypePreference);
console.log("Reasons:", readiness.reasons);

// Verify correct output
if (readiness.score >= 80 && readiness.band === 'Excellent' && readiness.loanTypePreference === 'Unsecured') {
  console.log("\n✅ computeLoanReadiness verified successfully!");
} else {
  console.log("\n❌ computeLoanReadiness verification failed!");
}
