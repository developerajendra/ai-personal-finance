# Zerodha Kite API Setup Guide

## Overview
The application now supports fetching stocks and mutual funds data from Zerodha Kite API. Currently, it uses mock data for development. To connect to the actual Zerodha API, follow these steps:

## Setup Steps

### 1. Create Zerodha Kite Connect App
1. Go to [Zerodha Kite Connect](https://kite.trade/apps/)
2. Create a new app
3. Note down your `API Key` and `API Secret`
4. Set redirect URI: `http://localhost:3000/api/zerodha/callback` (for development)

### 2. Install Zerodha Kite Connect SDK
```bash
npm install kiteconnect
```

### 3. Configure Environment Variables
Add to `.env.local`:
```env
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here
ZERODHA_REDIRECT_URI=http://localhost:3000/api/zerodha/callback
```

### 4. Update Zerodha Service
The service is located at `core/services/zerodhaService.ts`. Currently it uses mock data. To use real API:

1. Import KiteConnect:
```typescript
import { KiteConnect } from 'kiteconnect';
```

2. Update the fetch functions to use the actual Kite API:
```typescript
const kite = new KiteConnect({
  api_key: ZERODHA_API_KEY
});

// Set access token
kite.setAccessToken(accessToken);

// Fetch holdings
const holdings = await kite.getHoldings();
```

## Current Implementation

### Pages Created
- `/admin/portfolio/stocks` - Stocks dashboard
- `/admin/portfolio/mutual-funds` - Mutual funds dashboard

### Features
- ✅ Summary cards showing total holdings, value, and P&L
- ✅ Detailed tables with all stock/MF information
- ✅ Refresh button to reload data
- ✅ Responsive design
- ✅ Mock data for development/testing

### API Routes
- `/api/zerodha/stocks` - Fetch stocks data
- `/api/zerodha/mutual-funds` - Fetch mutual funds data

## Navigation

### Sidebar
- Portfolio (AI Categorized) now has sub-menu:
  - Overview
  - Stocks
  - Mutual Funds

### Portfolio Page
- Quick link cards at the top to navigate to Stocks and Mutual Funds pages

## Mock Data
Currently using mock data for:
- 3 sample stocks (RELIANCE, TCS, INFY)
- 2 sample mutual funds (HDFC Equity, SBI Bluechip)

## Next Steps
1. Implement OAuth flow for Zerodha authentication
2. Store access tokens securely (session/cookies)
3. Replace mock data with real API calls
4. Add error handling for API failures
5. Implement token refresh mechanism

