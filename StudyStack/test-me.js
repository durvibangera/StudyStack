const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection('users').findOne({ 'socialTokens.linkedin.access_token': { $exists: true } }, { sort: { 'socialTokens.linkedin.connected_at': -1 } });
  const token = user.socialTokens.linkedin.access_token;
  
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      Authorization: 'Bearer ' + token,
      'LinkedIn-Version': '202605',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
  process.exit(0);
}
test();
