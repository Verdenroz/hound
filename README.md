# 🐕 Hound AI

An **autonomous financial trading agent** powered by AI that monitors real-time financial news, analyzes market impact, and executes trades transparently on the XRP Ledger blockchain.

Built for the **MLH Hackathon - Emerging Technology Track**.

## 🎯 Purpose

Hound is an AI-powered autonomous trading system that:

- 📰 **Monitors** real-time financial news from trusted sources using Tavily AI
- 🤖 **Analyzes** news impact on your portfolio holdings using Google Gemini
- 💡 **Decides** when to buy or sell based on sentiment, confidence, and risk assessment
- 🔐 **Executes** trades transparently on the XRP Ledger blockchain using RLUSD stablecoin
- 📊 **Tracks** all transactions with full audit trail and reasoning explanations

## 🏗️ Architecture

### Frontend
- **Next.js 15** with React 19 and TypeScript
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library
- **Auth0** for user authentication
- **Real-time WebSocket** updates from backend

### Backend
- **Express.js** REST API server
- **WebSocket Server** for real-time client updates
- **Multi-user agent orchestration** system
- **State machine-based** autonomous decision making

### Infrastructure & Services
- **Redis** (hosted on Render.com) - Data persistence for portfolios, trades, logs, and news
- **XRPL** (XRP Ledger) - Blockchain for transparent trade execution using RLUSD stablecoin
- **Tavily API** - Real-time financial news monitoring and search
- **Google Gemini AI** - News impact analysis and trading decisions
- **Finance Query API** - Real-time stock price data
- **Render.com** - Production deployment (Oregon region)

## 🔧 Tech Stack

### Core Technologies
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **Next.js 15** - React framework with App Router
- **Express.js** - Backend API framework

### AI & Data
- `@google/generative-ai` - Gemini AI integration
- `tavily` - Financial news API

### Blockchain
- `xrpl` - XRP Ledger SDK for trade execution

### Database & Caching
- `ioredis` - Redis client for data persistence

### Authentication
- `@auth0/nextjs-auth0` - Secure user authentication
- `jsonwebtoken` - JWT handling
- `jwks-rsa` - Key verification

### Real-time Communication
- `ws` - WebSocket server/client
- Real-time portfolio and trade updates

### UI Components
- `@radix-ui/*` - Accessible component primitives
- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icon library
- `next-themes` - Dark/light mode support

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ installed
- Redis instance (local or hosted)
- API Keys:
  - Tavily API Key
  - Google Gemini API Key
  - (Optional) XRPL wallet seed

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hound.git
   cd hound
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   # API Keys
   TAVILY_API_KEY=your_tavily_api_key
   GEMINI_API_KEY=your_gemini_api_key

   # XRPL Configuration (optional - will auto-generate wallet if not provided)
   XRPL_WALLET_SEED=your_xrpl_wallet_seed
   XRPL_BROKER_ADDRESS=rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY

   # Redis
   REDIS_URL=redis://localhost:6379

   # Auth0
   AUTH0_SECRET=your_auth0_secret
   AUTH0_BASE_URL=http://localhost:3000
   AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
   AUTH0_CLIENT_ID=your_client_id
   AUTH0_CLIENT_SECRET=your_client_secret

   # Backend
   BACKEND_PORT=3001
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
   ```

4. **Start Redis**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine

   # Or install locally
   brew install redis  # macOS
   sudo apt install redis  # Ubuntu
   ```

5. **Run the development servers**

   **Option A: Run both frontend and backend together**
   ```bash
   npm run dev:all
   ```

   **Option B: Run separately**
   ```bash
   # Terminal 1 - Frontend
   npm run dev

   # Terminal 2 - Backend
   npm run dev:backend
   ```

6. **Access the application**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:3001](http://localhost:3001)
   - WebSocket: `ws://localhost:3001/ws`

## 📦 Deployment

This project is configured for deployment on **Render.com** using the included `render.yaml`.

### Services
- **Web Service**: Node.js backend API (Oregon region, free tier)
- **Redis Database**: Managed Redis instance (Oregon region, free tier)

To deploy:
1. Push your code to GitHub
2. Connect your repository to Render.com
3. Render will auto-detect `render.yaml` and provision services
4. Add your environment variables in the Render dashboard

## 🎮 How It Works

### Agent State Machine

The autonomous agent operates through a state machine with the following states:

1. **Monitoring** - Scans financial news sources for portfolio-relevant articles
2. **Analyzing** - Uses Gemini AI to analyze news sentiment and market impact
3. **Deciding** - Determines trade action (buy/sell/hold) and position sizing
4. **Risk Check** - Validates trade against risk limits and portfolio constraints
5. **Executing** - Executes trade on XRPL blockchain with RLUSD
6. **Explaining** - Generates human-readable explanation of decision

### Risk Management

- **Daily Trade Limit**: Maximum 3 trades per 24 hours
- **Position Sizing**: Max 30% of portfolio in any single stock
- **Cash Management**: Adjusts trade size based on available cash
- **Confidence Threshold**: Requires ≥75% confidence and ≥7/10 impact score

### Multi-User Support

Each user gets:
- Isolated portfolio and agent instance
- Unique XRPL wallet for trade execution
- Personal trading history and logs
- Real-time WebSocket updates for their session

## 📁 Project Structure

```
hound/
├── backend/               # Express.js backend
│   ├── agent/            # Agent orchestrator and state machine
│   ├── services/         # External service integrations
│   │   ├── gemini.ts    # Google Gemini AI
│   │   ├── tavily.ts    # News monitoring
│   │   ├── xrpl.ts      # Blockchain trades
│   │   ├── finance.ts   # Stock price data
│   │   └── redis.ts     # Data persistence
│   ├── utils/           # Types and utilities
│   └── server.ts        # Express server + WebSocket
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main dashboard
│   ├── components/      # React components
│   │   ├── ui/         # shadcn/ui components
│   │   ├── AgentStatusPanel.tsx
│   │   ├── PortfolioPanel.tsx
│   │   ├── NewsPanel.tsx
│   │   ├── LogsPanel.tsx
│   │   └── TransactionHistory.tsx
│   └── lib/            # Frontend utilities
├── public/             # Static assets
├── .env.local         # Environment variables
├── package.json       # Dependencies
├── render.yaml        # Render.com deployment config
└── tsconfig.json      # TypeScript configuration
```

## 🔑 API Endpoints

### User Configuration
- `GET /api/user/configure` - Get user portfolio configuration
- `POST /api/user/configure` - Initialize user portfolio
- `PUT /api/user/configure` - Update user configuration

### Agent Control
- `GET /api/agent/status` - Get agent state and status
- `POST /api/agent/start` - Start autonomous trading agent
- `POST /api/agent/stop` - Stop agent

### Data & History
- `GET /api/portfolio` - Get current portfolio
- `DELETE /api/portfolio/holding` - Remove a holding
- `GET /api/trades` - Get trade history
- `GET /api/logs` - Get agent decision logs
- `GET /api/news` - Get processed news articles
- `GET /api/tickers/search` - Search for stock tickers

### Health
- `GET /api/health` - Health check endpoint

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Harvey Tseng

## 🙏 Acknowledgments

- **Tavily** - Real-time financial news API
- **Google Gemini** - AI-powered news analysis
- **XRPL** - Transparent blockchain settlement
- **Render.com** - Hosting infrastructure
- **shadcn/ui** - Beautiful component library
- **Auth0** - Secure authentication

---

Built with ❤️ for the MLH Hackathon - Emerging Technology Track
