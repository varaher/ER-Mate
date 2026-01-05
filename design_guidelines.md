# ErMate - Emergency Room EMR Design Guidelines

## App Architecture

### Authentication
**Auth Required** - Medical application with:
- SSO preferred (Apple Sign-In for iOS, Google Sign-In for Android)
- Email/password as fallback
- Mock auth flow in prototype
- Login/signup screens with privacy policy & terms links
- Profile screen with:
  - User name and role (Doctor/Resident)
  - Hospital affiliation
  - Account settings
  - Log out (with confirmation)
  - Delete account (nested under Settings > Account > Delete, double confirmation)

### Navigation Structure
**Tab Navigation** (5 tabs with center action button):
1. **Dashboard** - Patient overview, today's cases
2. **Cases** - All active cases list
3. **New Patient** (Center FAB) - Start triage flow
4. **Logs** - Case history and analytics
5. **Profile** - User settings and subscription

**Modal Stacks**:
- Triage Flow: Triage → Case Sheet → Physical Exam → Investigations → Treatment → Disposition → Discharge Summary
- Each step is a separate modal that can be navigated sequentially

## Screen Specifications

### Dashboard Screen
- **Header**: Custom transparent header
  - Left: ErMate logo + medical icon
  - Right: Logs button, Profile avatar
  - Welcome message with user name
- **Layout**: Scrollable root view
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**:
  - Large "New Patient" CTA card with floating shadow
  - Stats cards row (4 cards: Today, Critical, Pending, Done)
  - Patient list with priority indicators, time-in-ER badges
  - Floating refresh control

### Triage Screen
- **Header**: Default navigation header with back button
- **Layout**: Scrollable form
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**:
  - Patient info fields (auto-fill defaults)
  - Vitals input with pediatric age-based ranges
  - Symptom checkboxes with visual hierarchy
  - Voice recording button (floating)
  - Priority level badge (auto-calculated)
  - Save & Continue button

### Case Sheet Screen
- **Header**: Custom with patient name, case ID
  - Right button: Voice dictation toggle
- **Layout**: Scrollable with collapsible sections
  - ABCDE assessment sections
  - Each section expands/collapses
  - Floating save button
- **Components**:
  - Dropdowns for examination findings
  - Text areas for notes
  - Voice input integration
  - VBG interpretation with AI insights

### Physical Examination Screen
- **Header**: Default with back and save buttons
- **Layout**: Scrollable form with system-based sections
  - General, CVS, Respiratory, Abdomen, CNS, MSK
  - Auto-fill "Normal" button per section
- **Components**:
  - Dropdown selects for findings
  - Switch toggles for yes/no findings
  - Text areas for additional notes
  - Voice dictation per section

### Investigations Screen
- **Header**: Default navigation
- **Layout**: Grid view with categories
  - Basic Labs, Cardiac, Imaging, etc.
- **Components**:
  - Chip-style test selectors (toggle on/off)
  - Custom test input field
  - Results notes text area
  - Selected tests summary card

### Treatment Screen (AI-Powered)
- **Header**: Default with AI credits badge
- **Layout**: Scrollable form
- **Components**:
  - Provisional diagnosis field
  - Differential diagnoses list
  - AI suggestion buttons (Red Flags, Diagnosis AI)
  - Medication selector grid
  - Interventions checklist
  - AI modal for suggestions
  - Usage limit indicator

### Disposition Screen
- **Header**: Default navigation
- **Layout**: Form with disposition type selector
- **Components**:
  - Large disposition type cards (Discharged, Admitted ICU/HDU/Ward, Referred, DAMA, Death)
  - Condition at discharge radio buttons
  - Discharge advice fields
  - Attending doctors fields
  - Complete Case button (prominent)

### Discharge Summary Screen
- **Header**: Default with Print/Share buttons
- **Layout**: Scrollable document view
  - Editable fields with useRef pattern
  - Auto-populated from case data
- **Components**:
  - Patient demographics section
  - Course in ER (auto-generated)
  - Examination summary
  - Investigations summary
  - Treatment and medications
  - Discharge vitals
  - Follow-up advice

### Upgrade/Subscription Screen
- **Header**: Default with back button
- **Layout**: Scrollable with tabs
  - Plans tab, Credits tab
- **Components**:
  - Current subscription status card
  - Plan cards with feature lists
  - "Popular" and "Best Value" badges
  - Credit pack cards
  - Select plan buttons

## Design System

### Color Palette
**Primary Blues** (Medical/Professional):
- Primary: `#2563eb`
- Dark: `#1e40af`
- Light: `#eff6ff`

**Status Colors**:
- Critical Red: `#dc2626` / `#ef4444`
- Warning Orange: `#f97316`
- Caution Yellow: `#eab308`
- Success Green: `#22c55e`
- Info Blue: `#3b82f6`

**Triage Priority Colors**:
- Red (Level 1): `#ef4444`
- Orange (Level 2): `#f97316`
- Yellow (Level 3): `#eab308`
- Green (Level 4): `#22c55e`
- Blue (Level 5): `#3b82f6`

**Neutrals**:
- Dark: `#1e293b`, `#475569`
- Mid: `#64748b`, `#94a3b8`
- Light: `#cbd5e1`, `#e2e8f0`, `#f1f5f9`, `#f8fafc`

### Typography
- **Headers**: 18-20px, weight 800
- **Section Titles**: 15-16px, weight 700
- **Body**: 14px, weight 400-500
- **Labels**: 13px, weight 600
- **Small Text**: 12px, weight 400

### Visual Design
- **NO EMOJIS** in critical UI elements (use emojis only in plan cards for personality)
- Use Ionicons from `@expo/vector-icons`
- Cards: 12px border radius, 1px border, subtle elevation
- Buttons: 10-12px border radius, clear hierarchy
- **Floating Action Buttons**: Use subtle drop shadow:
  - shadowOffset: { width: 0, height: 2 }
  - shadowOpacity: 0.10
  - shadowRadius: 2
- Touch feedback: All buttons have visual press states (opacity or background color change)

### Critical Assets
**Generate these custom assets**:
1. **ErMate Logo Icon** - Medical cross + ER symbol in primary blue
2. **Priority Level Badges** - Color-coded circular badges (Red/Orange/Yellow/Green/Blue)
3. **Status Icons** - Critical, Stable, Discharged status indicators

**Standard Icons** (use Ionicons):
- Navigation: arrow-back, chevron-forward, menu
- Actions: add, save, checkmark-circle, close-circle
- Medical: medical, pulse, thermometer, bandage
- Features: mic, document-text, search, notifications

### Accessibility
- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for text
- Critical alerts: Use both color AND icon/text
- Screen reader labels for all interactive elements
- Vitals outside normal range: Visual alert (color) + text indicator
- Time-sensitive warnings (>4 hours in ER): Red border + clock icon

### Special Considerations
**Medical Context**:
- Clear visual hierarchy for critical vs. routine information
- Priority-based color coding throughout
- Time-in-ER prominently displayed on patient cards
- Quick-access FAB for emergency workflows
- Confirmation dialogs for destructive actions (delete, DAMA discharge)
- AI features clearly marked with credits remaining
- Subscription limits shown proactively before hitting wall