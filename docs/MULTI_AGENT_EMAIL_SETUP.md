# Multi-Agent Email Portfolio Management Setup Guide

## Overview

The Multi-Agent Email Portfolio Management system allows users to create investments by sending emails to their Gmail account. The Portfolio Management Agent automatically monitors Gmail, extracts investment information using AI, and creates draft investments for review.

## Architecture

- **Portfolio Management Agent**: Monitors Gmail and processes investment emails
- **Main Orchestrator Agent**: Coordinates all agents and aggregates reports
- **Gmail Service**: Handles OAuth authentication and email fetching
- **Email Parser Service**: Uses AI to extract investment data from emails

## Setup Instructions

### 1. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/gmail/callback` (or your production URL)
5. Copy the Client ID and Client Secret

### 2. Environment Variables

Add to your `.env.local` file:

```bash
# Gmail OAuth Configuration
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Portfolio Agent Configuration
PORTFOLIO_AGENT_ENABLED=true
PORTFOLIO_AGENT_INTERVAL=300000  # 5 minutes in milliseconds
```

### 3. Initialize Agents

Agents are initialized automatically when the server starts. You can also manually initialize them:

```bash
POST /api/agents/init
```

### 4. Connect Gmail

1. Navigate to Admin Panel → Portfolio
2. Click "Connect Gmail" button
3. Authorize the application to access Gmail (read-only)
4. You'll be redirected back with a success message

## Usage

### Creating Investments via Email

Send an email to your Gmail account with investment information. The agent supports both natural language and structured formats:

**Natural Language Examples:**
- "I invested 50000 in HDFC FD at 7% interest, started today"
- "Added 1 lakh to my PPF account"
- "Bought 100 shares of Reliance at 2500"

**Structured Format:**
```
Name: HDFC Fixed Deposit
Amount: 50000
Type: FD
Interest Rate: 7%
Start Date: 2026-01-15
Maturity Date: 2027-01-15
```

### How It Works

1. **Email Monitoring**: Agent checks Gmail every 5 minutes (configurable)
2. **AI Detection**: Uses AI to detect if email contains investment information
3. **Data Extraction**: Extracts structured investment data from email
4. **Draft Creation**: Creates draft investment automatically
5. **Review**: User reviews and publishes draft in Admin Panel

### Viewing Email Investments

- Navigate to Admin Panel → Portfolio
- View "Investments from Email" section
- All email-created investments are saved as drafts
- Review and publish when ready

## API Endpoints

### Gmail OAuth
- `GET /api/gmail/auth` - Get Gmail OAuth URL
- `GET /api/gmail/callback` - OAuth callback handler
- `GET /api/gmail/status` - Check Gmail connection status
- `POST /api/gmail/disconnect` - Disconnect Gmail

### Agent Management
- `POST /api/agents/init` - Initialize all agents
- `POST /api/agents/email/process` - Manually trigger email processing
- `GET /api/agents/email/process` - Get agent status

## Features

- **Automatic Email Monitoring**: Checks Gmail at configurable intervals
- **AI-Powered Extraction**: Understands natural language and structured formats
- **Duplicate Prevention**: Tracks processed emails to avoid duplicates
- **Draft Mode**: All email investments created as drafts for review
- **Error Handling**: Robust error handling with retry logic
- **Token Management**: Automatic token refresh for Gmail API

## Troubleshooting

### Gmail Not Connecting
- Verify OAuth credentials in `.env.local`
- Check redirect URI matches Google Cloud Console
- Ensure Gmail API is enabled

### Emails Not Being Processed
- Check agent status: `GET /api/agents/email/process`
- Verify Gmail is connected: `GET /api/gmail/status`
- Check server logs for errors
- Ensure agent is enabled: `PORTFOLIO_AGENT_ENABLED=true`

### Investments Not Created
- Check email content - must contain investment information
- Verify AI extraction confidence (should be > 0.3)
- Check server logs for extraction errors
- Ensure investment data is valid (name, amount required)

## Security Considerations

- OAuth tokens stored securely (httpOnly cookies + encrypted file)
- Gmail API uses read-only scope
- All investments created as drafts (requires manual review)
- Token refresh handled automatically
- Processed emails tracked to prevent duplicates

## Configuration Options

- `PORTFOLIO_AGENT_ENABLED`: Enable/disable agent (default: true)
- `PORTFOLIO_AGENT_INTERVAL`: Email check interval in milliseconds (default: 300000 = 5 minutes)

## Next Steps

- Add email filtering (subject line, labels)
- Support for multiple email accounts
- Email notifications for created investments
- Investment update via email
- Integration with Stock and Mutual Fund analyzers

