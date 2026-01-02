# Personal Finance AI

A comprehensive personal finance management tool with AI-powered insights, built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Admin Panel**: Complete data management with CRUD operations
- **Dashboard**: Read-only visualizations and insights
- **File Upload**: Excel, PDF, and image uploads with automatic processing
- **OCR Processing**: Extract data from passbook images
- **Zerodha Kite Integration**: Fetch stock and mutual fund data
- **Google Drive Integration**: Import Excel sheets from Google Drive
- **AI Chatbot**: Gemini AI-powered financial assistant with quick chart access

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/                    # Next.js App Router
├── modules/                # Feature modules
│   ├── file-upload/
│   ├── ocr-processing/
│   ├── kite-integration/
│   ├── google-drive/
│   ├── chatbot/
│   ├── dashboard/
│   └── admin-panel/
├── shared/                 # Shared components and utilities
│   ├── components/
│   ├── utils/
│   ├── services/
│   └── hooks/
├── core/                   # Core functionality
│   ├── state/
│   ├── config/
│   └── constants/
└── public/                 # Static assets
```

## Architecture

The application follows a modular, feature-based architecture where each major feature is encapsulated in its own module with clear boundaries and interfaces.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Charts**: Recharts
- **AI**: Google Gemini API
- **Data Grid**: Custom implementation with TanStack Table

## License

MIT

