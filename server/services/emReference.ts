import OpenAI from "openai";

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) return null;
  return new OpenAI({ apiKey, baseURL });
}

export interface EMReferenceMessage {
  role: "user" | "assistant";
  content: string;
}

const EM_SYSTEM_PROMPT = `You are an expert Emergency Medicine reference assistant for doctors and residents. Your role is to provide accurate, evidence-based clinical information for emergency medicine practice.

RESPONSE GUIDELINES:
1. Provide concise, clinically actionable answers organized with clear headings and bullet points.
2. Always cite standard emergency medicine textbooks and guidelines as references at the end.
3. Use markdown formatting: **bold** for key terms, bullet points for lists, numbered steps for protocols.
4. Include diagnostic criteria, management algorithms, and disposition guidelines when relevant.
5. For drug doses, always specify adult vs pediatric doses with weight-based calculations where applicable.
6. Mention red flags, critical actions, and time-sensitive interventions prominently.
7. Keep language professional but accessible for medical practitioners.

REFERENCE SOURCES (cite these when applicable):
- Tintinalli's Emergency Medicine (9th Edition)
- Rosen's Emergency Medicine (10th Edition)
- Roberts & Hedges' Clinical Procedures in Emergency Medicine (7th Edition)
- ATLS - Advanced Trauma Life Support (10th Edition)
- PALS - Pediatric Advanced Life Support
- ACLS - Advanced Cardiovascular Life Support
- Harrison's Principles of Internal Medicine (21st Edition)
- Nelson Textbook of Pediatrics (21st Edition)
- Schwartz's Principles of Surgery (11th Edition)
- UpToDate Clinical Decision Support
- Surviving Sepsis Campaign Guidelines (2021)
- AHA/ACC Guidelines
- WHO Guidelines (where applicable)
- NICE Guidelines (where applicable)
- National Emergency Medicine Guidelines

FORMAT:
- Start with a brief 1-2 line overview/definition
- Then provide structured content with clear sections
- End with "References:" section listing 2-4 most relevant sources used
- Keep total response focused and practical (not excessively long)`;

export async function getEMReferenceResponse(
  messages: EMReferenceMessage[],
  topic?: string
): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    return "AI service is not configured. Please check the setup.";
  }

  const systemContent = topic
    ? `${EM_SYSTEM_PROMPT}\n\nThe user is asking about the topic: "${topic}". Provide focused, detailed information.`
    : EM_SYSTEM_PROMPT;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    console.error("[EMReference] Error:", error);
    return "An error occurred while generating the response. Please try again.";
  }
}

export const EM_TOPICS = {
  core_knowledge: {
    title: "Core Knowledge",
    icon: "book",
    topics: [
      "Sepsis", "Shock", "Anaphylaxis", "Fluid & Blood Therapy",
      "DKA & HHS", "Stroke", "TIA", "Intracranial Bleed",
      "Seizure & Status Epilepticus", "Trauma Management Approach",
      "Head Injury Management", "Cervical Spine Injury Management",
      "COPD & Asthma", "Pneumonia", "Pneumothorax",
      "GI Bleed", "Pancreatitis", "Appendicitis", "Cholecystitis", "Jaundice",
      "Urinary Tract Infection", "Acute Kidney Injury",
      "Pediatric Assessment", "Fever & SBI in Children",
      "ARI & Wheezing in Children", "UTI in Children", "Seizure in Children",
      "Pulmonary Embolism", "Aortic Dissection", "Esophageal Rupture",
      "Hand & Wrist Injuries", "Elbow & Ankle Injuries",
      "Ectopic Pregnancy", "Eclampsia", "PID", "Postpartum Cardiomyopathy",
      "Toxidromes", "Eye Emergencies", "Ear Emergencies", "Dental Emergencies",
      "Neonatal Resuscitation", "Sickle Cell Disease", "Anemias",
      "Thyroid Storm", "Adrenal Crisis",
    ],
  },
  symptomatology: {
    title: "Symptomatology",
    icon: "thermometer",
    topics: [
      "Headache", "Chest Pain", "Abdominal Pain", "Breathlessness",
      "Back Pain", "Altered Mental Status", "Dizziness & Vertigo", "Fever",
    ],
  },
  basic_physiology: {
    title: "Basic Physiology",
    icon: "heart",
    topics: [
      "Lung Physiology", "Cardiac Physiology", "Renal Physiology",
      "Sodium - Hypo/Hypernatremia", "Potassium - Hypo/Hyperkalemia",
      "Calcium - Hypo/Hypercalcemia", "Acid-Base Disorders",
      "Coagulation Pathway & Abnormalities",
    ],
  },
  procedures: {
    title: "Procedures",
    icon: "tool",
    topics: [
      "IV & IO Access", "Central Line Insertion", "Arterial Line",
      "Airway Management", "Surgical Airway / Cricothyrotomy",
      "Cardiac Pacing", "Chest Tube / Intercostal Drain",
      "Reducing Dislocations", "Splinting Techniques",
      "Wound Management", "Procedural Sedation",
      "Thoracotomy", "Mechanical Ventilation",
    ],
  },
  skills: {
    title: "Clinical Skills",
    icon: "activity",
    topics: [
      "ECG Analysis", "ABG Analysis", "Chest X-Ray Interpretation",
      "Abdominal X-Ray Interpretation", "CT Head Interpretation",
      "Echocardiography Basics", "Bedside Ultrasound / POCUS",
      "ENS Examination", "CVS Examination", "Respiratory Examination",
      "Abdomen Examination", "Shoulder Examination",
      "Hand Examination", "Knee Examination",
    ],
  },
};
