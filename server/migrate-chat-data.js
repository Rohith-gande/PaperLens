const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Old model (for migration)
const oldChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [
    {
      role: { type: String, enum: ['user', 'bot'], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

const OldChat = mongoose.model('Chat', oldChatSchema);

// New model
const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'bot'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

async function migrateChatData() {
  try {
    console.log('Starting chat data migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find all old chat documents
    const oldChats = await OldChat.find({});
    console.log(`Found ${oldChats.length} old chat documents to migrate`);
    
    for (const oldChat of oldChats) {
      if (oldChat.messages && oldChat.messages.length > 0) {
        // Create a title from the first user message
        const firstUserMessage = oldChat.messages.find(m => m.role === 'user');
        const title = firstUserMessage 
          ? (firstUserMessage.text.length > 50 ? firstUserMessage.text.substring(0, 50) + '...' : firstUserMessage.text)
          : 'Migrated Chat';
        
        // Create new chat session
        const newSession = new ChatSession({
          userId: oldChat.userId,
          title: title,
          messages: oldChat.messages,
          createdAt: oldChat.messages[0]?.timestamp || new Date(),
          updatedAt: oldChat.messages[oldChat.messages.length - 1]?.timestamp || new Date()
        });
        
        await newSession.save();
        console.log(`Migrated chat for user ${oldChat.userId} with ${oldChat.messages.length} messages`);
      }
    }
    
    console.log('Migration completed successfully!');
    
    // Optionally, you can drop the old collection after confirming migration
    // await OldChat.collection.drop();
    // console.log('Old chat collection dropped');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateChatData();
}

module.exports = { migrateChatData };
