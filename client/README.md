# Research Assistant - ChatGPT-Style Interface

A modern React.js application that provides a ChatGPT-style interface for searching and analyzing research papers using AI-powered summaries and comparisons.

## Features

### 🔐 User Authentication
- Secure user registration and login system
- JWT token-based authentication
- Protected routes for authenticated users only

### 💬 ChatGPT-Style Chat Interface
- Real-time chat interface similar to ChatGPT
- Message history with user and bot conversations
- Responsive design for desktop and mobile devices
- Smooth animations and transitions

### 📚 Research Paper Search
- Search arXiv for research papers on any topic
- AI-powered summaries using Cohere API
- Display of paper metadata (title, authors, links)
- Top 5 papers returned per search

### 🔍 Paper Comparison
- Select multiple papers for comparison
- AI-powered comparison analysis using Cohere
- Side-by-side comparison of research findings
- Detailed comparison summaries

### ❓ Q&A on Papers
- Ask specific questions about individual papers
- AI-powered answers based on paper content
- Context-aware responses using paper summaries

### 📱 Responsive Design
- Mobile-first responsive design
- Collapsible sidebar for mobile devices
- Touch-friendly interface elements
- Optimized for all screen sizes

## Technology Stack

### Frontend
- **React 19** - Modern React with hooks and functional components
- **React Router DOM** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **Vite** - Fast build tool and development server

### Backend Integration
- **Express.js** - Node.js web framework
- **MongoDB** - NoSQL database
- **JWT** - JSON Web Tokens for authentication
- **Cohere API** - AI-powered text analysis
- **arXiv API** - Research paper search

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Backend server running (see server README)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd research/client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the client directory:
   ```env
   VITE_API_BASE_URL=http://localhost:5000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## Usage

### Authentication
1. Create a new account or sign in with existing credentials
2. JWT tokens are automatically stored and managed
3. Protected routes ensure only authenticated users can access the chat

### Searching for Papers
1. Type your research topic in the chat input
2. Examples: "machine learning", "climate change", "quantum computing"
3. The system will search arXiv and return relevant papers
4. Each paper includes AI-generated summaries

### Comparing Papers
1. Search for papers on your topic
2. Select 2 or more papers using the checkboxes
3. Click "Compare Selected Papers"
4. View AI-powered comparison analysis

### Asking Questions
1. Click "Ask about this paper" on any paper card
2. Type your question about the paper
3. Receive AI-powered answers based on the paper content

## Project Structure

```
client/
├── src/
│   ├── api/
│   │   └── client.js          # API client configuration
│   ├── components/
│   │   ├── Header.jsx         # Navigation header
│   │   ├── LoadingSpinner.jsx # Loading indicator
│   │   └── ProtectedRoute.jsx # Route protection
│   ├── context/
│   │   └── AuthContext.jsx    # Authentication context
│   ├── pages/
│   │   ├── Chat.jsx           # Main chat interface
│   │   ├── Login.jsx          # Login page
│   │   └── Register.jsx       # Registration page
│   ├── App.jsx                # Main app component
│   ├── index.css              # Global styles
│   └── main.jsx               # App entry point
├── public/                    # Static assets
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## API Endpoints

The frontend communicates with the backend through these endpoints:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/message` - Save chat message
- `POST /api/papers/search` - Search for papers
- `POST /api/papers/compare` - Compare selected papers
- `POST /api/papers/:id/ask` - Ask question about paper

## Styling

The application uses Tailwind CSS with custom animations and components:

- **Color Scheme**: Blue primary colors with gray accents
- **Typography**: Clean, readable fonts with proper hierarchy
- **Animations**: Smooth transitions and hover effects
- **Responsive**: Mobile-first design approach

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- Functional components with hooks
- Consistent naming conventions
- Proper error handling
- Responsive design patterns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please open an issue in the repository or contact the development team.
