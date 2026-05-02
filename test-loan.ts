import mongoose from 'mongoose';
import dbConnect from './StudyStack/lib/mongodb';
import LoanApplication from './StudyStack/lib/models/LoanApplication';
import { ObjectId } from 'mongodb';

async function test() {
  try {
    await dbConnect();
    const mockUserId = new mongoose.Types.ObjectId();
    const doc = new LoanApplication({
      userId: mockUserId,
      eligibilityScore: 50,
      eligibilityBand: 'Medium',
      eligibilityNarrative: 'Test narrative',
    });
    
    await doc.validate();
    console.log("Validation successful");
    
    const saved = await doc.save();
    console.log("Save successful:", saved._id);
    
    await LoanApplication.deleteOne({ _id: saved._id });
    console.log("Cleanup successful");
    
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    mongoose.disconnect();
  }
}

test();
