# ErMate — Complete User Guide
**Emergency Room EMR by Varah Group**

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Signing In](#2-signing-in)
3. [Dashboard](#3-dashboard)
4. [Starting a New Case](#4-starting-a-new-case)
5. [Triage](#5-triage)
6. [Case Sheet — Adult](#6-case-sheet--adult)
7. [Case Sheet — Pediatric](#7-case-sheet--pediatric)
8. [Voice Dictation](#8-voice-dictation)
9. [Document Scanning](#9-document-scanning)
10. [AI Clinical Decision Support](#10-ai-clinical-decision-support)
11. [Discharge Summary](#11-discharge-summary)
12. [Exporting Documents](#12-exporting-documents)
13. [Your Cases List](#13-your-cases-list)
14. [Learn Section](#14-learn-section)
15. [Profile & Settings](#15-profile--settings)
16. [Web App Access](#16-web-app-access)
17. [Linking Your Phone to the Web App](#17-linking-your-phone-to-the-web-app)
18. [Subscription & AI Credits](#18-subscription--ai-credits)
19. [Weekly Stats](#19-weekly-stats)
20. [Night Shift / Display Mode](#20-night-shift--display-mode)
21. [Privacy & Security](#21-privacy--security)
22. [Troubleshooting](#22-troubleshooting)

---

## 1. Getting Started

ErMate runs as a **mobile app** (iOS and Android via Expo Go) and as a **web app** in any browser.

**Mobile (recommended):**
1. Install **Expo Go** from the App Store or Google Play.
2. Open the camera or Expo Go app and scan the QR code from your hospital's ErMate link.
3. The app loads instantly — no separate download needed.

**Web:**
1. Open `ermate.in` (or your hospital's custom domain) in Chrome, Safari, or any modern browser.
2. For the best experience on web, tap **Add to Home Screen** when prompted to install the PWA.

---

## 2. Signing In

### Email & Password
1. Enter your registered email and password.
2. Tap **Sign In**.

### Sign in with Google
1. Tap **Sign in with Google**.
2. Choose your Google account.
3. If an account already exists with that email, you will be prompted to enter your existing password to link the accounts — you only need to do this once.

### Sign in with Apple (iOS only)
1. Tap **Continue with Apple**.
2. Use Face ID / Touch ID to confirm.

### Forgot Password
1. Tap **Forgot Password?** below the Sign In button.
2. Enter your email address and tap **Send Reset Link**.
3. Check your inbox for the reset email. If it doesn't arrive within 5 minutes, check your spam/junk folder.
4. Click the link in the email and follow the steps to set a new password.

### First-time Registration
1. Tap **Sign Up** at the bottom of the login screen.
2. Fill in your name, email, password, role (Doctor / Resident / Nurse / Other), and hospital name.
3. Tap **Create Account**.

---

## 3. Dashboard

The Dashboard is the first screen you see after signing in. It shows:

| Card | What it shows |
|---|---|
| **Active Cases** | Number of cases you opened today |
| **Cases This Week** | Your weekly case count |
| **AI Credits** | Credits remaining for AI features |
| **My Weekly Stats** | Shortcut to your time-saved statistics |

**Quick actions at the top:**
- **New Case** — starts a full triage → case sheet flow
- **Quick Case** — jumps straight into a case sheet with minimal patient info (for fast documentation)

---

## 4. Starting a New Case

### Full Flow (Recommended)
1. Tap **New Case** on the Dashboard or the **+** button.
2. Complete the **Triage** step (see Section 5).
3. You are taken into the **Case Sheet** automatically.

### Quick Case (Bypass Triage)
1. Tap **Quick Case** on the Dashboard.
2. Enter the patient's name and presenting complaint.
3. You go directly into the Case Sheet — triage data can be filled in later.

> **Tip:** Use Quick Case when the patient is critical and documentation speed is the priority. Use Full Flow for complete documentation from the start.

---

## 5. Triage

The Triage screen captures the first essential data points before opening the case sheet.

**Fields to complete:**

| Field | Notes |
|---|---|
| Patient Name | Full name |
| Age | Automatically routes to Pediatric sheet if ≤ 16 years |
| Gender | Male / Female / Other |
| Presenting Complaint | Chief reason for ER visit |
| Triage Category | P1 (Immediate) / P2 (Urgent) / P3 (Non-Urgent) |
| Arrival Mode | Walk-in / Ambulance / Referred |
| Vitals | BP, HR, SpO₂, RR, Temperature, GCS |

Once you tap **Proceed**, ErMate creates the case and opens the Case Sheet.

---

## 6. Case Sheet — Adult

The Adult Case Sheet follows the **ATLS framework** with tabbed sections:

### Tabs Overview

**Patient**
- View and edit vitals (color-coded for abnormal values)
- Patient demographics and triage summary

**History**
- **SAMPLE** history: Signs & Symptoms, Allergies, Medications, Past history, Last meal, Events leading up
- Social history and family history
- Psychological assessment flags

**Primary Assessment (ABCDE)**
- Airway status
- Breathing — RR, SpO₂, air entry
- Circulation — HR, BP, CRT
- Disability — GCS (E/V/M), GRBS, AVPU
- Exposure — Temperature, visible injuries

**Secondary Assessment**
- Full head-to-toe examination findings
- Systems review

**Investigations**
- Lab orders and results
- Imaging (X-ray, CT, USG, ECG)
- Free-text results entry

**Treatment**
- Medications / drugs administered (dose, route, time)
- IV fluids
- Procedures performed (intubation, chest drain, catheter, etc.)

**Progress Notes**
- Time-stamped clinical notes
- Nursing notes

**AI Support**
- Clinical Decision Support (see Section 10)

### Saving a Case
- Tap **Commit to Backend** (the save button) at any point.
- A green banner confirms the save and shows how many minutes you saved vs paper documentation.
- Cases auto-save locally as you type.

---

## 7. Case Sheet — Pediatric

Patients aged **16 years or under** automatically open the **Pediatric Case Sheet**, which follows **PALS guidelines**.

**Key differences from Adult:**
- Vitals normal ranges are **age-adjusted** and color-coded accordingly
- Weight-based drug dosing references
- Pediatric GCS scoring
- Paediatric AVPU scale
- PALS-based resuscitation reference card accessible from the sheet

Everything else (tabs, voice, AI, export) works the same as the adult sheet.

---

## 8. Voice Dictation

Voice dictation lets you speak naturally and have the app fill in case sheet fields automatically.

### Smart Dictation (Full History)
Use this to dictate a complete patient history in one go.

1. Tap the **microphone icon** at the top of the Case Sheet.
2. Select **Smart Dictation**.
3. Speak naturally: *"Patient is a 45-year-old male who came with chest pain for 2 hours, radiating to the left arm. He has a history of hypertension and is on amlodipine. No known drug allergies. Last meal 4 hours ago."*
4. Tap **Stop** when done.
5. ErMate transcribes your speech (Sarvam AI) and then uses AI to extract and populate the relevant fields — presenting complaint, history, allergies, medications, etc.
6. Review the auto-filled fields and correct anything if needed.
7. Tap **Apply** to confirm.

> Consumes **1 AI credit** per use.

### Field-Specific Dictation
For individual fields (e.g., just examination findings):

1. Tap the **microphone icon** next to any specific field.
2. Speak the content for that field only.
3. Tap **Stop** — the field is populated automatically.

> **Tip:** Speak clearly and at a normal pace. The system understands medical terminology including drug names, anatomical terms, and clinical findings.

---

## 9. Document Scanning

Scan paper documents (referral letters, old records, lab reports) and have them automatically populate the case sheet.

1. Tap the **scan icon** (camera with document) in the Case Sheet.
2. Choose **Take Photo** (camera) or **Choose from Gallery**.
3. ErMate reads the document using OCR (Sarvam Vision).
4. AI extracts relevant clinical data and maps it to the appropriate fields.
5. Review the extracted data and tap **Apply to Case**.

> Consumes **1 AI credit** per scan.

**Works well with:**
- Printed referral letters
- Previous discharge summaries
- Lab result printouts
- Handwritten notes (clear handwriting)

---

## 10. AI Clinical Decision Support

Generates a differential diagnosis list based on everything documented in the case sheet.

### Running AI Support
1. Go to the **AI Support** tab in the Case Sheet.
2. Tap **Generate Differential**.
3. Wait 5–10 seconds.

### Reading the Results

Each diagnosis is labelled:

| Label | Meaning |
|---|---|
| **CONSISTENT** | Strongly supported by the current clinical picture |
| **POSSIBLE** | Cannot be ruled out; worth investigating |
| **LESS LIKELY** | Low probability given current findings |

Each entry includes:
- Brief clinical reasoning
- Relevant guideline citations (PubMed / WikEM references)
- Suggested next steps

### Acting on Results
- Tap **Add to Case** to include the diagnosis in the case documentation
- Tap **Exclude** to dismiss a diagnosis (this teaches the AI over time)

> An inline **disclaimer banner** is shown: AI suggestions are decision support only — clinical judgment takes precedence.

> Consumes **1 AI credit** per run.

---

## 11. Discharge Summary

Once the patient is ready for discharge, generate a structured discharge summary.

1. From the Case Sheet, tap **Discharge** (bottom of screen or in the top menu).
2. The Discharge Summary screen opens, pre-filled with data from the case sheet.
3. Review and edit:
   - Diagnosis (primary and secondary)
   - Condition at discharge
   - Discharge medications with instructions
   - Follow-up plan
   - Patient instructions / advice
4. Optionally tap **AI Discharge Summary** to have AI draft the narrative sections.
5. Tap **Save Discharge Summary**.

> AI Discharge Summary consumes **1 AI credit**.

---

## 12. Exporting Documents

Export any Case Sheet or Discharge Summary as a PDF or Word document.

1. Open the completed Case Sheet or Discharge Summary.
2. Tap the **Export** button (share icon, top right).
3. Choose format:
   - **PDF** — best for printing and sharing
   - **DOCX** — editable in Microsoft Word / Google Docs
4. The file is generated and your device's share sheet opens.
5. Share via WhatsApp, email, save to files, or print directly.

> **Tip:** Use PDF for hospital records. Use DOCX if the referral hospital needs to edit the document.

---

## 13. Your Cases List

Access all your documented cases from the **Cases** tab (bottom navigation).

### List View
- Cases sorted by most recent
- Shows patient name, presenting complaint, age, date/time
- Tap any case to reopen and continue editing

### By Complaint View
- Tap the **tag icon** (top right of Cases screen) to switch to the grouped view
- Cases grouped by presenting complaint (e.g., Chest Pain, Breathlessness, Fever)
- Sorted by frequency — most common complaints at the top
- Useful for auditing your case mix

### Searching Cases
- Use the search bar at the top to filter by patient name or complaint

---

## 14. Learn Section

The Learn section (bottom navigation, graduation cap icon) has three educational modules.

### Simulation-Based Teaching
Interactive clinical case simulations that test your decision-making.

1. Tap **Simulation**.
2. Choose a case scenario (chest pain, trauma, pediatric emergency, etc.).
3. You are presented with a patient presentation and asked to make decisions at each step.
4. The simulation responds to your choices — investigations reveal findings, patient condition changes.
5. At the end, a **debrief** explains the ideal management pathway with references.

### EM Reference Library
An AI-powered chat for emergency medicine guidelines and drug references.

1. Tap **EM Reference**.
2. Type any clinical question: *"STEMI management protocol"*, *"Dose of adrenaline in anaphylaxis"*, *"Ottawa ankle rules"*
3. Get a concise, evidence-based answer with citations.

> Consumes **1 AI credit** per query.

### Trivia Time
Case-based MCQ quizzes to sharpen your knowledge.

1. Tap **Trivia**.
2. A clinical vignette is presented with 4 answer choices.
3. Select your answer.
4. The correct answer is revealed with a detailed explanation and the key teaching point.
5. Progress through multiple questions per session.

**Weekly Streak:** Complete at least one quiz per week to build your streak. The streak counter is shown on the Trivia home screen.

---

## 15. Profile & Settings

Access from the **Profile** tab (bottom navigation, person icon).

### Account Info
Your name, email, hospital, and current subscription plan are shown at the top.

### Menu Options

| Option | What it does |
|---|---|
| **My Stats** | View your weekly cases, time saved, and all-time totals |
| **Link to Web** | Connect your phone to the web app (see Section 17) |
| **Upgrade Plan** | View and purchase subscription plans and AI credit packs |
| **Change Password** | Update your login password |
| **Set Password** | (Google sign-in users only) Set a password for email login |
| **Notifications** | Manage push notification preferences |
| **Privacy** | View privacy settings, data sharing preferences, biometric lock |
| **Help & Support** | FAQs, contact support |
| **About ErMate** | Version info, privacy policy, terms |
| **Display Mode** | Switch between Auto / Always Light / Always Dark |

### Changing Your Password
1. Tap **Change Password** (email users) or **Set Password** (Google users).
2. **Email users:** Enter your current password, then your new password twice.
3. **Google users:** Enter your desired password twice (no current password needed).
4. Tap **Update** / **Set Password**.

---

## 16. Web App Access

The web app at `ermate.in` lets you access ErMate from any browser — useful on a hospital desktop or tablet.

**Features available on web:**
- View all your cases
- Read case details
- Expand full case notes
- Access the device linking QR code

**Features only on mobile (Expo Go):**
- Voice dictation
- Document scanning
- Camera-based features
- Native notifications

Log in to the web app the same way as the mobile app — email/password or Google.

---

## 17. Linking Your Phone to the Web App

There are two ways to use your phone login to authenticate the web app.

### Method 1 — QR Code (Easiest)
1. Open `ermate.in` on your desktop/tablet browser.
2. At the login screen, tap **Sign in with Phone QR**.
3. A QR code appears on the web screen.
4. On your phone (already logged into ErMate), go to **Profile → Link to Web**.
5. Tap **Scan QR Code** and point your phone camera at the QR on the screen.
6. Tap **Approve** on your phone.
7. The web app logs in automatically — no password typing needed.

### Method 2 — 6-Digit Code
1. On your phone, go to **Profile → Link to Web**.
2. A 6-digit code is shown (valid for a few minutes).
3. On the web app login screen, enter this code.
4. The web session is linked to your phone account.

---

## 18. Subscription & AI Credits

### Plans

| Plan | Cases | AI Credits | Price |
|---|---|---|---|
| **Free** | 10 cases total | None | Free |
| **Base** | Unlimited | 20/month | Subscription |
| **AI Credit Packs** | — | Additional credits | Add-on purchase |

### What uses AI Credits?

| Feature | Credits used |
|---|---|
| Smart Dictation (full history) | 1 credit |
| Field-specific voice dictation | 1 credit |
| Document Scanning | 1 credit |
| AI Clinical Decision Support | 1 credit |
| EM Reference Library query | 1 credit |
| AI Discharge Summary | 1 credit |

**AI credits never expire** — purchased credits roll over indefinitely.

### Upgrading
1. Go to **Profile → Upgrade Plan**.
2. Choose a plan or AI credit pack.
3. Complete payment.
4. Credits are available immediately.

---

## 19. Weekly Stats

See how much time you are saving versus paper documentation.

1. Go to **Profile → My Stats** or tap the **My Weekly Stats** card on the Dashboard.
2. The Stats screen shows:
   - Cases documented this week
   - **Time saved vs paper** (calculated as: paper average 18 min − digital average 4 min = ~14 min saved per case)
   - Your top presenting complaints for the week
   - All-time case count and total time saved

> Time-saving is calculated automatically in the background as you document cases. No setup required.

---

## 20. Night Shift / Display Mode

ErMate automatically switches to dark mode during night shift hours (9 pm – 6 am) to protect your eyes in a dim environment.

### Options
| Setting | Behaviour |
|---|---|
| **Auto (9pm–6am)** | Dark mode during night hours, light mode during the day |
| **Always Light** | Light mode at all times |
| **Always Dark** | Dark mode at all times |

### Changing Display Mode
1. Go to **Profile**.
2. Scroll to the **Display Mode** section.
3. Tap your preferred option. Change takes effect immediately.

---

## 21. Privacy & Security

- All case data is stored on secure servers and filtered so only **you** can see your cases — no cross-user data access.
- Passwords are **never stored in plaintext** on the device or server.
- The silent re-login system encrypts your session credentials using AES-256 encryption.
- You can request deletion of your data at any time via **Profile → Privacy → Data Deletion Request**.
- Data handling complies with **Indian Information Technology Act** and standard medical data protection practices.
- AI processing (voice, scan, decision support) is done via secure API calls — patient data is not used to train AI models.

---

## 22. Troubleshooting

### "Session expired" / Logged out automatically
Your login session refreshes automatically in the background. If you are logged out, simply sign in again — the app will stay logged in for 30 days after that.

### Reset link not arriving
1. Check your spam/junk folder.
2. Make sure you entered the correct email address.
3. Wait up to 5 minutes.
4. If still not received, contact support.

### Voice dictation not working
1. Make sure microphone permission is granted: Settings → ErMate / Expo Go → Microphone → Allow.
2. Speak clearly in a quiet environment.
3. Check your internet connection — transcription requires a live connection.

### Document scan not extracting data
1. Ensure good lighting and the document is flat.
2. Avoid shadows and blurring.
3. For printed documents, results are best. Handwritten notes work if handwriting is clear.

### App is slow or loading
1. Check your internet connection.
2. Close and reopen the app.
3. If on the web app, try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

### Case not saving
1. Check the internet connection.
2. Tap the save/commit button again.
3. The app saves a local copy — your work is not lost even without connection.

### Can't hear AI features or voice
- These features are data-only (no audio output) — they use your microphone for input and display text output.

---

## Support

**Email:** support@ermate.com
**Website:** ermate.in

---

*ErMate v1.0.0 — Developed by Varah Group*
*This guide covers all features as of June 2026.*
