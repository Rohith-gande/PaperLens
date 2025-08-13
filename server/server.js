const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI not set. Check .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });

// Routes
const papersRoute = require('./routes/papers.js');
app.use('/api/papers', papersRoute);

const authRoute = require('./routes/auth.js');
app.use('/api/auth', authRoute);

const chatRoute = require('./routes/history.js');
app.use('/api/chat', chatRoute);

app.get('/', (req, res) => res.send('Research Bot Backend — OK 🚀'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));