const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({ 'socialTokens.linkedin.access_token': { $exists: true } }).toArray();
  console.log('Users with LinkedIn tokens:', users.length);
  if(users.length > 0) {
    console.log('Sample token start:', users[0].socialTokens.linkedin.access_token.substring(0, 15) + '...');
    console.log('Connected at:', users[0].socialTokens.linkedin.connected_at);
  } else {
    console.log('NO USERS FOUND WITH LINKEDIN TOKENS IN DB!');
  }
  process.exit(0);
}
check();
