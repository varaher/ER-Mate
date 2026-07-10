import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

// ─── Data model ──────────────────────────────────────────────────────────────

interface Step {
  text: string;
}

interface Tip {
  text: string;
}

interface Section {
  heading: string;
  steps: Step[];
  tips?: Tip[];
}

interface Chapter {
  id: string;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  sections: Section[];
}

// ─── Content ─────────────────────────────────────────────────────────────────

const CHAPTERS: Chapter[] = [
  {
    id: "quickstart",
    icon: "zap",
    color: "#f59e0b",
    title: "Quick Start",
    subtitle: "Be documenting your first case in 3 minutes",
    sections: [
      {
        heading: "First-time setup",
        steps: [
          { text: "Download ErMate on your phone via Expo Go, or open er-mate.replit.app on any browser." },
          { text: "Register with your email or sign in with Google. New accounts start on the Free plan — 10 cases with every AI feature fully enabled." },
          { text: "If your HOD has already set up your department, tap the invite link they shared on WhatsApp. You are automatically added to the team roster." },
          { text: "Optionally go to Profile → Upgrade Plan to start your 30-day free Pro trial before your free cases run out." },
        ],
        tips: [
          { text: "Pro tip — use Google Sign-In for the fastest login. No password to type during a busy shift." },
        ],
      },
      {
        heading: "Document your first patient",
        steps: [
          { text: "Tap New Patient on the Dashboard." },
          { text: "Fill the Triage form — priority, vitals, chief complaint. This takes under 60 seconds." },
          { text: "The case sheet opens automatically. Tap Speak This Case in the Patient tab." },
          { text: "Talk naturally for 60–90 seconds about the patient's presentation. Any Indian language works." },
          { text: "Tap Stop, then Apply. ErMate fills all 7 tabs from your dictation." },
          { text: "Review the coloured dots on the tab bar. Green = well filled. Tap any amber or red tab to add details." },
          { text: "When done, go to the Disposition tab → Generate Discharge Summary → Export PDF." },
        ],
        tips: [
          { text: "The whole process — triage to saved case sheet — typically takes 4–6 minutes. The same case on paper takes 18–20 minutes." },
        ],
      },
    ],
  },

  {
    id: "triage",
    icon: "alert-triangle",
    color: "#ef4444",
    title: "Patient Triage",
    subtitle: "Capture every arriving patient in under 60 seconds",
    sections: [
      {
        heading: "Triage levels",
        steps: [
          { text: "P1 — Immediate. Life-threatening. Red. E.g. cardiac arrest, airway compromise, major trauma." },
          { text: "P2 — Urgent. Potentially life-threatening. Orange. E.g. chest pain, stroke, severe sepsis." },
          { text: "P3 — Less urgent. Stable but needs attention. Yellow. E.g. moderate pain, mild dyspnoea." },
          { text: "P4 — Minor. Ambulatory, not in distress. Green. E.g. minor lacerations, mild fever." },
          { text: "P5 — Non-urgent. Could be managed at OPD level. Blue. E.g. prescription refill, chronic complaint." },
        ],
        tips: [
          { text: "The triage colour automatically appears on every case card in the Cases tab and Shift Cases view — so consultants can prioritise at a glance." },
        ],
      },
      {
        heading: "What to capture at triage",
        steps: [
          { text: "Chief complaint — type or dictate. This auto-populates the History tab later." },
          { text: "Vitals — HR, BP, SpO2, RR, Temperature, GCS, GRBS. All editable later from the Patient tab." },
          { text: "Triage priority — select P1–P5 using the colour buttons." },
          { text: "Tap Start Case Sheet. The appropriate sheet (Adult or Pediatric) opens based on the age entered." },
        ],
        tips: [
          { text: "For pre-triaged patients from another facility, use Quick Case Sheet (Dashboard → New Patient → Quick Case Sheet) to skip triage and go straight to documentation." },
        ],
      },
      {
        heading: "Works with or without a hospital EMR",
        steps: [
          { text: "If your hospital has no EMR — ErMate is your complete system. Every case is stored, searchable, and exportable." },
          { text: "If your hospital has an existing EMR — doctors use ErMate on their phones for dictation-powered speed, then copy or export the data to the hospital system. The two run independently with no integration required." },
        ],
      },
    ],
  },

  {
    id: "casesheet",
    icon: "clipboard",
    color: "#6366f1",
    title: "Case Sheet — 7 Tabs",
    subtitle: "ATLS / PALS · JCI & NABH standard documentation",
    sections: [
      {
        heading: "Tab 1 — Patient",
        steps: [
          { text: "Demographics — name, age, sex, address, contact, referral source." },
          { text: "Vitals at Arrival — tap any value to edit inline. Normal ranges are shown next to each field. Abnormal values are highlighted red or amber." },
          { text: "For paediatric patients (≤16 yrs), normal ranges update automatically based on the child's exact age. A HR of 145 is flagged differently for a 2-year-old versus a 12-year-old." },
          { text: "Allergies — free text or 'NKDA' (pre-filled as default)." },
        ],
        tips: [
          { text: "Tap Speak This Case from this tab to run Smart Dictation across all 7 tabs at once." },
        ],
      },
      {
        heading: "Tab 2 — History (SAMPLE)",
        steps: [
          { text: "Signs & Symptoms — presenting complaint and associated features." },
          { text: "Allergies — synced from the Patient tab." },
          { text: "Medications — current drugs. Dictate brand names or generics, ErMate recognises both." },
          { text: "Past Medical & Surgical History — comorbidities, prior hospitalisations, operations." },
          { text: "Last Meal — time of last oral intake. Important for procedural planning." },
          { text: "Events Leading to Presentation — mechanism of injury for trauma, timeline for medical cases." },
          { text: "Family & Social History — additional context captured in the Other History field." },
        ],
      },
      {
        heading: "Tab 3 — Primary Survey (ABCDE)",
        steps: [
          { text: "Airway — patent / compromised / maintained with adjunct. Default: Patent." },
          { text: "Breathing — rate, effort, auscultation findings, SpO2. Normal values auto-filled if not dictated." },
          { text: "Circulation — HR, BP, capillary refill, skin perfusion." },
          { text: "Disability — GCS (Eye / Verbal / Motor scored separately), GRBS, AVPU, pupils." },
          { text: "Exposure — temperature, any rashes, wounds, or external findings." },
          { text: "For Trauma mode — additional fields for mechanism, injury pattern, haemorrhage control, and FAST exam appear." },
        ],
        tips: [
          { text: "Switch between Medical and Trauma mode using the toggle at the top of the case sheet. You can switch at any time without losing data." },
        ],
      },
      {
        heading: "Tab 4 — Examination",
        steps: [
          { text: "Systemic examination — Cardiovascular, Respiratory, Abdomen, Neurological, MSK." },
          { text: "Each system has structured fields plus a free-text findings box." },
          { text: "Psychological Assessment — PHQ-2 (depression), GAD-2 (anxiety), and PTSD screening are embedded here. Positive flags are highlighted and carry forward to the discharge summary." },
        ],
      },
      {
        heading: "Tab 5 — Treatment",
        steps: [
          { text: "Medications Given — drug name, dose, route, frequency, time. Dictate naturally ('gave morphine 5 mg IV') and ErMate structures it." },
          { text: "Procedures Performed — IV access, catheterisation, intubation, chest drain, etc." },
          { text: "Investigations Ordered — linked to the Investigations screen for ABG, ECG, bloods, imaging." },
        ],
      },
      {
        heading: "Tab 6 — Notes",
        steps: [
          { text: "Free-text clinical narrative — progress notes, reasoning, communication with family." },
          { text: "This is the one section that is left blank if not dictated. All other sections receive normal/negative defaults." },
          { text: "Case Addenda can be added after the case is saved — useful for adding consultant review notes or late results." },
        ],
      },
      {
        heading: "Tab 7 — Disposition",
        steps: [
          { text: "Provisional / Final Diagnosis — type or select from the AI-generated differential." },
          { text: "Clinical Decision Support — tap Generate to get ErMate's AI differential (see separate chapter)." },
          { text: "Condition at Discharge — Stable / Critical / Referred / LAMA / Deceased." },
          { text: "Follow-up instructions — outpatient appointment, medications to continue, red flags to return for." },
          { text: "Discharge Summary — tap Generate Discharge Summary to auto-produce the complete document." },
        ],
      },
      {
        heading: "JCI & NABH compliance",
        steps: [
          { text: "Every printed case sheet and discharge summary meets JCI and NABH documentation standards." },
          { text: "No field on the printed document is ever left blank — undocumented fields print with clinically appropriate defaults (e.g. 'Airway: Patent', 'Allergies: NKDA', 'Pupils: Equal and reactive')." },
          { text: "The 3-section narrative structure (History → Examination → Management) matches NABH ER documentation guidelines." },
          { text: "Consultant review notes are stamped with time and reviewer name for audit purposes." },
        ],
        tips: [
          { text: "For accreditation audits, export the case sheet PDF from the Disposition tab. It carries all structured data in a printable format." },
        ],
      },
    ],
  },

  {
    id: "dictation",
    icon: "mic",
    color: "#10b981",
    title: "Smart Dictation",
    subtitle: "Any Indian language · Fills all 7 tabs · Normals auto-filled",
    sections: [
      {
        heading: "How it works",
        steps: [
          { text: "Tap Speak This Case from the Patient tab of any open case sheet." },
          { text: "Talk naturally — as if presenting the case to a colleague. No need to say field names or follow any structure." },
          { text: "Sarvam AI (Saaras v3 model) transcribes your speech. If you speak in Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, or any other major Indian language, ErMate automatically translates to English before processing." },
          { text: "GPT-4o reads the transcription and extracts structured clinical data — symptoms, vitals, medications, examination findings, diagnosis, management plan." },
          { text: "Tap Apply. All relevant fields across all 7 tabs are populated simultaneously." },
        ],
        tips: [
          { text: "You don't need to finish a sentence or speak formally. 'Patient 45 male chest pain since morning, BP 160/90, gave aspirin 325, ECG shows ST changes, likely ACS' is enough for a complete dictation." },
        ],
      },
      {
        heading: "What if you don't mention a section?",
        steps: [
          { text: "Unmentioned sections are not left blank. ErMate fills them with clinically appropriate normal / negative defaults." },
          { text: "Examples of auto-defaults: Airway → 'Patent'. Allergies → 'NKDA'. Pupils → 'Equal and reactive, 3mm bilaterally'. Skin → 'Warm and well-perfused'. Breath sounds → 'Bilaterally clear'." },
          { text: "After applying dictation, coloured dots appear on every tab: Green (well filled from dictation), Amber (partially captured), Red (not mentioned — auto-filled with defaults)." },
          { text: "Tap any amber or red tab to review and add specific findings. The rest of the sheet is already complete." },
        ],
        tips: [
          { text: "This means a 90-second dictation produces a complete, print-ready case sheet — not a half-finished one with blank fields." },
        ],
      },
      {
        heading: "Indian language support",
        steps: [
          { text: "Dictate in any language — Hindi, Tamil, Telugu, Malayalam, Kannada, Marathi, Bengali, Gujarati, Punjabi, Odia, or a mix." },
          { text: "Code-switching works too — 'patient ko subah se chest pain hai, BP 150/90, gave him aspirin' is perfectly understood." },
          { text: "The output case sheet is always in English, suitable for medical records and medicolegal documentation." },
          { text: "Translation happens automatically — no setting to change. If you speak English, ErMate skips translation and processes directly." },
        ],
        tips: [
          { text: "Ideal use: dictate in your native language while examining the patient, so documentation happens during the consultation — not after." },
        ],
      },
      {
        heading: "Document scanning (alternative input)",
        steps: [
          { text: "If the patient arrives with a paper referral letter, printed ECG report, or discharge summary from another hospital, tap the scan icon in the top bar of the case sheet." },
          { text: "Take a photo or pick from gallery. Sarvam Vision OCR reads the text." },
          { text: "GPT-4o extracts the clinical data and populates the relevant case sheet fields automatically." },
          { text: "Review the populated fields and make any corrections before saving." },
        ],
      },
    ],
  },

  {
    id: "pediatrics",
    icon: "heart",
    color: "#ec4899",
    title: "Pediatric Cases",
    subtitle: "PALS-based · Age-correct vitals · Weight dosing",
    sections: [
      {
        heading: "Auto-routing to the pediatric sheet",
        steps: [
          { text: "Enter the patient's age in the Triage form or Quick Case Sheet. If the patient is 16 years or younger, ErMate automatically opens the Pediatric Case Sheet." },
          { text: "The pediatric sheet has the same 7-tab structure as the adult sheet, with paediatric-specific fields and references throughout." },
          { text: "You can switch between the two sheet types manually from the case sheet header if needed." },
        ],
      },
      {
        heading: "Age-correct normal vital ranges",
        steps: [
          { text: "Every vital field in the Patient tab displays the normal range for the child's specific age — not a generic paediatric range." },
          { text: "Heart Rate: Normal for a 1-month-old (100–160) is shown differently from a 10-year-old (60–100)." },
          { text: "Respiratory Rate, Blood Pressure, SpO2 — all dynamically adjusted." },
          { text: "Values outside the age-correct range are highlighted in red (critical deviation) or amber (borderline) so abnormals are never missed in a busy ER." },
        ],
        tips: [
          { text: "Paediatric cases are the highest-risk for documentation errors due to age-dependent normals. The colour-coded system acts as a built-in clinical safety check." },
        ],
      },
      {
        heading: "Weight-based drug dosing",
        steps: [
          { text: "Enter the child's weight in kg in the Patient tab. This unlocks weight-based dose calculations throughout the sheet." },
          { text: "For emergency drug doses during a resuscitation, go to Dashboard → Pediatric Drug Calculator." },
          { text: "Enter weight — get immediate calculated doses for: Adrenaline (1:10,000 and 1:1,000), Atropine, Adenosine, Amiodarone, Fluid bolus (NS/RL), Glucose bolus, Lorazepam, Phenobarbitone, Midazolam." },
          { text: "Doses are shown with concentration, volume to draw up, and route — ready for the nurse to act on immediately." },
        ],
        tips: [
          { text: "Pin the Pediatric Drug Calculator to your home screen for one-tap access during resuscitations. It works offline — no network needed." },
        ],
      },
      {
        heading: "PALS-specific documentation",
        steps: [
          { text: "Primary Survey uses PALS (Pediatric Advanced Life Support) terminology and assessment criteria." },
          { text: "Developmental history fields appear in the History tab for patients under 5 years." },
          { text: "All printed documents meet JCI and NABH standards for paediatric ER encounters." },
        ],
      },
    ],
  },

  {
    id: "ai",
    icon: "cpu",
    color: "#8b5cf6",
    title: "AI Clinical Decision Support",
    subtitle: "Differentials · ABG · ECG · Evidence citations",
    sections: [
      {
        heading: "Generating a differential diagnosis",
        steps: [
          { text: "Document the patient's history, examination findings, and investigations first. The more complete the case sheet, the richer the AI output." },
          { text: "Go to the Disposition tab → ErMate Decision Support section → tap Generate." },
          { text: "ErMate reads everything documented across all tabs — symptoms, vitals, ABG values, ECG findings, lab results — and generates a ranked differential." },
          { text: "Each diagnosis is labelled: CONSISTENT (strongly supported), POSSIBLE (partial features present), or LESS LIKELY (worth excluding but not the primary)." },
          { text: "Every diagnosis comes with PubMed and WikEM citations — click to read the supporting evidence." },
          { text: "Tap Add to Case to include a diagnosis in the Disposition. Tap Exclude to dismiss it from the differential." },
        ],
        tips: [
          { text: "Run Clinical Decision Support after Smart Dictation for the best output — the AI reads the full populated case, not just the chief complaint." },
        ],
      },
      {
        heading: "ABG / VBG interpretation",
        steps: [
          { text: "Enter ABG or VBG values in the Investigations tab — pH, PaO2, PaCO2, HCO3, Base Excess, Lactate." },
          { text: "These values are automatically read by the Clinical Decision Support AI when generating the differential." },
          { text: "The AI interprets the gas pattern (respiratory acidosis, metabolic alkalosis, mixed picture, etc.) and factors this into the suggested diagnoses and management priorities." },
        ],
        tips: [
          { text: "Always enter ABG values before running Clinical Decision Support in critically ill patients — it significantly improves the differential quality." },
        ],
      },
      {
        heading: "ECG findings",
        steps: [
          { text: "Enter ECG findings in the Investigations tab — rhythm, rate, axis, intervals, ST changes, morphology." },
          { text: "ErMate's AI reads the ECG description and incorporates it into the differential — for example, ST elevation in V1–V4 + chest pain will push STEMI to the top of CONSISTENT." },
          { text: "You can also scan a printed ECG (Document Scanning) and the OCR will extract the machine-reported interpretation into the appropriate field." },
        ],
      },
      {
        heading: "AI Discharge Summary",
        steps: [
          { text: "Once documentation is complete, go to the Disposition tab → Generate Discharge Summary." },
          { text: "ErMate reads the full case sheet and generates a structured summary including: presenting complaint, history, examination, investigations, treatment given, diagnosis, condition at discharge, and follow-up instructions." },
          { text: "Every field in the printed document has a value — undocumented sections use clinically appropriate defaults so nothing prints blank." },
          { text: "Review and edit the summary if needed, then export as PDF (for the patient file) or DOCX (for further editing)." },
        ],
        tips: [
          { text: "The discharge summary can be re-generated at any time if you update the case sheet. Each regeneration reads the latest documented data." },
        ],
      },
    ],
  },

  {
    id: "team",
    icon: "users",
    color: "#10b981",
    title: "Team & Shift Management",
    subtitle: "HOD setup · Shift check-in · Live case oversight",
    sections: [
      {
        heading: "HOD — First-time department setup",
        steps: [
          { text: "Go to Profile → Set Up Department." },
          { text: "Enter your department name, hospital name, and city." },
          { text: "Configure shift schedules — Morning, Evening, Night. For each shift, set the start time, end time, and maximum number of consultant and resident slots." },
          { text: "An invite link is generated automatically. Share it via WhatsApp to all team members. Anyone who taps the link is added to your department roster." },
          { text: "Once set up, access the HOD Dashboard any time from Profile → HOD Dashboard." },
        ],
        tips: [
          { text: "Set realistic slot counts. If you configure 2 consultant slots per shift, the third consultant who tries to check in will see a 'slot full' message." },
        ],
      },
      {
        heading: "Team members — joining a department",
        steps: [
          { text: "Tap the invite link shared by your HOD (usually via WhatsApp). You are automatically added to the roster." },
          { text: "Open ErMate. You will now see the department name on your Dashboard and Profile." },
          { text: "When you open the app during a shift window, the Shift Selection screen appears automatically." },
          { text: "Choose your shift and your role for that shift (Consultant or Resident). Tap Start Shift." },
          { text: "A shift banner appears on your Dashboard. You are now visible to the HOD and all consultants on the shift." },
        ],
      },
      {
        heading: "Consultant — reviewing a resident's case",
        steps: [
          { text: "Go to the Cases tab. Scroll to the SHIFT CASES section (only visible when you are on shift as a consultant or HOD)." },
          { text: "All cases documented by doctors currently on the same shift are shown here — colour-coded by triage priority with the doctor's name and role badge." },
          { text: "Tap a resident's case card. A review modal opens showing the full case." },
          { text: "Write your review notes — additional findings, management changes, teaching points." },
          { text: "Tap Save Review. The case is marked with a green Reviewed badge, visible to everyone on the shift. This creates an audit trail of consultant oversight." },
        ],
        tips: [
          { text: "Shift Cases auto-refresh every 30 seconds. New cases from colleagues appear automatically — no need to pull to refresh." },
        ],
      },
      {
        heading: "HOD Dashboard — live ER overview",
        steps: [
          { text: "Profile → HOD Dashboard shows a real-time view of the entire department." },
          { text: "Slot counts — how many consultants and residents are on each shift right now." },
          { text: "Active doctors — every doctor currently on shift, with their name, role, and how long they have been on shift." },
          { text: "All active cases — every case being documented across all shifts, with triage priority and treating doctor." },
          { text: "Force Out — tap any doctor's entry to end their shift session if needed." },
        ],
      },
    ],
  },

  {
    id: "handover",
    icon: "shuffle",
    color: "#0ea5e9",
    title: "Handover",
    subtitle: "Conversational AI chat · Official 7-column PDF",
    sections: [
      {
        heading: "Handover Chat — fastest method",
        steps: [
          { text: "At the end of your shift, go to Dashboard → New Handover." },
          { text: "A ChatGPT-style chat opens. Tap the mic or type — talk about your patients in any order, in any language." },
          { text: "Example: 'Bed 3, Rajesh, 58 male, chest pain, I thrombolysed him at 2 pm, echo pending. Bed 7, Priya, 32 female, asthma exacerbation, on nebs, improving, can probably discharge by evening.'" },
          { text: "ErMate's AI maintains a running structured patient list across turns. It tracks bed, name, age/sex, diagnosis, management done, pending tasks, and critical alerts." },
          { text: "After you have covered all patients, ErMate asks a few follow-up questions: receiving doctor's name, allergy confirmations, discharge readiness for stable patients." },
          { text: "Once complete, tap Finalize. Patient cards appear colour-coded by status: Critical (red), Unstable (orange), Stable (green), For Discharge (blue)." },
          { text: "Share the handover via WhatsApp, copy as plain text, or export the official 7-column PDF." },
        ],
        tips: [
          { text: "The whole handover for 8–10 patients typically takes 4–5 minutes by voice. Compare that to 20–30 minutes writing it by hand." },
        ],
      },
      {
        heading: "Handover Sheet — manual method",
        steps: [
          { text: "Go to Dashboard → Handover Sheet." },
          { text: "Your active cases are listed. Tick the patients you are handing over." },
          { text: "For each selected case, add the bed number and any pending notes (results awaited, tasks outstanding)." },
          { text: "Tap Export PDF. The official 7-column handover sheet is generated: Patient Label | Presenting Complaints | Past Medical History | Provisional Diagnosis | Management Done | Management Plan / To Be Done | Bystander Updation Given Time." },
          { text: "A 3-way signature block is included: Handing Over Doctor / Receiving Doctor / Consultant Aware." },
          { text: "The PDF format matches the Rajagiri Hospital standard and is suitable for any ER using structured handovers." },
        ],
      },
      {
        heading: "Receiving a handover",
        steps: [
          { text: "When a colleague finalises a handover in which you are listed as the receiving doctor, a notification appears." },
          { text: "You can also view incoming handovers from the previous shift at any time via Profile → Incoming Handovers." },
        ],
      },
    ],
  },

  {
    id: "learn",
    icon: "book-open",
    color: "#6366f1",
    title: "Learning Tools",
    subtitle: "Simulation · EM Reference · Trivia · Weekly streak",
    sections: [
      {
        heading: "Simulation-based teaching",
        steps: [
          { text: "Go to the Learn tab → Simulation-Based Teaching." },
          { text: "Choose a clinical scenario — chest pain, altered consciousness, paediatric fever, trauma, etc." },
          { text: "The case unfolds in real time. Vitals change as the scenario progresses. Investigation results arrive in sequence." },
          { text: "Make management decisions at each branch point. Different choices lead to different outcomes." },
          { text: "At the end, a performance summary shows your decisions, timing, and what the ideal management pathway was." },
        ],
        tips: [
          { text: "Ideal for DNB-EM / MRCEM preparation. Run a simulation before a shift starts to sharpen clinical thinking." },
        ],
      },
      {
        heading: "EM Reference Library",
        steps: [
          { text: "Learn tab → EM Reference Library." },
          { text: "Type any clinical question — drug doses, protocols, scoring systems, diagnostic criteria, differentials." },
          { text: "GPT-4o answers with PubMed integration — responses cite literature where relevant." },
          { text: "Examples: 'Wells score for PE', 'When to use tPA in stroke', 'HEART score criteria', 'Dose of adenosine in SVT', 'CURB-65 scoring'." },
        ],
        tips: [
          { text: "Faster than searching guidelines during a resuscitation. Use it at the bedside for quick protocol reference." },
        ],
      },
      {
        heading: "Trivia Time",
        steps: [
          { text: "Learn tab → Trivia Time." },
          { text: "Choose your category and difficulty. A set of case-based MCQs is presented." },
          { text: "For each question, select your answer. Detailed explanations are shown for every option — including why the wrong answers are wrong." },
          { text: "Your score and the weekly streak count are shown on the result card. The streak resets each calendar week." },
        ],
        tips: [
          { text: "Do one trivia session per shift handover. 5 minutes of active recall learning per day compounds significantly over a year." },
        ],
      },
    ],
  },

  {
    id: "plans",
    icon: "star",
    color: "#f59e0b",
    title: "Subscription Plans",
    subtitle: "Free trial · Pro · Team — all AI features in every plan",
    sections: [
      {
        heading: "What is included in every plan",
        steps: [
          { text: "There are no feature tiers. Every plan — including the free one — includes Smart Dictation, Clinical Decision Support, Document Scanning, AI Discharge Summary, EM Reference Library, Simulations, and all team features." },
          { text: "The only difference between plans is the number of cases you can document." },
        ],
      },
      {
        heading: "Free Plan",
        steps: [
          { text: "10 cases total — no time limit. Your 10 cases never expire." },
          { text: "Every AI feature is fully available across those 10 cases." },
          { text: "No credit card required to start." },
          { text: "Ideal for evaluating ErMate before committing." },
        ],
      },
      {
        heading: "Pro Plan — for individual doctors",
        steps: [
          { text: "Unlimited case documentation." },
          { text: "First 30 days free — no charge during the trial period." },
          { text: "Monthly: ₹1,199 / month after trial. Cancel any time." },
          { text: "Annual: ₹11,990 / year (equivalent to ₹999/month). Save ₹2,398 vs monthly billing." },
          { text: "Profile → Upgrade Plan → Pro → Start Free Trial." },
        ],
        tips: [
          { text: "The annual plan pays for itself in savings vs monthly billing in under 2 years. Most doctors who try it switch to annual after the first month." },
        ],
      },
      {
        heading: "Team Plan — for departments and hospitals",
        steps: [
          { text: "Per-doctor pricing — no fixed seat count. Add or remove doctors as your roster changes." },
          { text: "Consultants: ₹599 / month per consultant (annual: ₹5,990/year)." },
          { text: "Residents: ₹399 / month per resident (annual: ₹3,990/year)." },
          { text: "Minimum 4 doctors to enrol on the Team plan." },
          { text: "Includes all team features — HOD Dashboard, Shift Management, Shift Cases, Consultant Review, Handover." },
          { text: "Profile → Upgrade Plan → Team → configure consultant and resident counts → Pay." },
        ],
        tips: [
          { text: "For a typical 10-doctor ER team (2 consultants + 8 residents), the Team plan costs ₹4,390/month — roughly ₹439 per doctor per month." },
        ],
      },
      {
        heading: "Payments",
        steps: [
          { text: "All payments are processed by Razorpay — UPI, cards, net banking, and wallets are accepted." },
          { text: "Subscriptions can be cancelled any time from Profile → My Subscriptions." },
          { text: "Annual plans are billed upfront. Monthly plans are billed on the same date each month." },
        ],
      },
    ],
  },

  {
    id: "tools",
    icon: "tool",
    color: "#64748b",
    title: "Tools & Settings",
    subtitle: "Stats · Dark mode · Link to Web · Privacy",
    sections: [
      {
        heading: "My Weekly Stats",
        steps: [
          { text: "Dashboard → My Weekly Stats card, or Profile → My Stats." },
          { text: "Shows: cases documented this week, estimated time saved vs paper (based on avg 18 min paper vs 4 min ErMate), top presenting complaints, and all-time totals." },
          { text: "All computed locally — no data leaves your device." },
        ],
        tips: [
          { text: "Share your weekly stats with your HOD as evidence of documentation efficiency. The time-saved figure is a useful number for hospital administration discussions." },
        ],
      },
      {
        heading: "Night Shift Display Mode",
        steps: [
          { text: "ErMate automatically switches to dark mode between 9 pm and 6 am." },
          { text: "To override: Profile → Display Mode → Always Light / Always Dark / Auto (default)." },
          { text: "Dark mode is easier on the eyes during night shifts and reduces glare in darkened resus bays." },
        ],
      },
      {
        heading: "Link to Web — use ErMate on a desktop",
        steps: [
          { text: "Open er-mate.replit.app in any browser (laptop, desktop, or tablet)." },
          { text: "On the login page, tap Scan QR or enter a code, then on your phone go to Profile → Link to Web." },
          { text: "Either scan the QR shown in the browser, or enter the 6-digit code displayed on your phone into the browser." },
          { text: "Your session transfers instantly. No separate login. The browser is now authenticated as you." },
        ],
        tips: [
          { text: "Useful for typing-heavy documentation (long referral letters, detailed notes) or when your phone battery is low." },
        ],
      },
      {
        heading: "Privacy & data control",
        steps: [
          { text: "Profile → Privacy to review ErMate's full privacy policy." },
          { text: "Patient data is processed for documentation only. It is never sold or used for AI training." },
          { text: "AI processing (Sarvam, OpenAI) happens per-request — these providers do not retain your data." },
          { text: "Request full data deletion at any time from the Privacy screen." },
          { text: "Biometric lock can be enabled to prevent unauthorised access to case data." },
          { text: "Compliant with Indian data protection law (IT Act and proposed DPDPA)." },
        ],
      },
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserGuideScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: theme.primary + "18" }]}>
            <Feather name="book" size={30} color={theme.primary} />
          </View>
          <Text style={[s.heroTitle, { color: theme.text }]}>User Guide</Text>
          <Text style={[s.heroSub, { color: theme.textSecondary }]}>
            Step-by-step walkthroughs for every feature
          </Text>
          <View style={[s.heroBadge, { backgroundColor: theme.primary + "12" }]}>
            <Feather name="info" size={12} color={theme.primary} />
            <Text style={[s.heroBadgeText, { color: theme.primary }]}>
              Tap any chapter to expand the full guide
            </Text>
          </View>
        </View>

        {/* Chapters */}
        <View style={s.list}>
          {CHAPTERS.map((ch) => (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              isOpen={activeChapter === ch.id}
              onToggle={() =>
                setActiveChapter(activeChapter === ch.id ? null : ch.id)
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Chapter card ─────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  isOpen,
  onToggle,
}: {
  chapter: Chapter;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        s.chapter,
        {
          backgroundColor: theme.card,
          borderColor: isOpen ? chapter.color : "transparent",
          borderWidth: 1.5,
        },
      ]}
    >
      {/* Header */}
      <Pressable
        style={({ pressed }) => [s.chapterHeader, { opacity: pressed ? 0.85 : 1 }]}
        onPress={onToggle}
      >
        <View style={[s.chIcon, { backgroundColor: chapter.color + "18" }]}>
          <Feather name={chapter.icon as any} size={20} color={chapter.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.chTitle, { color: theme.text }]}>{chapter.title}</Text>
          <Text style={[s.chSub, { color: theme.textSecondary }]}>
            {chapter.subtitle}
          </Text>
        </View>
        <Feather
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textMuted}
        />
      </Pressable>

      {/* Body */}
      {isOpen ? (
        <View style={s.chapterBody}>
          {chapter.sections.map((sec, si) => (
            <View key={si} style={s.section}>
              {/* Section heading */}
              <View
                style={[
                  s.secHeadRow,
                  { borderLeftColor: chapter.color },
                ]}
              >
                <Text style={[s.secHeading, { color: theme.text }]}>
                  {sec.heading}
                </Text>
              </View>

              {/* Steps */}
              {sec.steps.map((step, idx) => (
                <View key={idx} style={s.stepRow}>
                  <View
                    style={[s.stepNum, { backgroundColor: chapter.color + "18" }]}
                  >
                    <Text style={[s.stepNumText, { color: chapter.color }]}>
                      {idx + 1}
                    </Text>
                  </View>
                  <Text style={[s.stepText, { color: theme.textSecondary }]}>
                    {step.text}
                  </Text>
                </View>
              ))}

              {/* Tips */}
              {sec.tips && sec.tips.length > 0 ? (
                <View style={s.tipsBlock}>
                  {sec.tips.map((tip, ti) => (
                    <View
                      key={ti}
                      style={[
                        s.tipRow,
                        {
                          backgroundColor: chapter.color + "0d",
                          borderLeftColor: chapter.color,
                        },
                      ]}
                    >
                      <Feather name="star" size={11} color={chapter.color} />
                      <Text style={[s.tipText, { color: chapter.color }]}>
                        {tip.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  heroSub: { fontSize: 13, textAlign: "center", marginBottom: Spacing.md },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "600" },

  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },

  chapter: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: 2,
  },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
  },
  chIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  chTitle: { fontSize: 15, fontWeight: "700" },
  chSub: { fontSize: 12, marginTop: 2 },

  chapterBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },

  section: { gap: 8 },

  secHeadRow: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 4,
  },
  secHeading: { fontSize: 13, fontWeight: "700" },

  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: { fontSize: 11, fontWeight: "800" },
  stepText: { fontSize: 13, lineHeight: 20, flex: 1 },

  tipsBlock: { gap: 6, marginTop: 4 },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  tipText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },
});
