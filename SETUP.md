# Setup Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   The `.env.local` file is already created with the Gemini API key. Make sure it contains:
   ```
   AI_CHAT_API_KEY=YOUR_AI_API_KEY
   GEMINI_MODEL=gemini-2.0-flash-exp
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/modules` - Feature modules (chatbot, dashboard, admin-panel, etc.)
- `/shared` - Shared components, utilities, and hooks
- `/core` - Core types, services, and configuration
- `/public` - Static assets
- `/uploads` - Uploaded files storage
- `/data` - Database files

## Features Implemented

✅ Next.js 14 with App Router
✅ TypeScript configuration
✅ Tailwind CSS styling
✅ Modular architecture
✅ Dashboard with visualizations
✅ Admin Panel with data management
✅ File upload (Excel support)
✅ AI Chatbot with Gemini integration
✅ Floating chatbot icon
✅ Quick chart feature
✅ Responsive design

## Next Steps

1. **Database Integration**: Replace mock data with a real database (PostgreSQL, MongoDB, or SQLite)
2. **OCR Processing**: Implement OCR for image uploads
3. **Zerodha Kite Integration**: Add Kite API integration
4. **Google Drive Integration**: Add Google Drive API integration
5. **Enhanced Excel Parsing**: Improve column detection and data extraction
6. **Authentication**: Add user authentication if needed
7. **Data Persistence**: Implement proper data storage and retrieval

## Troubleshooting

- If you see "Module not found" errors, make sure all dependencies are installed
- If the chatbot doesn't work, verify the Gemini API key in `.env.local`
- If charts don't render, check that Recharts is properly installed
- For TypeScript errors, run `npm run type-check`

