const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../ErMate_User_Guide.pdf");
const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 60, right: 60 }, autoFirstPage: false, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT));

// ── Colour palette ─────────────────────────────────────────
const C = {
  primary:   "#10b981",
  indigo:    "#6366f1",
  amber:     "#f59e0b",
  sky:       "#0ea5e9",
  pink:      "#ec4899",
  red:       "#ef4444",
  dark:      "#0f172a",
  mid:       "#334155",
  muted:     "#64748b",
  light:     "#f8fafc",
  white:     "#ffffff",
  border:    "#e2e8f0",
  newBadge:  "#10b981",
};

const PAGE_W = doc.page ? doc.page.width : 595.28;
const CONTENT_W = PAGE_W - 120; // left + right margins

// ── Helpers ────────────────────────────────────────────────
function newPage(bg) {
  doc.addPage();
  if (bg) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(bg);
  }
}

function drawCircle(x, y, r, fillColor) {
  doc.circle(x, y, r).fill(fillColor);
}

function badge(text, x, y, bg, fg) {
  const pad = 6;
  const w = doc.widthOfString(text, { size: 8 }) + pad * 2;
  doc.roundedRect(x, y - 9, w, 14, 4).fill(bg);
  doc.fillColor(fg || "#fff").fontSize(8).font("Helvetica-Bold").text(text, x + pad, y - 6, { lineBreak: false });
  return w + 4;
}

function sectionDivider(title, color) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(60, y, 4, 18).fill(color || C.primary);
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(13).text(title, 72, y + 2);
  doc.moveDown(0.8);
}

function featureCard(num, title, subtitle, steps, isNew, accentColor) {
  const startY = doc.y;
  const cardH = 20 + (steps.length * 14) + 24;

  if (startY + cardH + 20 > doc.page.height - 80) {
    doc.addPage();
  }

  const y = doc.y;
  const accent = accentColor || C.primary;

  // card background
  doc.roundedRect(60, y, CONTENT_W, cardH, 6).fill("#f8fafc");
  doc.rect(60, y, 4, cardH).fill(accent);

  // number circle
  drawCircle(82, y + 14, 10, accent);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8).text(String(num), 78, y + 9, { lineBreak: false });

  // title
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(11).text(title, 98, y + 7, { lineBreak: false });

  // NEW badge
  let badgeX = 98 + doc.widthOfString(title, { size: 11 }) + 8;
  if (isNew) {
    badge("NEW", badgeX, y + 16, C.newBadge);
  }

  // subtitle
  doc.fillColor(C.muted).font("Helvetica").fontSize(9).text(subtitle, 98, y + 20);

  // steps
  steps.forEach((step, i) => {
    const sy = y + 36 + i * 14;
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(8).text(`${i + 1}.`, 70, sy, { lineBreak: false });
    doc.fillColor(C.mid).font("Helvetica").fontSize(9).text(step, 82, sy, { width: CONTENT_W - 24, lineBreak: false });
  });

  doc.y = y + cardH + 10;
}

function toc_row(label, pageNum) {
  const y = doc.y;
  const dots = ".".repeat(80);
  doc.fillColor(C.mid).font("Helvetica").fontSize(10).text(label, 60, y, { continued: false });
  doc.fillColor(C.border).fontSize(10).text(dots, 200, y, { width: 290, lineBreak: false });
  doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(10).text(String(pageNum), 60 + CONTENT_W - 20, y, { lineBreak: false });
  doc.moveDown(0.4);
}

// ═══════════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════════
newPage(C.dark);

// decorative circles
doc.opacity(0.08).circle(500, 80, 160).fill(C.primary);
doc.opacity(0.06).circle(80, 600, 200).fill(C.sky);
doc.opacity(0.05).circle(540, 720, 120).fill(C.indigo);
doc.opacity(1);

// green accent bar
doc.rect(60, 180, 6, 60).fill(C.primary);

// App name
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(42).text("ErMate", 80, 183);
doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(16).text("Emergency Room EMR", 82, 232);

// tagline
doc.moveDown(0.5);
doc.fillColor("#94a3b8").font("Helvetica").fontSize(12)
  .text("Complete User Guide — Clinical Documentation, Team Shift Management,\nAI-Powered Decision Support, and Learning Tools", 82, 265, { width: 420 });

// horizontal rule
doc.opacity(0.2).rect(60, 320, CONTENT_W, 1).fill(C.white).opacity(1);

// version block
doc.fillColor("#94a3b8").font("Helvetica").fontSize(10).text("Version 1.0  ·  June 2026  ·  Varah Group", 60, 338);

// feature pills
const pills = ["Smart Dictation", "Team Shifts", "AI Decision Support", "Learn & Trivia", "Pediatric Tools"];
let px = 60;
const py = 390;
pills.forEach((p) => {
  const pw = doc.widthOfString(p, { size: 9 }) + 20;
  doc.roundedRect(px, py, pw, 20, 10).fill("#1e293b");
  doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(9).text(p, px + 10, py + 5, { lineBreak: false });
  px += pw + 8;
});

// bottom strip
doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill("#0d1a2e");
doc.fillColor("#475569").font("Helvetica").fontSize(9)
  .text("Confidential — for ErMate subscribers only", 60, doc.page.height - 26);
doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(9)
  .text("er-mate.replit.app", doc.page.width - 180, doc.page.height - 26, { lineBreak: false });

// ═══════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════
newPage(C.white);

doc.rect(0, 0, doc.page.width, 6).fill(C.primary);
doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(22).text("Table of Contents", 60, 40);
doc.fillColor(C.muted).font("Helvetica").fontSize(10).text("Click any section to jump to it on screen, or use the page numbers to navigate the printed copy.", 60, 68, { width: CONTENT_W });

doc.moveDown(1.2);

const sections = [
  ["Getting Started", 4],
  ["1 · Clinical EMR — Patient Triage", 5],
  ["2 · Adult Case Sheet (ATLS)", 5],
  ["3 · Pediatric Case Sheet (PALS)", 6],
  ["4 · Smart Dictation", 6],
  ["5 · Dictation Completion Map", 7],
  ["6 · Document Scanning", 7],
  ["7 · Clinical Decision Support", 8],
  ["8 · Discharge Summary", 8],
  ["9 · Quick Case Sheet", 9],
  ["10 · Team & Shifts — Department Setup", 9],
  ["11 · Shift Check-In", 10],
  ["12 · Shift-Aware Case View", 10],
  ["13 · Consultant Review", 11],
  ["14 · HOD Dashboard", 11],
  ["15 · Handover Sheet", 12],
  ["16 · Manage Roster", 12],
  ["17 · Learning — Simulation Scenarios", 13],
  ["18 · EM Reference Library", 13],
  ["19 · Trivia Time", 14],
  ["20 · Tools — Pediatric Drug Calculator", 14],
  ["21 · My Weekly Stats", 15],
  ["22 · Cases by Complaint", 15],
  ["23 · Night Shift Display Mode", 16],
  ["24 · Link to Web", 16],
  ["25 · Privacy & Data Control", 17],
  ["Subscription Plans & AI Credits", 17],
  ["Tips & Troubleshooting", 18],
];
sections.forEach(([label, pg]) => toc_row(label, pg));

// ═══════════════════════════════════════════════════════════
// GETTING STARTED
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.primary);
doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(20).text("Getting Started", 60, 28);
doc.moveDown(0.6);
doc.fillColor(C.muted).font("Helvetica").fontSize(10)
  .text("ErMate is a mobile-first Emergency Room EMR. Use it on your iPhone or Android phone via Expo Go, or on any desktop browser by linking your phone session.", 60, doc.y, { width: CONTENT_W });
doc.moveDown(1);

sectionDivider("Download & Sign In", C.primary);

const startSteps = [
  ["Install Expo Go", "Download Expo Go from the App Store or Google Play Store on your smartphone."],
  ["Open ErMate", "Scan the QR code at er-mate.replit.app with Expo Go, or visit the web address directly in any browser."],
  ["Create an account", "Tap Sign Up → enter your name, email, and password. Alternatively, tap Sign in with Google for instant access."],
  ["Warm-up notice", "On first launch, the backend may take 30–60 seconds to wake up — this is normal. Subsequent logins are instant."],
];

startSteps.forEach(([title, desc], i) => {
  const y = doc.y;
  drawCircle(70, y + 8, 9, C.primary);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8).text(String(i + 1), 66, y + 3, { lineBreak: false });
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(10).text(title + "  ", 84, y, { continued: false });
  doc.fillColor(C.muted).font("Helvetica").fontSize(9.5).text(desc, 84, doc.y, { width: CONTENT_W - 24 });
  doc.moveDown(0.6);
});

doc.moveDown(0.5);
sectionDivider("Navigation Overview", C.indigo);
doc.fillColor(C.mid).font("Helvetica").fontSize(9.5).text(
  "ErMate has four main tabs at the bottom of the screen:", 60, doc.y, { width: CONTENT_W });
doc.moveDown(0.5);

const tabs = [
  ["Dashboard", C.primary, "Your home base. Start new cases, view stats, access the pediatric calculator, and manage shifts."],
  ["Cases", C.indigo, "Browse your patient cases. Toggle to 'By Complaint' view, or see Shift Cases when on duty."],
  ["Learn", C.amber, "Access Simulation scenarios, the EM Reference Library, and Trivia quizzes."],
  ["Profile", C.sky, "Account settings, Display Mode, Link to Web, Team setup, and the Feature Tour."],
];

tabs.forEach(([name, color, desc]) => {
  const y = doc.y;
  doc.roundedRect(60, y, CONTENT_W, 30, 6).fill(color + "12");
  doc.rect(60, y, 4, 30).fill(color);
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(10).text(name, 72, y + 4, { lineBreak: false });
  doc.fillColor(C.mid).font("Helvetica").fontSize(9).text(desc, 72, y + 16, { width: CONTENT_W - 16 });
  doc.y = y + 36;
});

// ═══════════════════════════════════════════════════════════
// SECTION 1 — CLINICAL EMR
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 40).fill(C.indigo);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(18).text("Clinical EMR", 60, 12);
doc.fillColor("#c7d2fe").font("Helvetica").fontSize(10).text("Patient documentation from triage to discharge", 60, 26);
doc.moveDown(1.5);

featureCard(1, "Patient Triage", "5-level priority system — capture vitals at the door", [
  "From the Dashboard, tap New Patient.",
  "Enter the chief complaint and select the triage level: P1 (Immediate), P2 (Urgent), P3 (Less Urgent), P4 (Minor), or P5 (Non-urgent).",
  "Record vitals: HR, BP, SpO2, RR, Temperature, GCS, and AVPU.",
  "Tap Start Case Sheet — the patient is triaged and the full case sheet opens.",
], false, C.red);

featureCard(2, "Adult Case Sheet (ATLS-based)", "7 tabs covering the full ATLS primary and secondary survey", [
  "Tap through the 7 tabs: Patient · History · Primary Survey · Examination · Treatment · Notes · Disposition.",
  "Switch between Medical mode and Trauma mode using the toggle at the top of any tab.",
  "All tabs auto-save as you type — there is no manual save needed until you tap Commit at the end.",
  "On the Patient tab, edit any vital inline — abnormal values are highlighted in red.",
], false, C.indigo);

featureCard(3, "Pediatric Case Sheet (PALS-based)", "Auto-routed for patients aged 16 years or younger", [
  "ErMate automatically opens the Pediatric Case Sheet when the patient's age is ≤ 16 years.",
  "Normal reference ranges shown in each vital field are adjusted for the child's age.",
  "Includes developmental history, weight-based dosing references, and PALS primary survey.",
  "All 7 tabs work identically to the adult sheet — with age-appropriate content.",
], false, C.pink);

newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.indigo);
doc.moveDown(1);

featureCard(4, "Smart Dictation", "Talk naturally — ErMate fills the entire case sheet", [
  "Open any case sheet and go to the Patient tab.",
  "Tap the microphone icon (Speak This Case).",
  "Dictate the full history, examination findings, and management plan in natural speech — as if presenting the case to a colleague.",
  "Tap Stop when finished. Sarvam AI transcribes the audio, and GPT-4o maps the data to every relevant field across all 7 tabs.",
  "Review the pre-filled fields and tap Apply to confirm.",
], false, C.primary);

featureCard(5, "Dictation Completion Map", "See exactly which tabs and fields were captured", [
  "After tapping Apply on a dictation session, the Completion Sheet appears automatically.",
  "A colour-coded bar for each tab shows how many fields were filled: Green (≥75%), Amber (partial), Red (empty).",
  "Tap Review Gaps to jump directly to the first tab with missing information.",
  "Coloured dots persist on each tab button in the case sheet so you always know where gaps remain.",
], true, C.primary);

featureCard(6, "Document Scanning", "Photograph a referral letter or printed report — ErMate reads it", [
  "Inside any open case sheet, tap the scan icon in the top bar.",
  "Take a photo with your camera, or pick an existing image from your gallery.",
  "Sarvam Vision OCR reads the text from the document.",
  "GPT-4o extracts and structures the clinical data, then populates the relevant fields.",
], false, C.amber);

featureCard(7, "Clinical Decision Support", "AI differential diagnoses with evidence citations", [
  "Go to the Disposition tab of any open case sheet.",
  "Scroll to the AI Clinical Decision Support section and tap Generate.",
  "A ranked list of differentials appears, each labelled CONSISTENT, POSSIBLE, or LESS LIKELY.",
  "Each diagnosis includes PubMed and WikEM citations for reference.",
  "Tap Add to Case to include a diagnosis in the documentation, or Exclude to dismiss it.",
], false, C.indigo);

newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.indigo);
doc.moveDown(1);

featureCard(8, "Discharge Summary", "AI-generated, exportable as PDF or DOCX", [
  "Go to the Disposition tab → tap Generate Discharge Summary.",
  "The AI assembles all documented data into a structured summary.",
  "Review and edit any section directly in the text editor.",
  "Tap Export → choose PDF or DOCX to save or share the document.",
], false, C.sky);

featureCard(9, "Quick Case Sheet", "Skip triage for fast-track or pre-triaged patients", [
  "From the Dashboard, tap New Patient → Quick Case Sheet.",
  "Enter just the patient's name and chief complaint.",
  "The full case sheet opens immediately — no triage form required.",
  "Ideal for low-acuity walk-ins or patients already triaged by a nurse.",
], false, C.amber);

// ═══════════════════════════════════════════════════════════
// SECTION 2 — TEAM & SHIFTS
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 40).fill(C.primary);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(18).text("Team & Shift Management", 60, 12);
doc.fillColor("#a7f3d0").font("Helvetica").fontSize(10).text("Coordinate your ER team across shifts in real time", 60, 26);
doc.moveDown(1.5);

featureCard(10, "Department Setup", "HOD creates and manages the ER team (one-time setup)", [
  "Open the Profile tab → tap Set Up Department.",
  "Enter your department name, hospital name, and city.",
  "Add shift schedules: choose Morning, Evening, or Night; set start/end times and the maximum number of consultant and resident slots.",
  "Tap Create — your department is live.",
  "Share the invite link via WhatsApp or copy-paste to onboard your team.",
], false, C.indigo);

featureCard(11, "Shift Check-In", "Start your shift with one tap — slots tracked in real time", [
  "When you open ErMate during a shift window, the Shift Selection screen appears automatically.",
  "Choose the correct shift (Morning / Evening / Night).",
  "You will see live slot counts — e.g., '2 of 3 consultant slots filled'.",
  "Tap Start Shift — a green shift banner appears on your Dashboard.",
  "Tap Check Out on the banner when your shift ends.",
], true, C.primary);

featureCard(12, "Shift-Aware Case View", "Consultants see all cases currently on the shift", [
  "When you are checked in as a Consultant or HOD, go to the Cases tab.",
  "A SHIFT CASES section appears above your own cases.",
  "Cases are colour-coded by triage priority (red P1, orange P2, etc.) with doctor name and role badges.",
  "The list refreshes every 30 seconds automatically.",
], true, C.indigo);

featureCard(13, "Consultant Review", "Review and annotate a resident's case", [
  "In the SHIFT CASES section, tap any case from a resident.",
  "A review modal opens showing the resident's documentation.",
  "Write your clinical review notes in the text field.",
  "Tap Save Review — the case is marked Reviewed with a green badge visible to everyone on the shift.",
], true, C.primary);

newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.primary);
doc.moveDown(1);

featureCard(14, "HOD Dashboard", "Live overview of every shift across the entire ER", [
  "Profile tab → tap HOD Dashboard (visible to HODs only).",
  "See slot counts per shift (consultants in / max, residents in / max).",
  "View a live list of all doctors currently on shift, with their role and how long they have been on duty.",
  "See all active cases across every shift in a single scrollable list.",
  "Tap Force Out next to any doctor to end their shift session remotely.",
], true, C.amber);

featureCard(15, "Handover Sheet", "Structured patient handover at shift change", [
  "From the Dashboard, tap Handover Sheet.",
  "Select the cases you are handing over using the checkboxes.",
  "Add pending tasks, outstanding investigations, or clinical notes for each case.",
  "Tap Export PDF to generate a printable or shareable handover document.",
  "Incoming handovers from previous doctors appear in Profile → Incoming Handovers.",
], false, C.sky);

featureCard(16, "Manage Roster", "HOD manages the active team list", [
  "Profile → HOD Dashboard → Manage Roster.",
  "View all team members with their name, email, role, and current on-shift status.",
  "Tap Add Member to invite via the shareable link — regenerate the link if needed.",
  "Tap Remove next to a member to remove them from the roster immediately.",
], false, C.indigo);

// ═══════════════════════════════════════════════════════════
// SECTION 3 — LEARN
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 40).fill(C.amber);
doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(18).text("Learning", 60, 12);
doc.fillColor("#78350f").font("Helvetica").fontSize(10).text("Simulation, EM reference, and case-based quizzes", 60, 26);
doc.moveDown(1.5);

featureCard(17, "Simulation-Based Teaching", "Interactive clinical cases with evolving vitals", [
  "Go to the Learn tab → tap Simulation-Based Teaching.",
  "Choose a scenario from the list (e.g., Chest Pain, Polytrauma, Paediatric Fever).",
  "You are presented with a patient — vitals, history, and initial findings.",
  "Make management decisions at each branch point; vitals and results update to reflect your choices.",
  "A debrief at the end explains the ideal management pathway.",
], false, C.indigo);

featureCard(18, "EM Reference Library", "AI-powered emergency medicine guideline chat", [
  "Learn tab → EM Reference Library.",
  "Type any clinical question — e.g., 'RSI dose for septic shock' or 'STEMI equivalents'.",
  "Responses are grounded in EM guidelines with PubMed literature citations.",
  "Scroll back through your conversation history within the session.",
], false, C.sky);

featureCard(19, "Trivia Time", "Case-based MCQs with a weekly streak", [
  "Learn tab → Trivia Time.",
  "Choose the number of questions and difficulty level.",
  "Answer case-based multiple-choice questions with a timer.",
  "The score card shows your result and your current weekly streak (resets each Monday).",
  "Complete at least one quiz per week to keep your streak alive.",
], false, C.amber);

// ═══════════════════════════════════════════════════════════
// SECTION 4 — TOOLS
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 40).fill(C.sky);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(18).text("Tools & Productivity", 60, 12);
doc.fillColor("#bae6fd").font("Helvetica").fontSize(10).text("Calculators, stats, display modes, and more", 60, 26);
doc.moveDown(1.5);

featureCard(20, "Pediatric Drug Calculator", "Weight-based emergency drug doses instantly", [
  "Dashboard → Pediatric Drug Calculator.",
  "Enter the child's weight in kilograms.",
  "Calculated doses appear for: Adrenaline, Atropine, Adenosine, Fluid Bolus (NS/RL), Dextrose, Midazolam, and more.",
  "All doses follow standard paediatric emergency medicine guidelines.",
], false, C.pink);

featureCard(21, "My Weekly Stats", "Track time saved vs paper documentation", [
  "Dashboard → My Weekly Stats card, or Profile → My Stats.",
  "See the number of cases documented this week.",
  "Estimated time saved vs paper is calculated at an average of 14 minutes saved per case.",
  "View your top presenting complaints this week and all-time case total.",
], false, C.primary);

featureCard(22, "Cases by Complaint", "Group your cases by presenting complaint", [
  "Go to the Cases tab.",
  "Tap the toggle icon in the top-right corner to switch to 'By Complaint' view.",
  "Cases are grouped by chief complaint, with the most frequent complaint listed first.",
  "Tap any group to expand and see all cases with that complaint.",
], false, C.indigo);

newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.sky);
doc.moveDown(1);

featureCard(23, "Night Shift Display Mode", "Automatic dark mode to protect your eyes on nights", [
  "ErMate automatically switches to dark mode between 9:00 PM and 6:00 AM.",
  "To override: Profile → Display Mode → choose Always Light or Always Dark.",
  "Always Light is useful if your phone screen brightness is manually controlled.",
  "The setting persists across app restarts.",
], false, "#1e293b");

featureCard(24, "Link to Web", "Use ErMate on a desktop browser", [
  "On your phone: Profile → Link to Web — a 6-digit code is displayed.",
  "On your desktop: Visit er-mate.replit.app → tap Link Device → enter the 6-digit code, or scan the QR code shown on the web login page.",
  "Your phone session transfers to the browser instantly — no second login needed.",
  "Ideal for typing up longer case notes or viewing the HOD dashboard on a larger screen.",
], false, C.sky);

featureCard(25, "Privacy & Data Control", "You own and control your patient data", [
  "Profile → Privacy to view the full Privacy Policy.",
  "Control data sharing preferences and biometric lock from the Privacy screen.",
  "All AI processing (dictation, OCR, decision support) is disclosed in the policy.",
  "To request data deletion: Profile → Privacy → Request Data Deletion → confirm via email.",
], false, C.indigo);

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.primary);

doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(18).text("Subscription Plans & AI Credits", 60, 28);
doc.moveDown(0.8);

const plans = [
  { name: "Free Plan", color: C.muted, features: ["Up to 10 cases total", "All manual documentation tabs", "No AI credits included"] },
  { name: "Base Plan", color: C.primary, features: ["Unlimited case documentation", "20 AI credits per month (roll over indefinitely)", "All 7 clinical tabs, shift features, and export tools"] },
  { name: "AI Credit Packs", color: C.indigo, features: ["Purchase additional AI credits at any time", "Credits never expire", "Used for: Smart Dictation, Clinical Decision Support, Document Scanning, EM Reference, AI Discharge Summaries"] },
];

plans.forEach((plan) => {
  const y = doc.y;
  const h = 20 + plan.features.length * 16 + 14;
  doc.roundedRect(60, y, CONTENT_W, h, 8).fill(plan.color + "10");
  doc.rect(60, y, 5, h).fill(plan.color);
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(12).text(plan.name, 74, y + 8);
  plan.features.forEach((feat, i) => {
    doc.fillColor(plan.color).font("Helvetica-Bold").fontSize(9).text("·", 76, y + 24 + i * 16, { lineBreak: false });
    doc.fillColor(C.mid).font("Helvetica").fontSize(9).text(feat, 86, y + 24 + i * 16, { width: CONTENT_W - 30 });
  });
  doc.y = y + h + 10;
});

doc.moveDown(0.6);
doc.roundedRect(60, doc.y, CONTENT_W, 34, 6).fill("#fefce8");
doc.rect(60, doc.y, 4, 34).fill(C.amber);
doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(9.5).text("How to upgrade", 72, doc.y + 4, { lineBreak: false });
const tipY = doc.y + 4;
doc.fillColor(C.mid).font("Helvetica").fontSize(9)
  .text("Profile → Upgrade Plan — or tap the lock icon that appears when an AI credit is required.", 72, tipY + 14, { width: CONTENT_W - 20 });
doc.y = tipY + 40;

// ═══════════════════════════════════════════════════════════
// TIPS & TROUBLESHOOTING
// ═══════════════════════════════════════════════════════════
newPage(C.white);
doc.rect(0, 0, doc.page.width, 6).fill(C.primary);

doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(18).text("Tips & Troubleshooting", 60, 28);
doc.moveDown(0.8);

const tips = [
  ["Backend slow on first login", "The backend server may take 30–60 seconds to wake up after a period of inactivity. Simply wait and retry — subsequent logins are instant."],
  ["Dictation not transcribing", "Ensure your microphone permission is granted: phone Settings → ErMate (or Expo Go) → Microphone → Allow. Also check your internet connection."],
  ["Shift Check-In not appearing", "The Shift Selection screen only appears during a configured shift window. Ask your HOD to confirm the shift start/end times are set correctly in Department Setup."],
  ["Case not appearing in Shift Cases", "Shift Cases are populated after tapping Commit on a case sheet. Draft cases that have not been committed will not appear."],
  ["HOD Dashboard shows wrong names", "Ensure all team members joined via the department invite link and have their name entered in their profile. Raw user IDs appear only if name is not yet set."],
  ["AI features locked or greyed out", "AI actions consume credits. Check your remaining balance under Profile → My Subscriptions. Purchase a credit pack to continue."],
  ["Discharge Summary export fails", "Ensure the Disposition tab has a documented assessment. The AI requires at least a chief complaint and one clinical finding to generate the summary."],
  ["Dark mode not switching automatically", "Check Profile → Display Mode is set to Auto. If a custom override was set previously, reset it to Auto to restore the 9 PM–6 AM automatic rule."],
  ["Link to Web code expired", "The 6-digit code expires after a few minutes. Generate a new code from Profile → Link to Web and use it promptly."],
];

tips.forEach(([q, a]) => {
  const y = doc.y;
  if (y > doc.page.height - 80) { doc.addPage(); doc.rect(0, 0, doc.page.width, 6).fill(C.primary); doc.y = 30; }
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(10).text(q, 60, doc.y, { width: CONTENT_W });
  doc.fillColor(C.mid).font("Helvetica").fontSize(9.5).text(a, 60, doc.y, { width: CONTENT_W });
  doc.moveDown(0.7);
});

// ═══════════════════════════════════════════════════════════
// BACK COVER
// ═══════════════════════════════════════════════════════════
newPage(C.dark);
doc.opacity(0.07).circle(300, 400, 250).fill(C.primary).opacity(1);

doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(28).text("ErMate", 60, 280, { align: "center", width: CONTENT_W });
doc.fillColor("#94a3b8").font("Helvetica").fontSize(11).text("Emergency Room EMR by Varah Group", 60, 316, { align: "center", width: CONTENT_W });
doc.moveDown(0.8);
doc.fillColor("#475569").font("Helvetica").fontSize(9.5).text("For support, contact us at er-mate.replit.app", 60, doc.y, { align: "center", width: CONTENT_W });

// ── Page numbers ───────────────────────────────────────────
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  if (i === 0 || i === totalPages - 1) continue; // skip cover & back
  doc.fillColor(C.muted).font("Helvetica").fontSize(8)
    .text(`ErMate User Guide  ·  Page ${i + 1} of ${totalPages}`, 60, doc.page.height - 36, { width: CONTENT_W, align: "center" });
}

doc.end();
console.log("PDF generated:", OUT);
