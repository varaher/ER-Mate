# ErMate - Emergency Room EMR Application

## Overview
ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application developed by Varah Group, designed to optimize the workflow for emergency medicine professionals. It supports patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. Key features include voice dictation, AI-powered diagnostics, comprehensive documentation export, and an integrated "Learn" section for medical education. The application operates on a subscription-based model, aiming to enhance efficiency and accuracy in emergency care.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is built with React Native (Expo SDK 54, React 19.1.0 with React Compiler experimental) and TypeScript. Navigation is managed through `RootStackNavigator` and `MainTabNavigator`. State management utilizes `AuthContext`, `CaseContext`, and TanStack React Query. UI/UX features themed components, automatic dark/light mode, medical-specific color schemes, and enhanced navigation with Reanimated. Clinical workflows follow sequential modal flows for Triage, Adult Case Sheets (ATLS-based), Pediatric Case Sheets (PALS-based for ≤16 years), and Discharge Summaries, with age-based routing.

### Backend Architecture
An Express.js server in TypeScript acts as a proxy, directing all core API calls to an external backend at `https://er-emr-backend.onrender.com/api`.

### Data Storage
Drizzle ORM with PostgreSQL is used for `users` and `ai_feedback` tables, with Zod validation. Local storage uses AsyncStorage for user tokens and session data.

### Authentication
Supports email/password, Google Sign-In, and Apple Sign-In. A `warmUpBackend()` function prevents cold start issues on the external backend. API calls are wrapped with `fetchWithTimeout`, and login/register attempts include a retry mechanism.

### Key Features
- **Voice Input System**: Uses `expo-audio` for recording, Sarvam AI for speech-to-text (with OpenAI Whisper as fallback), and OpenAI for clinical data extraction to auto-populate case sheet fields. This includes "Smart Dictation" for comprehensive history capture and field-specific dictation.
- **Document Scanning System**: Captures documents via camera or image picker, uses Sarvam Vision API for OCR, and OpenAI for clinical data structuring.
- **AI Diagnosis System**: Generates differential diagnoses with confidence levels, medical guideline citations, and includes a self-learning feedback system. It integrates medical literature search (PubMed, WikEM) to provide evidence-based diagnoses.
- **Document Export System**: Exports Case Sheets and Discharge Summaries in PDF and DOCX formats.
- **Device Linking**: Secure WhatsApp-style web linking for web application access via expiring link codes.
- **Quick Case Sheet**: Allows direct entry into a case sheet, bypassing triage, with minimal patient information.
- **Editable Vitals**: Displayed on the Patient tab of case sheets, with age-based normal ranges and color-coding for pediatric patients.
- **Psychological Assessment**: Integrated into case sheets, flagging relevant conditions.
- **Learn Section**: Includes "Simulation-Based Teaching" (interactive clinical case simulations), "EM Reference Library" (AI-powered chat for guidelines), and "Trivia Time" (case-based MCQ quizzes with detailed explanations).

### Privacy & Data Protection
A comprehensive Privacy Policy (Version 1.0) covers data collection, storage, security, AI processing, retention, user responsibility, compliance with Indian law, data deletion, and contact information. It includes data sharing preferences and biometric lock settings.

### Subscription & AI Credits Model
Offers a Free Plan (10 cases), a Base Plan (unlimited EMR, 20 AI credits/month), and purchasable AI Credit Packs. AI credits are consumed for specific AI actions and roll over indefinitely.

## External Dependencies

### External Backend API
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- **Functionality**: Handles authentication, case management, AI features, and subscription checks.

### Database
- PostgreSQL via Drizzle ORM.

### Key NPM Packages
- `expo-av`, `expo-audio`: Audio recording.
- `react-native-reanimated`: Animations.
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation.
- `@tanstack/react-query`: Server state management.

### AI Integration
- **OpenAI**: Used for AI diagnosis, interpretation, clinical data extraction, and as a fallback for speech-to-text.
- **Sarvam AI**: Primary provider for speech-to-text (Saaras v3 model) and document OCR (Sarvam Vision).
- **PubMed (NCBI E-utilities) & WikEM API**: Integrated for medical literature search to support AI diagnosis.