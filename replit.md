# ErMate - Emergency Room EMR Application

## Overview

ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application built with React Native and Expo. Its primary purpose is to streamline the workflow for emergency medicine physicians and residents, covering patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. The application aims to improve efficiency and accuracy in emergency care through features like voice dictation, AI-powered diagnostics, and comprehensive documentation export. It operates on a subscription-based model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54, React 19.1.0 (with React Compiler experimental), and TypeScript.
**Navigation**: `RootStackNavigator` for authentication and modals, `MainTabNavigator` for core app navigation (Dashboard, Cases, New Patient, Logs, Profile), and native stack navigation for screen transitions.
**State Management**: `AuthContext` for authentication, `CaseContext` for current case data, and TanStack React Query for server state.
**UI/UX**: Themed components (`ThemedView`, `ThemedText`, `Button`, `Card`) with automatic dark/light mode and medical-specific color schemes. `KeyboardAwareScrollViewCompat` and Reanimated are used for enhanced UI/UX.
**Clinical Workflow**: Sequential modal flows for Triage, Adult Case Sheet (ATLS-based, 7 tabs), Pediatric Case Sheet (PALS-based for ≤16 years), and Discharge Summary. Age-based routing directs patients to the appropriate case sheet.

### Backend Architecture

**Server**: Express.js with TypeScript, primarily acting as a proxy to an external backend.
**Current State**: The local Express server handles basic routing and serves static files, with all core API calls directed to `https://er-emr-backend.onrender.com/api`.

### Data Storage

**Database Schema**: Drizzle ORM with PostgreSQL for `users` and `ai_feedback` tables, defined in `shared/schema.ts` with Zod validation.
**Local Storage**: AsyncStorage for user token and session, `useRef` for form data to optimize input performance.

### Key Features

**Voice Input System**: Integrates `VoiceRecorder` component using `expo-audio` for recording. Speech-to-text uses Sarvam AI (Saaras v3 model, optimized for Indian accents) as primary with OpenAI Whisper as fallback. OpenAI handles clinical data extraction from transcripts to auto-populate case sheet fields. Available in both adult and pediatric case sheets (Notes tab).
**Document Scanning System**: `DocumentScanner` component uses device camera or image picker to capture documents (lab reports, prescriptions, handwritten notes). Images are sent to `/api/scan/document` endpoint which uses Sarvam Vision API for OCR text extraction, then OpenAI for clinical data structuring. Available in both adult and pediatric case sheets (Notes tab).
**AI Diagnosis System**: Generates differential diagnoses with confidence levels and medical guideline citations. It includes a self-learning feedback system that stores user feedback to improve AI accuracy.
**Document Export System**: Supports export of Case Sheets and Discharge Summaries in PDF and DOCX formats, with platform-aware file handling for web and mobile.
**Device Linking**: Provides a secure WhatsApp-style web linking feature for accessing the web application, generating temporary, expiring link codes.

## External Dependencies

**External Backend API**:
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- **Functionality**: Handles authentication, case management, AI features, and subscription checks. All clinical data operations.

**Database**:
- PostgreSQL via Drizzle ORM.
- Requires `DATABASE_URL` environment variable.

**Key NPM Packages**:
- `expo-av`, `expo-audio`: Audio recording.
- `expo-blur`, `expo-glass-effect`: UI effects.
- `expo-haptics`: Tactile feedback.
- `react-native-reanimated`: Animations.
- `react-native-keyboard-controller`: Keyboard management.
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation.
- `@tanstack/react-query`: Server state management.

**AI Integration**:
- OpenAI (via Replit AI Integrations) for AI diagnosis and interpretation.
- Sarvam AI (via SARVAM_AI_API_KEY secret) for speech-to-text (Saaras v3 model) and document OCR (Sarvam Vision).