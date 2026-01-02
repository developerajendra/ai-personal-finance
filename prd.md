Project Title: Personal Finance AI - Next.js Dashboard and Admin Panel

1. Introduction

Objective: Develop a comprehensive personal finance management tool with a clear separation between data management (Admin Panel) and data visualization (Dashboard). The Admin Panel provides full CRUD operations for managing financial data, while the Dashboard offers read-only visualizations and insights.

Scope: The application will have two distinct sections:
- **Admin Panel**: Complete data management interface where users can upload, edit, delete, and format all financial data. All documents are converted to JSON format and displayed in data grids/tables for management.
- **Dashboard**: Read-only visualization interface where users can view financial insights, charts, and summaries. No data editing or management capabilities are available in the Dashboard.

Key Features:
- Upload financial documents (Excel, PDFs, images) and convert them into JSON format
- Upload images of passbooks and other financial documents for OCR-based data extraction
- Fetch financial data directly from Zerodha Kite API (stocks, mutual funds)
- Import Excel sheets from Google Drive
- Manage all financial data in Admin Panel with full edit/delete/format capabilities
- View aggregated financial information in Dashboard with visualizations only
- AI-powered financial chatbot with quick chart access (Gemini AI integration)
- Highly scalable and modular architecture for easy maintenance and feature expansion

Architecture Principles:
- **Modular Design**: Each feature is a self-contained module with clear interfaces
- **Scalability**: Built to handle growing data volumes and user base
- **Maintainability**: Well-documented, clean code structure with separation of concerns
- **Reusability**: Shared components and utilities across modules
- **Testability**: Each module can be tested independently


2. Architecture and Scalability

2.1. System Architecture Overview

**Modular Architecture Pattern:**
The application follows a modular, feature-based architecture where each major feature is encapsulated in its own module with clear boundaries and interfaces.

**Core Architecture Principles:**
1. **Feature Modules**: Each feature (File Upload, OCR, Kite Integration, Google Drive, Chatbot) is a separate module
2. **Shared Core**: Common utilities, types, and services are shared across modules
3. **API Layer**: Centralized API client with module-specific endpoints
4. **State Management**: Centralized state management with module-specific slices
5. **Component Library**: Reusable UI components in a shared component library
6. **Service Layer**: Business logic separated into service modules

**Module Structure:**
```
/src
  /modules
    /file-upload        # File upload module
    /ocr-processing     # OCR processing module
    /kite-integration    # Zerodha Kite module
    /google-drive        # Google Drive module
    /chatbot            # AI Chatbot module
    /dashboard          # Dashboard visualization module
    /admin-panel        # Admin Panel module
  /shared
    /components         # Shared UI components
    /utils              # Shared utilities
    /services           # Shared services
    /types              # TypeScript types/interfaces
    /hooks              # Shared React hooks
    /api                # API client and endpoints
  /core
    /state              # State management
    /config             # Configuration
    /constants          # Constants
```

**Scalability Considerations:**
- Horizontal scaling: Stateless API design allows multiple server instances
- Database optimization: Indexed queries, pagination, caching strategies
- Code splitting: Lazy loading of modules and components
- Caching: Multi-level caching (browser, API, database)
- Performance: Virtual scrolling, debouncing, memoization
- Monitoring: Logging, error tracking, performance metrics

2.2. Requirements

2.2.1. Frontend

Styling Framework:
- Use Tailwind CSS for all styling and UI components
- Ensure responsive design across all devices
- Maintain consistent design system using Tailwind utility classes

Sidebar:
- Main Menus: Dashboard, Admin
- Submenus: Each main menu will have specific submenus with appropriate links
- Navigation: Ensure keyboard accessibility and proper ARIA labels
- Styled using Tailwind CSS components

2.2.1.1. Dashboard - Read-Only Financial Data Visualization

**Important: Dashboard is VIEW-ONLY. All data management must be done in Admin Panel.**

- Visual Financial Overview:
  - Financial Summary Cards (Read-Only):
    - Total Income (all credits) - displayed as card with trend indicators
    - Total Expenses (all debits) - displayed as card with trend indicators
    - Net Balance - displayed prominently
    - Category-wise breakdown cards
    - Period-over-period comparisons (monthly, yearly)
  - Interactive Charts and Visualizations (Read-Only):
    - Pie charts for category distribution (expenses, income)
    - Bar charts for monthly income vs expenses
    - Line charts for balance trends over time
    - Area charts for category-wise spending trends
    - Heat maps for spending patterns by day/week
  - Transaction Overview (Read-Only Display):
    - Display all transactions with proper categorization (view-only table)
    - Show debit transactions (marked clearly with visual indicators)
    - Show credit transactions (marked clearly with visual indicators)
    - Color-coded transaction types (debit in red/orange, credit in green)
    - Filterable and sortable transaction table (for viewing only)
    - Transaction details displayed in read-only format:
      - Date, amount, description, category
      - Account/account number (if available)
      - Transaction type (debit/credit)
      - Balance after transaction
      - Source of data (Excel upload, Kite, Google Drive, OCR)
  - Data Quality Indicators (Read-Only):
    - Show data quality grades (complete, partial, needs review)
    - Display confidence scores for categorized transactions
    - Note: Users cannot edit data quality from Dashboard
  - Filters and Search (View-Only):
    - Filter by date range (for viewing only)
    - Filter by category (for viewing only)
    - Filter by transaction type (debit/credit) (for viewing only)
    - Filter by amount range (for viewing only)
    - Search by description or account number (for viewing only)
  - Export Options (Read-Only Data Export):
    - Export categorized data to Excel/CSV (export only, no editing)
    - Export summary reports
    - Print-friendly views
    - Generate PDF reports
  - Restrictions:
    - NO edit buttons or edit functionality
    - NO delete buttons or delete functionality
    - NO add new transaction buttons
    - NO data modification capabilities
    - All data changes must be done through Admin Panel
    - Clear messaging directing users to Admin Panel for data management

2.2.1.2. Quick Chart and AI Chatbot Integration

**Quick Chart Access:**
- Quick Chart Link in Dashboard:
  - Prominent "Quick Chart" link/button in the Dashboard section
  - Clicking the link opens a chart board with integrated chatbot
  - Chart board displays relevant financial charts based on current dashboard context

**Floating Chatbot Icon:**
- Global Floating Icon:
  - Fixed position floating icon in the bottom-right corner of the screen
  - Visible on all pages (Dashboard, Admin Panel, and all sub-pages)
  - Icon design: Chat/AI bot icon with subtle animation to indicate availability
  - Clicking the icon opens a child board/chat window

**Chatbot Child Board:**
- Board Controls:
  - **Minimize Button**: Minimizes the board to a small icon/bar (keeps it accessible)
  - **Close Button (X)**: Completely closes the chatbot board
  - **Full Screen Button**: Redirects to a dedicated full-screen chatbot page with enhanced features
- Board Features:
  - Chat interface with message history
  - Input field for user queries
  - Real-time response streaming
  - Context-aware responses based on financial data
  - Ability to display charts, tables, and structured data in responses

**Full-Screen Chatbot Page:**
- Dedicated Route: `/chatbot` or `/ai-assistant`
- Enhanced Features:
  - Larger chat interface
  - Advanced chart generation capabilities
  - Multiple conversation threads
  - Export conversation history
  - Settings and preferences
  - Enhanced data visualization options

**Gemini AI Integration:**
- API Configuration:
  - Gemini API token stored securely in environment variables
  - Token validation and error handling
  - Rate limiting and quota management
  - Fallback mechanisms for API failures
- Chatbot Capabilities:
  - Read and understand all financial data from different sources:
    - Excel uploads
    - OCR-extracted data
    - Zerodha Kite data
    - Google Drive imports
  - Context-Aware Responses:
    - Access to complete financial dataset
    - Understand transaction history, categories, trends
    - Answer questions about income, expenses, investments
    - Provide financial insights and recommendations
  - Data Presentation in Responses:
    - **Tables**: Format financial data in readable tables
    - **Charts**: Generate and display charts (bar, line, pie) within chat responses
    - **Structured Data**: Present data in organized, easy-to-read formats
    - **Markdown Support**: Rich text formatting for better readability
  - Prompt Engineering:
    - System prompts include financial data context
    - Data is formatted and included in prompts in readable format
    - Support for complex queries (e.g., "Show me expenses by category for last 3 months")
    - Natural language understanding for financial queries

**Chatbot Module Architecture:**
- Separate module: `/modules/chatbot`
- Components:
  - `ChatbotIcon.tsx` - Floating icon component
  - `ChatbotBoard.tsx` - Child board component
  - `ChatbotPage.tsx` - Full-screen page component
  - `ChatMessage.tsx` - Individual message component
  - `ChartRenderer.tsx` - Chart rendering in chat responses
  - `TableRenderer.tsx` - Table rendering in chat responses
- Services:
  - `geminiService.ts` - Gemini API integration
  - `dataContextService.ts` - Financial data context preparation
  - `chartService.ts` - Chart generation from data
- Hooks:
  - `useChatbot.ts` - Chatbot state management
  - `useFinancialContext.ts` - Financial data context hook

2.2.2. Admin Panel - Complete Data Management Interface

**Important: Admin Panel is the ONLY place where users can upload, edit, delete, and format financial data.**

2.2.2.1. Admin Panel Overview
- Data Management Grids/Tables:
  - Display all financial data in editable grid/table format (using libraries like AG Grid, TanStack Table, or similar)
  - Full CRUD operations (Create, Read, Update, Delete):
    - Add new transaction button/row
    - Inline editing for all fields (click cell to edit)
    - Delete button/action for each row
    - Bulk selection checkbox for multiple rows
    - Bulk delete and bulk edit operations
  - Inline editing capabilities for all data fields:
    - Date picker for date fields
    - Number input with validation for amount fields
    - Dropdown/select for category fields
    - Text input for description fields
    - Auto-save on field blur or manual save button
  - Data formatting options:
    - Date format selector (DD/MM/YYYY, MM/DD/YYYY, etc.)
    - Number format selector (currency, decimal places)
    - Currency symbol selector (₹, $, €, etc.)
    - Apply formatting to selected cells or entire columns
  - Grid features:
    - Column visibility toggle (show/hide columns)
    - Column sorting (ascending/descending)
    - Column resizing and reordering
    - Row selection (single or multiple)
    - Pagination for large datasets
    - Virtual scrolling for performance
  - Advanced filtering and search within grids:
    - Column-specific filters
    - Global search across all columns
    - Date range filters
    - Amount range filters
    - Category filters
    - Save filter presets
  - Data validation:
    - Real-time validation on edit
    - Error highlighting for invalid data
    - Required field indicators
    - Data type validation (dates, numbers, etc.)
  - Grid actions toolbar:
    - Add new transaction
    - Delete selected rows
    - Export to Excel/CSV
    - Import from file
    - Refresh data
    - Format selected cells
- Data Source Management:
  - View all data sources (Excel uploads, Kite, Google Drive, OCR)
  - Manage data source connections
  - Refresh data from external sources
  - Delete data sources and associated data
- Transaction Management:
  - Add new transactions manually
  - Edit existing transactions (all fields editable)
  - Delete transactions (single or bulk)
  - Re-categorize transactions
  - Update transaction amounts, dates, descriptions
  - Format transaction data (currency, date formats)
- Category Management:
  - Create, edit, and delete categories
  - Assign categories to transactions
  - Manage category hierarchies
  - Import/export category definitions

Data Source Options:

2.2.2.2. File Upload Feature (Module)
- Ability to upload Excel sheets, PDFs, and other financial documents
- Support for drag-and-drop file uploads
- File validation and error handling
- Excel Sheet Processing and Financial Data Management:
  - Intelligent column detection and mapping:
    - Auto-detect date columns, amount columns, description columns
    - Identify debit/credit columns or transaction type indicators
    - Map account numbers, transaction IDs, and reference numbers
  - Financial data extraction and categorization:
    - Extract and classify all transactions (debit, credit, transfers)
    - Categorize transactions by type:
      - Income (salary, interest, dividends, refunds)
      - Expenses (food, utilities, shopping, entertainment, bills)
      - Investments (stocks, mutual funds, fixed deposits)
      - Loans and EMIs
      - Transfers (bank transfers, UPI, NEFT, RTGS)
      - Subscriptions and recurring payments
    - Identify and extract balance information
    - Parse transaction descriptions for better categorization
  - Data validation and quality checks:
    - Verify date formats and ranges
    - Validate amount formats and currencies
    - Check for duplicate transactions
    - Identify missing or incomplete data
  - Financial data grading and organization:
    - Grade data quality (complete, partial, needs review)
    - Organize transactions chronologically
    - Group transactions by category, month, or account
    - Calculate totals for debits, credits, and balances
    - Generate summary statistics (total income, total expenses, net balance)
- Processing: On clicking the 'Process' button, the backend will:
  1. Parse Excel file structure
  2. Extract and categorize all financial data
  3. Validate and grade data quality
  4. Convert to structured JSON format with proper categorization
  5. Display categorized results in Admin Panel grid for user review and editing
- Post-Processing Data Management (in Admin Panel):
  - Display processed data in editable grid/table format
  - Allow users to edit, delete, or format any transaction
  - Enable bulk operations (select multiple rows for edit/delete)
  - Provide data validation and error correction tools
  - Save changes to database (updates JSON data)
  - All changes reflect immediately in Dashboard visualizations

2.2.2.3. Image Upload and OCR Processing (Module)
- Dedicated image upload feature for passbooks and financial documents
- Support for common image formats (JPG, JPEG, PNG, WebP, HEIC)
- Batch upload support for multiple images
- Image preprocessing capabilities:
  - Auto-rotation correction
  - Brightness and contrast adjustment
  - Noise reduction
  - Image quality validation
- OCR (Optical Character Recognition) processing:
  - Extract text and numerical data from passbook images
  - Identify transaction details (date, amount, description, balance)
  - Parse account statements and financial documents
  - Support for multiple languages (English, Hindi, regional languages)
- Data extraction and parsing:
  - Automatically identify transaction patterns
  - Extract account numbers, transaction dates, amounts
  - Categorize transactions (debit, credit, transfers)
  - Extract balance information
- Manual review and correction interface (in Admin Panel):
  - Display extracted text for user verification in editable grid
  - Allow users to correct OCR errors directly in the grid
  - Highlight uncertain extractions for review
  - Edit, delete, or format extracted transaction data
  - Save corrections to update JSON data
- Processing: On clicking the 'Process' button, images are analyzed using OCR and converted into structured JSON format
- Post-Processing Data Management (in Admin Panel):
  - Display OCR-extracted data in editable grid/table format
  - Allow users to edit, delete, or format any extracted transaction
  - Enable corrections for OCR errors
  - Save changes to database (updates JSON data)
  - All changes reflect immediately in Dashboard visualizations

2.2.2.4. Zerodha Kite Integration (Module)
- Option to connect Zerodha Kite account via API
- Fetch real-time and historical financial data including:
  - Stock holdings and portfolio
  - Mutual fund investments
  - Transaction history
  - Current market values
- Secure API key and access token management
- OAuth flow for Kite Connect authentication
- Data synchronization options (manual refresh, scheduled sync)
- Post-Processing Data Management (in Admin Panel):
  - Display Kite data in editable grid/table format
  - Allow users to edit, delete, or format fetched transactions
  - Enable manual corrections if needed
  - Save changes to database (updates JSON data)
  - All changes reflect immediately in Dashboard visualizations

2.2.2.5. Google Drive Excel Integration (Module)
- Option to add Excel sheet links from Google Drive
- Support for Google Drive sharing links (view/edit permissions)
- Google OAuth integration for accessing private sheets
- Parse and extract data from Excel files stored in Google Drive
- Support for multiple Excel files from different Google Drive locations
- Automatic data refresh from Google Drive sheets
- Handle various Excel formats (.xlsx, .xls, .csv)
- Post-Processing Data Management (in Admin Panel):
  - Display Google Drive Excel data in editable grid/table format
  - Allow users to edit, delete, or format imported transactions
  - Enable manual corrections and data formatting
  - Save changes to database (updates JSON data)
  - All changes reflect immediately in Dashboard visualizations

2.2.3. Backend Architecture

2.2.3.1. Modular Backend Structure

Node Server: Integrated within the Next.js application for processing uploads and API integrations.

Data Processing:
- Convert uploaded documents into JSON format
- Process images using OCR to extract financial data from passbooks and statements
- Parse Excel files from Google Drive using Google Sheets API
- Integrate with Zerodha Kite API for financial data retrieval
- Excel File Processing:
  - Intelligent parsing of Excel structure (detect headers, data rows, multiple sheets)
  - Financial data extraction and categorization:
    - Identify debit and credit transactions
    - Categorize transactions automatically using pattern matching and AI
    - Extract dates, amounts, descriptions, account information
    - Calculate running balances
  - Data validation and quality assessment:
    - Validate data completeness
    - Check for data inconsistencies
    - Grade data quality (A: complete and accurate, B: mostly complete, C: needs review)
  - Transaction management:
    - Deduplicate transactions
    - Merge similar transactions
    - Flag suspicious or unusual transactions
- Normalize data from different sources into a unified format:
  - Standardize date formats
  - Normalize currency and amount formats
  - Unify transaction categories across all sources
  - Create consistent data structure for all financial data
- Send processed data to the frontend with proper categorization and metadata

API Integrations:
- Zerodha Kite Connect API for stocks and mutual funds
- Google Drive API for Excel sheet access
- Google Sheets API for data parsing
- OCR API services (Tesseract.js, Google Cloud Vision API, or AWS Textract)
- Google Gemini API for AI chatbot functionality

2.2.3.2. Backend Module Structure
```
/api
  /modules
    /file-upload        # File upload API routes
    /ocr                # OCR processing API routes
    /kite               # Kite integration API routes
    /google-drive       # Google Drive API routes
    /chatbot            # Chatbot API routes (Gemini integration)
    /transactions       # Transaction CRUD API routes
    /categories         # Category management API routes
  /shared
    /middleware         # Shared middleware (auth, validation, etc.)
    /utils              # Shared utilities
    /services           # Shared services
    /types              # TypeScript types
  /core
    /config             # Configuration
    /database           # Database connection and models
    /cache              # Caching layer
```

2.2.3.3. Chatbot API Endpoints
- `POST /api/chatbot/message` - Send message to Gemini AI
- `GET /api/chatbot/context` - Get financial data context for chatbot
- `POST /api/chatbot/generate-chart` - Generate chart from financial data
- `GET /api/chatbot/history` - Get conversation history
- `POST /api/chatbot/export` - Export conversation

3. User Stories

As a user, I want to navigate easily between the Dashboard and Admin panels.

As an admin, I want to upload financial documents in the Admin Panel and have them converted into JSON format for storage and visualization.

As an admin, I want to view and manage all my financial data in editable grids/tables within the Admin Panel, where I can edit, delete, and format transactions.

As a user, I want to view financial visualizations and insights in the Dashboard without the ability to edit or modify data, ensuring data integrity.

As an admin, I want to upload Excel sheets in the Admin Panel and have the system automatically categorize all financial transactions (debits, credits) with proper organization, then display them in editable grids.

As an admin, I want to see all my financial data properly graded and categorized in the Admin Panel grids, where I can edit, delete, or format any transaction.

As an admin, I want to edit transaction details (amount, date, description, category) directly in the Admin Panel grid interface.

As an admin, I want to delete transactions (single or bulk) from the Admin Panel when needed.

As an admin, I want to format financial data (currency formats, date formats) in the Admin Panel to ensure consistency.

As a user, I want to view all my debit and credit transactions clearly separated and organized by categories on the Dashboard in a read-only format.

As a user, I want to see financial summaries showing total income, total expenses, and net balance from my uploaded Excel sheets in the Dashboard visualizations.

As an admin, I want to review and correct transaction categorizations in the Admin Panel if the system misclassifies any transactions, with changes reflecting in the Dashboard.

As an admin, I want to upload images of my passbook or bank statements and have the system automatically extract transaction data using OCR.

As an admin, I want to review and correct any OCR errors before the data is saved to ensure accuracy.

As an admin, I want to upload multiple passbook images at once and have them all processed automatically.

As an admin, I want to connect my Zerodha Kite account to automatically fetch my stock and mutual fund holdings.

As an admin, I want to link Excel sheets from Google Drive and have the system automatically parse and import the data.

As a user, I want to see all my financial data (from uploads, image OCR, Kite, and Google Drive) aggregated and visualized on the Dashboard in read-only format.

As a user, I want to see real-time updates of my portfolio value from Kite integration in the Dashboard visualizations.

As a user, I want the Dashboard to automatically refresh data from Google Drive sheets periodically and display updated visualizations.

As an admin, I want to manage all data sources and their data exclusively in the Admin Panel, with all changes automatically reflected in the Dashboard.

As a user, I want to access a quick chart feature from the Dashboard that opens a chart board with an integrated AI chatbot.

As a user, I want to click a floating chatbot icon to get instant AI-powered financial insights and answers about my financial data.

As a user, I want the AI chatbot to understand all my financial data from different sources and provide context-aware responses with charts and tables.

As a user, I want to minimize, close, or expand the chatbot board to full screen based on my needs.

As a user, I want the AI chatbot to present financial data in readable formats including tables, charts, and structured data.

3. Technical Specifications

Frontend:
- Next.js (App Router recommended) with modular routing
- React with TypeScript for type safety
- Tailwind CSS for styling
- UI component library compatible with Tailwind (e.g., shadcn/ui, Headless UI)
- State Management:
  - Zustand or Redux Toolkit for global state
  - React Query/TanStack Query for server state
- Data Grid/Table library for Admin Panel (choose one):
  - AG Grid (comprehensive, feature-rich)
  - TanStack Table (flexible, headless)
  - Material-UI DataGrid (if using MUI)
  - React Table (lightweight option)
- Chart/Visualization library for Dashboard:
  - Recharts (React-friendly)
  - Chart.js with react-chartjs-2
  - Victory (flexible)
  - D3.js (for advanced custom visualizations)
- AI Chatbot:
  - @google/generative-ai (Gemini SDK)
  - React Markdown for formatted responses
  - React Flow or similar for complex visualizations in chat
- Module System:
  - Feature-based folder structure
  - Barrel exports for clean imports
  - Lazy loading with React.lazy() and Suspense

Backend:
- Node.js integrated within the Next.js application
- Next.js API routes organized by modules
- Modular API structure with clear separation of concerns
- API versioning support for future scalability
- Request validation using Zod or similar
- Error handling middleware
- Logging and monitoring (Winston, Pino, or similar)

Data Processing Libraries:
- xlsx or exceljs for Excel file parsing
- Financial data processing:
  - date-fns or moment.js for date parsing and validation
  - Custom categorization engine for transaction classification
  - Pattern matching libraries for transaction description analysis
- pdf-parse or pdf-lib for PDF processing
- OCR Libraries (choose one or multiple):
  - Tesseract.js for client-side/basic OCR
  - Google Cloud Vision API for advanced OCR with better accuracy
  - AWS Textract for document analysis and form extraction
  - Azure Computer Vision API as alternative
- Image processing libraries:
  - sharp or jimp for image preprocessing (rotation, enhancement, format conversion)
  - canvas for image manipulation
- @zerodhatech/kiteconnect for Zerodha Kite API integration
- googleapis for Google Drive and Sheets API integration
- @google/generative-ai for Gemini AI chatbot integration
- markdown-to-jsx or react-markdown for rendering formatted chatbot responses

Authentication & Security:
- Secure storage of API keys and tokens (environment variables)
- OAuth 2.0 for Zerodha Kite Connect
- OAuth 2.0 for Google Drive/Sheets access
- Encrypted storage of sensitive credentials

Data Storage:
- Database to store processed financial data with:
  - Transaction records (date, amount, description, category, type) - stored as JSON format
  - Category definitions and user custom categories
  - Data quality grades and metadata
  - Source attribution for each transaction
  - Edit history and audit logs for data changes
  - Chatbot conversation history
  - User preferences and settings
- Database Options:
  - PostgreSQL or MongoDB for production
  - SQLite for development
  - Database migrations and versioning
  - Connection pooling for scalability
- Cache for API responses to reduce rate limiting:
  - Redis for server-side caching
  - Browser cache for static assets
  - API response caching with TTL
- Store user preferences and data source configurations
- Store categorization rules and patterns for learning
- Real-time data synchronization between Admin Panel and Dashboard
- Chatbot context storage for conversation continuity

4. Module Specifications

4.1. File Upload Module
- **Location**: `/modules/file-upload`
- **Components**: UploadForm, FilePreview, ProcessingStatus
- **Services**: FileValidationService, ExcelParserService, DataConverterService
- **API**: `/api/modules/file-upload`
- **State**: File upload state, processing status

4.2. OCR Processing Module
- **Location**: `/modules/ocr-processing`
- **Components**: ImageUpload, OCRPreview, CorrectionInterface
- **Services**: OCRService, ImagePreprocessingService, DataExtractionService
- **API**: `/api/modules/ocr`
- **State**: OCR processing state, extracted data

4.3. Kite Integration Module
- **Location**: `/modules/kite-integration`
- **Components**: KiteConnect, PortfolioView, SyncStatus
- **Services**: KiteAPIService, DataSyncService, TokenManagerService
- **API**: `/api/modules/kite`
- **State**: Kite connection state, portfolio data

4.4. Google Drive Module
- **Location**: `/modules/google-drive`
- **Components**: DriveLinkInput, FileSelector, SyncSettings
- **Services**: GoogleDriveService, SheetsParserService
- **API**: `/api/modules/google-drive`
- **State**: Drive connection state, imported data

4.5. Chatbot Module
- **Location**: `/modules/chatbot`
- **Components**: 
  - ChatbotIcon (floating icon)
  - ChatbotBoard (child board with minimize/close/fullscreen)
  - ChatbotPage (full-screen page)
  - ChatMessage, ChartRenderer, TableRenderer
- **Services**: 
  - GeminiService (API integration)
  - DataContextService (financial data context)
  - ChartService (chart generation)
  - ConversationService (history management)
- **API**: `/api/modules/chatbot`
- **State**: Chat state, conversation history, context data

4.6. Dashboard Module
- **Location**: `/modules/dashboard`
- **Components**: SummaryCards, Charts, TransactionTable, QuickChartLink
- **Services**: DataAggregationService, VisualizationService
- **API**: `/api/modules/dashboard`
- **State**: Dashboard data, filters, view preferences

4.7. Admin Panel Module
- **Location**: `/modules/admin-panel`
- **Components**: DataGrid, CategoryManager, SourceManager
- **Services**: CRUDService, ValidationService, FormatService
- **API**: `/api/modules/admin-panel`
- **State**: Grid data, edit state, bulk operations

5. Architecture and Data Flow

5.1. Application Architecture Overview

**Two-Tier Architecture:**
1. **Admin Panel (Data Management Layer)**
   - All data uploads, processing, and conversion to JSON
   - Full CRUD operations (Create, Read, Update, Delete)
   - Data displayed in editable grids/tables
   - Data formatting and validation
   - Category management
   - Source management (Kite, Google Drive, etc.)

2. **Dashboard (Visualization Layer)**
   - Read-only data visualization
   - Charts, graphs, and summary cards
   - Filtering and search (view-only)
   - Export capabilities (export only, no editing)
   - Real-time updates from Admin Panel changes

**Data Flow:**
- All data enters through Admin Panel → Converted to JSON → Stored in Database
- Admin Panel changes → Update Database → Dashboard automatically reflects changes
- Dashboard reads from Database → Displays visualizations (no write operations)

5.2. Zerodha Kite Integration Flow
1. User clicks "Connect Kite" in Admin Panel
2. Redirect to Kite Connect OAuth page
3. User authorizes application
4. Receive access token and store securely
5. Fetch holdings, mutual funds, and portfolio data
6. Process and normalize data
7. Store in database and display on dashboard

5.3. Google Drive Excel Integration Flow
1. User provides Google Drive Excel sheet link
2. Authenticate with Google OAuth (if private sheet)
3. Extract file ID from Google Drive link
4. Use Google Sheets API to read Excel data
5. Parse and convert to JSON format
6. Store in database and display on dashboard
7. Schedule periodic refresh (optional)

5.4. File Upload Flow (Excel Sheets)
1. User uploads Excel file via Admin Panel
2. File validation and storage
3. Excel file processing:
   a. Detect file structure (headers, data rows, multiple sheets)
   b. Auto-detect column types (date, amount, description, debit/credit)
   c. Map columns to standard financial data fields
4. Financial data extraction:
   a. Extract all transactions (rows)
   b. Identify debit and credit transactions
   c. Parse dates, amounts, descriptions
   d. Extract account information if available
5. Data categorization:
   a. Categorize each transaction automatically
   b. Apply pattern matching for common transaction types
   c. Use AI/ML models for intelligent categorization (if available)
   d. Calculate running balances
6. Data validation and grading:
   a. Validate data completeness and accuracy
   b. Assign quality grades (A, B, C)
   c. Flag transactions needing review
   d. Check for duplicates
7. Generate summary statistics:
   a. Calculate total debits
   b. Calculate total credits
   c. Calculate net balance
   d. Category-wise totals
8. Present categorized data in Admin Panel for review and management:
   a. Display transaction list with categories in editable grid/table
   b. Show summary cards (income, expenses, balance) in Admin Panel
   c. Highlight transactions needing review
   d. Allow user to edit, delete, or format transactions directly in grid
   e. Enable bulk operations (select multiple rows)
9. Convert to structured JSON format with metadata
10. Store in database with categorization and grades
11. Admin Panel displays data in editable grid with full CRUD capabilities
12. Dashboard automatically displays visualizations:
    a. Show categorized transactions (read-only)
    b. Display debit/credit breakdown in charts
    c. Show financial summaries in cards
    d. Provide filters and search functionality (view-only)

5.5. Image Upload and OCR Processing Flow

5.6. Chatbot Interaction Flow
1. User clicks floating chatbot icon (bottom-right corner)
2. Chatbot child board opens with minimize/close/fullscreen controls
3. User enters query about financial data
4. System prepares financial data context:
   a. Fetch all relevant financial data (transactions, categories, summaries)
   b. Format data in readable structure (tables, JSON)
   c. Include data in system prompt for Gemini
5. Send query with context to Gemini API
6. Receive response from Gemini
7. Parse response for:
   a. Text content
   b. Chart generation requests
   c. Table data
   d. Structured data
8. Render response in chat interface:
   a. Display text with markdown formatting
   b. Generate and display charts if requested
   c. Render tables if data tables are in response
   d. Format structured data appropriately
9. User can:
   a. Continue conversation
   b. Click minimize to minimize board
   c. Click close to close board
   d. Click fullscreen to go to dedicated chatbot page
10. Full-screen chatbot page provides enhanced features:
    a. Larger interface
    b. Multiple conversation threads
    c. Export conversation
    d. Advanced chart options
1. User uploads passbook or financial document images via Admin Panel
2. Image validation (format, size, quality check)
3. Image preprocessing:
   - Auto-rotate if needed
   - Enhance image quality (brightness, contrast)
   - Convert to optimal format for OCR
4. OCR processing:
   - Extract text and numerical data from images
   - Identify financial data patterns (dates, amounts, transactions)
   - Parse structured data (account numbers, balances, transaction details)
5. Data extraction and structuring:
   - Identify transaction entries
   - Extract date, amount, description, balance
   - Categorize transaction types
6. Present extracted data in Admin Panel for review and management:
   - Display raw OCR text in editable grid
   - Show structured transaction data in table format
   - Highlight uncertain extractions
   - Allow inline editing of extracted data
7. User reviews and corrects any errors in Admin Panel grid:
   - Edit transaction details directly in grid
   - Delete incorrect extractions
   - Format data as needed
   - Save corrections
8. Convert to JSON format
9. Store in database
10. Admin Panel displays data in editable grid with full management capabilities
11. Dashboard automatically displays visualizations with source attribution (image upload)

6. Scalability and Performance Requirements

6.1. Performance Targets
- Page load time: < 2 seconds
- API response time: < 500ms for standard queries
- Chart rendering: < 1 second for standard datasets
- Chatbot response time: < 3 seconds (including Gemini API call)
- Database query optimization: Indexed queries, pagination
- Image processing: Background jobs for large files

6.2. Scalability Measures
- Code splitting: Lazy load modules and routes
- Virtual scrolling: For large data grids and lists
- Caching strategy: Multi-level caching (browser, API, database)
- Database optimization: Connection pooling, query optimization
- API rate limiting: Prevent abuse and ensure fair usage
- Background processing: Queue system for heavy operations (OCR, large file processing)

6.3. Monitoring and Observability
- Error tracking: Sentry or similar
- Performance monitoring: Web Vitals, API response times
- Usage analytics: Feature usage, user behavior
- Logging: Structured logging for debugging
- Alerts: Critical error notifications

7. Acceptance Criteria

The sidebar should be fully functional and accessible, styled with Tailwind CSS, with clear separation between Dashboard and Admin Panel.

Document upload and processing should work seamlessly in the Admin Panel, converting files into JSON format and displaying them in editable grids.

Admin Panel should provide full CRUD operations (Create, Read, Update, Delete) for all financial data in grid/table format.

Users should be able to edit, delete, and format all financial data exclusively within the Admin Panel.

Dashboard should be completely read-only with no edit, delete, or data modification capabilities.

Excel sheet upload in Admin Panel should automatically detect and categorize all financial transactions (debits and credits) with proper organization, then display in editable grids.

Financial data from Excel sheets should be displayed in Admin Panel grids with full edit/delete/format capabilities, and shown in Dashboard with clear separation between debit and credit transactions.

All transactions should be properly categorized and displayed in Admin Panel grids with edit capabilities, and displayed in Dashboard with appropriate visual indicators (colors, icons) in read-only format.

Users should be able to view financial summaries (total income, total expenses, net balance) from uploaded Excel sheets in the Dashboard visualizations.

Data quality grades should be clearly visible in Admin Panel, and users should be able to review and correct categorizations directly in the grid interface.

All data changes made in Admin Panel should immediately reflect in Dashboard visualizations without requiring page refresh.

Image upload and OCR processing should accurately extract financial data from passbook images and other financial documents.

OCR accuracy should be high enough to minimize manual corrections, with clear indicators for uncertain extractions.

Users should be able to review and correct OCR-extracted data before final processing.

Zerodha Kite integration should successfully authenticate and fetch stocks and mutual fund data.

Google Drive Excel integration should parse and import data from shared Excel sheets.

The Dashboard should display all financial data from multiple sources (file uploads, image OCR, Kite, Google Drive) in a unified view with proper categorization in read-only format.

All financial transactions should be properly categorized and organized in Dashboard, showing debits and credits clearly in visualizations only (no editing).

Financial summaries (income, expenses, balance) should be prominently displayed in Dashboard and updated in real-time as data changes in Admin Panel.

All data sources should be clearly labeled and distinguishable in both Admin Panel and Dashboard.

Users should be able to filter and search transactions in Dashboard by category, type (debit/credit), date range, and amount for viewing purposes only.

Admin Panel should display all data in editable grid/table format with inline editing, bulk operations, and formatting capabilities.

Clear visual distinction and messaging should indicate that Dashboard is view-only and Admin Panel is for data management.

The application should handle errors gracefully (API failures, invalid links, authentication errors).

Data refresh mechanisms should work correctly for both Kite and Google Drive sources.

The UI should be fully responsive and styled using Tailwind CSS.

The application should follow modular architecture with clear separation of concerns.

Each feature module should be independently testable and maintainable.

The floating chatbot icon should be visible on all pages and functional.

The chatbot child board should have working minimize, close, and fullscreen controls.

The AI chatbot should successfully integrate with Gemini API using provided token.

The chatbot should be able to read and understand all financial data from different sources.

The chatbot should present responses with charts, tables, and structured data when appropriate.

The quick chart link in Dashboard should open chart board with integrated chatbot.

8. Security Considerations

- All API keys and tokens must be stored securely (environment variables, encrypted)
- OAuth tokens should be refreshed automatically before expiration
- User data should be encrypted at rest
- Implement rate limiting for API calls
- Validate and sanitize all user inputs
- Secure file upload handling (size limits, type validation)
- Image upload security (virus scanning, malicious content detection)
- OCR processing should not store or log sensitive financial data unnecessarily
- Implement data retention policies for uploaded images
- Gemini API token must be stored securely (environment variables, never in client code)
- Chatbot conversations should be encrypted at rest
- Rate limiting on chatbot API to prevent abuse
- Input sanitization for chatbot queries to prevent injection attacks

9. Future Enhancements (Optional)

- Support for additional trading platforms (Groww, Upstox, etc.)
- Advanced OCR with machine learning models trained on financial documents
- Enhanced AI-powered transaction categorization with learning capabilities
- Machine learning models that learn from user corrections to improve categorization accuracy
- Duplicate transaction detection across different data sources
- Automatic transaction tagging and smart categorization suggestions
- Budget tracking and spending alerts based on categorized transactions
- Financial insights and recommendations
- Export functionality for processed data
- Multi-user support with role-based access
- Data backup and restore functionality
- Support for video uploads of passbook scrolling (frame extraction and OCR)
- Integration with bank APIs for direct data fetching (where available)