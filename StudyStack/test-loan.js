const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/studystack');
    
    const Schema = mongoose.Schema;
    const LoanApplicationSchema = new Schema({
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
      },
      eligibilityScore:     { type: Number, default: 0 },
      eligibilityBand:      { type: String, enum: ['High', 'Medium', 'Low', 'Not Eligible'], default: 'Not Eligible' },
      eligibilityNarrative: { type: String, default: '' },
    });
    
    const LoanApplication = mongoose.model('LoanApplication', LoanApplicationSchema);

    const mockUserIdStr = new mongoose.Types.ObjectId().toString(); // string
    const result = await LoanApplication.findOneAndUpdate(
      { userId: mockUserIdStr }, // string query
      {
        userId: mockUserIdStr, // string update
        eligibilityScore: 75,
        eligibilityBand: 'High',
        eligibilityNarrative: 'Upserted narrative',
      },
      { upsert: true, new: true }
    );
    
    console.log("Upsert successful:", result);
    
    await LoanApplication.deleteOne({ _id: result._id });
    console.log("Cleanup successful");
    
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    mongoose.disconnect();
  }
}

test();
