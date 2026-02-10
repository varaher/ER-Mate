export interface PediatricDrug {
  name: string;
  genericName?: string;
  category: string;
  subcategory?: string;
  doses: DoseInfo[];
  routes: string[];
  maxDose?: string;
  ageRestriction?: string;
  warnings?: string[];
  reference: string;
}

export interface DoseInfo {
  indication?: string;
  dosePerKg: string;
  unit: string;
  frequency: string;
  route: string;
  duration?: string;
  notes?: string;
  isLoadingDose?: boolean;
}

export interface DrugCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  drugs: PediatricDrug[];
}

const analgesics: PediatricDrug[] = [
  {
    name: "Paracetamol",
    genericName: "Acetaminophen",
    category: "Analgesics & Antipyretics",
    doses: [
      { indication: "Antipyretic / Analgesic", dosePerKg: "15", unit: "mg/kg/dose", frequency: "Q6H PRN", route: "PO/IV/PR" },
      { indication: "IM", dosePerKg: "5", unit: "mg/kg", frequency: "As needed", route: "IM" },
    ],
    routes: ["PO", "IV", "PR", "IM"],
    maxDose: "60 mg/kg/day",
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ibuprofen",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "10-15", unit: "mg/kg/dose", frequency: "Q6-8H", route: "PO" },
    ],
    routes: ["PO"],
    maxDose: "40 mg/kg/day",
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Nimesulide",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "5", unit: "mg/kg/day", frequency: "BD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Indomethacin",
    category: "Analgesics & Antipyretics",
    doses: [
      { indication: "Anti-inflammatory", dosePerKg: "3", unit: "mg/kg/day", frequency: "Daily", route: "PO" },
      { indication: "Ductus closure", dosePerKg: "0.2", unit: "mg/kg", frequency: "As per protocol", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Mefenamic Acid",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "3", unit: "mg/kg/dose", frequency: "As needed", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Naproxen",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "5-7", unit: "mg/kg/dose", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Diclofenac",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "1-3", unit: "mg/kg/day", frequency: "Q8H", route: "PO/IM" },
    ],
    routes: ["PO", "IM"],
    reference: "BNF for Children",
  },
  {
    name: "Codeine Phosphate",
    category: "Analgesics & Antipyretics",
    doses: [
      { indication: "Pain", dosePerKg: "3", unit: "mg/kg/day", frequency: "Divided doses", route: "PO" },
      { indication: "Antitussive", dosePerKg: "0.2", unit: "mg/kg/dose", frequency: "As needed", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Risk of respiratory depression in ultra-rapid metabolizers", "Avoid in children <12 years for cough/cold"],
    reference: "BNF for Children",
  },
  {
    name: "Aspirin",
    genericName: "Acetyl Salicylic Acid",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "30-65", unit: "mg/kg", frequency: "Q6H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Avoid in viral illness due to risk of Reye syndrome"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Pentazocine",
    category: "Analgesics & Antipyretics",
    doses: [
      { dosePerKg: "0.5-1.0", unit: "mg/kg/day", frequency: "Q4H", route: "PO/IV/IM" },
    ],
    routes: ["PO", "IV", "IM"],
    reference: "Harriet Lane Handbook",
  },
];

const antibioticsAminoglycosides: PediatricDrug[] = [
  {
    name: "Amikacin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { dosePerKg: "15-20", unit: "mg/kg/day", frequency: "Q12H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    warnings: ["Monitor renal function and drug levels", "Ototoxicity risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Gentamicin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { dosePerKg: "5.0-7.5", unit: "mg/kg/day", frequency: "Q12H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    warnings: ["Monitor renal function and drug levels", "Ototoxicity risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Kanamycin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { dosePerKg: "15", unit: "mg/kg/day", frequency: "Q12H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    warnings: ["Nephrotoxicity", "Ototoxicity"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Netilmicin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { indication: "Infant", dosePerKg: "7.5-10", unit: "mg/kg/day", frequency: "Q12H", route: "IV/IM" },
      { indication: "Child", dosePerKg: "5.0-7.5", unit: "mg/kg/day", frequency: "Q12H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    warnings: ["Monitor renal function"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Streptomycin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { dosePerKg: "15-20", unit: "mg/kg/day", frequency: "OD", route: "IM" },
    ],
    routes: ["IM"],
    warnings: ["Ototoxicity", "Nephrotoxicity"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Tobramycin",
    category: "Antibiotics",
    subcategory: "Aminoglycosides",
    doses: [
      { dosePerKg: "6.0-7.5", unit: "mg/kg/day", frequency: "Q8H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    warnings: ["Monitor renal function and drug levels"],
    reference: "Harriet Lane Handbook",
  },
];

const antibioticsCephalosporins: PediatricDrug[] = [
  {
    name: "Cefaclor",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "20-40", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Cefadroxil",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "30", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cefdinir",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "14", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cefepime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "100-150", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cefixime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "8", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Cefoperazone",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "50-200", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Cefotaxime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "100-150", unit: "mg/kg/day", frequency: "Q8H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cefpirome",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "30-60", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Cefpodoxime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "8-10", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Cefprozil",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "15-30", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ceftazidime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "100-150", unit: "mg/kg/day", frequency: "Q8H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ceftibuten",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "9", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ceftizoxime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "100-150", unit: "mg/kg/day", frequency: "Q8H", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Ceftriaxone",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { indication: "Standard", dosePerKg: "50-75", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
      { indication: "Meningitis", dosePerKg: "100", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cefuroxime",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { indication: "Oral", dosePerKg: "20-30", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "50-100", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "BNF for Children",
  },
  {
    name: "Cephalexin",
    category: "Antibiotics",
    subcategory: "Cephalosporins",
    doses: [
      { dosePerKg: "25-50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
];

const antibioticsFluoroquinolones: PediatricDrug[] = [
  {
    name: "Ciprofloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { indication: "Oral", dosePerKg: "20-30", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "10-20", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Use with caution in growing children - risk of arthropathy"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Gatifloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "10", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Levofloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "10-15", unit: "mg/kg/day", frequency: "OD", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Nalidixic Acid",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Norfloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "10-15", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Ofloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { indication: "Oral", dosePerKg: "15", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "5-10", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Pefloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "12", unit: "mg/kg/day", frequency: "Q12H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Suprafloxacin",
    category: "Antibiotics",
    subcategory: "Fluoroquinolones",
    doses: [
      { dosePerKg: "4", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antibioticsMacrolides: PediatricDrug[] = [
  {
    name: "Azithromycin",
    category: "Antibiotics",
    subcategory: "Macrolides",
    doses: [
      { dosePerKg: "10", unit: "mg/kg/day", frequency: "OD", route: "PO", duration: "3-5 days" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Clarithromycin",
    category: "Antibiotics",
    subcategory: "Macrolides",
    doses: [
      { dosePerKg: "15", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Erythromycin",
    category: "Antibiotics",
    subcategory: "Macrolides",
    doses: [
      { indication: "Oral", dosePerKg: "30-50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "5", unit: "mg/kg/dose", frequency: "Q8H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Roxithromycin",
    category: "Antibiotics",
    subcategory: "Macrolides",
    doses: [
      { dosePerKg: "5-8", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antibioticsPenicillins: PediatricDrug[] = [
  {
    name: "Amoxicillin",
    category: "Antibiotics",
    subcategory: "Penicillins",
    doses: [
      { dosePerKg: "25-50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Amoxicillin + Clavulanate",
    genericName: "Co-amoxiclav",
    category: "Antibiotics",
    subcategory: "Penicillins",
    doses: [
      { indication: "Oral", dosePerKg: "20-40", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "50-100", unit: "mg/kg/day", frequency: "Q8H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ampicillin",
    category: "Antibiotics",
    subcategory: "Penicillins",
    doses: [
      { dosePerKg: "100-200", unit: "mg/kg/day", frequency: "Q8H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Cloxacillin",
    category: "Antibiotics",
    subcategory: "Penicillins",
    doses: [
      { indication: "Standard", dosePerKg: "50-100", unit: "mg/kg/day", frequency: "Q8H", route: "PO/IV" },
      { indication: "Meningitis", dosePerKg: "200", unit: "mg/kg/day", frequency: "Q8H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Penicillin G Benzathine",
    category: "Antibiotics",
    subcategory: "Penicillins",
    doses: [
      { indication: "<6 years", dosePerKg: "0.6 mega unit", unit: "IM", frequency: "Weekly", route: "IM" },
      { indication: ">6 years", dosePerKg: "0.6 mega unit", unit: "IM", frequency: "Weekly", route: "IM" },
    ],
    routes: ["IM"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antibioticsOthers: PediatricDrug[] = [
  {
    name: "Clindamycin",
    category: "Antibiotics",
    subcategory: "Others",
    doses: [
      { indication: "Oral", dosePerKg: "20-30", unit: "mg/kg/day", frequency: "BD", route: "PO" },
      { indication: "Parenteral", dosePerKg: "20-40", unit: "mg/kg/day", frequency: "BD", route: "IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Tetracycline",
    category: "Antibiotics",
    subcategory: "Others",
    doses: [
      { dosePerKg: "25-50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    ageRestriction: ">8 years only",
    warnings: ["Contraindicated in children <8 years - causes teeth staining"],
    reference: "BNF for Children",
  },
  {
    name: "Vancomycin",
    category: "Antibiotics",
    subcategory: "Others",
    doses: [
      { indication: "Standard IV", dosePerKg: "40", unit: "mg/kg/day", frequency: "Q8H", route: "IV", notes: "Infuse over 60 min" },
      { indication: "CNS infection", dosePerKg: "60", unit: "mg/kg/day", frequency: "Q8H", route: "IV" },
      { indication: "Pseudomembranous colitis", dosePerKg: "40-50", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["IV", "PO"],
    warnings: ["Red man syndrome if infused too rapidly", "Monitor trough levels"],
    reference: "Harriet Lane Handbook",
  },
];

const antiLeprosy: PediatricDrug[] = [
  {
    name: "Dapsone",
    genericName: "Diamino diphenyl Sulphone",
    category: "Anti-Leprosy",
    doses: [
      { dosePerKg: "1-2", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Monitor for hemolytic anemia", "G6PD deficiency screening recommended"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiMalarial: PediatricDrug[] = [
  {
    name: "Artemether",
    category: "Anti-Malarial",
    doses: [
      { indication: "Loading", dosePerKg: "3.2", unit: "mg/kg", frequency: "Stat", route: "IM", isLoadingDose: true },
      { indication: "Maintenance", dosePerKg: "1.6", unit: "mg/kg", frequency: "Daily", route: "IM/PO", duration: "5 days" },
    ],
    routes: ["IM", "PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Artesunate",
    category: "Anti-Malarial",
    doses: [
      { indication: "Parenteral", dosePerKg: "4", unit: "mg/kg/day", frequency: "Daily", route: "IV/IM", duration: "3 days" },
      { indication: "Oral loading", dosePerKg: "5", unit: "mg/kg", frequency: "Stat", route: "PO", isLoadingDose: true },
      { indication: "Oral maintenance", dosePerKg: "2.5", unit: "mg/kg", frequency: "Daily", route: "PO", duration: "Day 2-3" },
    ],
    routes: ["IV", "IM", "PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Chloroquine",
    category: "Anti-Malarial",
    doses: [
      { indication: "Treatment loading", dosePerKg: "10", unit: "mg/kg", frequency: "Stat", route: "PO", isLoadingDose: true },
      { indication: "Treatment follow-up", dosePerKg: "5", unit: "mg/kg", frequency: "At 6h, 24h, 48h", route: "PO" },
      { indication: "Prophylaxis", dosePerKg: "5", unit: "mg/kg", frequency: "Weekly", route: "PO" },
      { indication: "IV (severe malaria)", dosePerKg: "5", unit: "mg/kg", frequency: "Q12H", route: "IV", notes: "In NS/D5 over 2-4 hrs; total 25 mg/kg" },
    ],
    routes: ["PO", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiProtozoal: PediatricDrug[] = [
  {
    name: "Fluconazole",
    category: "Anti-Protozoal",
    doses: [
      { dosePerKg: "3-6", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Metronidazole",
    category: "Anti-Protozoal",
    doses: [
      { dosePerKg: "20", unit: "mg/kg/day", frequency: "Q8H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ornidazole",
    category: "Anti-Protozoal",
    doses: [
      { dosePerKg: "40", unit: "mg/kg", frequency: "OD", route: "PO", duration: "3 days" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiTubercular: PediatricDrug[] = [
  {
    name: "Isoniazid",
    genericName: "INH",
    category: "Anti-Tubercular",
    doses: [
      { dosePerKg: "5-10", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Supplement with pyridoxine", "Monitor LFT"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Rifampicin",
    category: "Anti-Tubercular",
    doses: [
      { dosePerKg: "10", unit: "mg/kg/day", frequency: "OD", route: "PO", notes: "Give on empty stomach" },
    ],
    routes: ["PO"],
    warnings: ["Orange discoloration of body fluids", "Monitor LFT"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Pyrazinamide",
    category: "Anti-Tubercular",
    doses: [
      { dosePerKg: "20-35", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Hepatotoxicity", "Hyperuricemia"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Ethambutol",
    category: "Anti-Tubercular",
    doses: [
      { dosePerKg: "25", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Visual acuity monitoring required", "Optic neuritis risk"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Streptomycin (ATT)",
    category: "Anti-Tubercular",
    doses: [
      { dosePerKg: "15-20", unit: "mg/kg/day", frequency: "OD", route: "IM" },
    ],
    routes: ["IM"],
    warnings: ["Ototoxicity", "Nephrotoxicity"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiHelmintics: PediatricDrug[] = [
  {
    name: "Albendazole",
    category: "Anti-Helmintics",
    doses: [
      { indication: "1-2 years", dosePerKg: "200 mg", unit: "single dose", frequency: "Single dose", route: "PO" },
      { indication: ">2 years", dosePerKg: "400 mg", unit: "single dose", frequency: "Single dose", route: "PO" },
      { indication: "Hydatid disease", dosePerKg: "400 mg", unit: "BD", frequency: "BD", route: "PO", duration: "28 days" },
      { indication: "Neurocysticercosis", dosePerKg: "15", unit: "mg/kg/day", frequency: "BD", route: "PO", duration: "7 days" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Diethylcarbamazine",
    genericName: "DEC",
    category: "Anti-Helmintics",
    doses: [
      { dosePerKg: "10", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Mebendazole",
    category: "Anti-Helmintics",
    doses: [
      { indication: "Standard deworming", dosePerKg: "100 mg", unit: "BD", frequency: "BD", route: "PO", duration: "3 days" },
      { indication: "Hydatid cyst", dosePerKg: "30", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiConvulsants: PediatricDrug[] = [
  {
    name: "ACTH",
    genericName: "Adrenocorticotropic Hormone",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "20-40", unit: "IU/day", frequency: "Daily", route: "IM/IV" },
    ],
    routes: ["IM", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Carbamazepine",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "10-30", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Monitor CBC and LFT", "Stevens-Johnson syndrome risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Clobazam",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Maintenance", dosePerKg: "0.3-1", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Seizure prophylaxis", dosePerKg: "1", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Clonazepam",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "0.01-0.03", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Diazepam",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Oral maintenance", dosePerKg: "0.1-0.3", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "Neonatal tetanus", dosePerKg: "0.5-5.0", unit: "mg/kg", frequency: "Q2H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Respiratory depression risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Piracetam",
    genericName: "Nootropil",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "40-100", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Ethosuximide",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "20-40", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Fosphenytoin",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Loading", dosePerKg: "15-20", unit: "mg/kg", frequency: "Single dose", route: "IV", isLoadingDose: true },
      { indication: "Maintenance", dosePerKg: "4-6", unit: "mg/kg/day", frequency: "Daily", route: "IV/IM" },
    ],
    routes: ["IV", "IM"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Gabapentin",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "30-60", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Levetiracetam",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Initial", dosePerKg: "10", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Target", dosePerKg: "Up to 40", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Lorazepam",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "0.05-0.1", unit: "mg/kg/dose", frequency: "As needed", route: "PO/IV/IM" },
    ],
    routes: ["PO", "IV", "IM"],
    warnings: ["Respiratory depression risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Midazolam",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Status epilepticus IV/IM", dosePerKg: "0.2", unit: "mg/kg", frequency: "Stat", route: "IV/IM" },
      { indication: "Intranasal", dosePerKg: "0.2", unit: "mg/kg", frequency: "Stat", route: "Intranasal" },
      { indication: "Buccal", dosePerKg: "0.3", unit: "mg/kg", frequency: "Stat", route: "Buccal" },
    ],
    routes: ["IV", "IM", "Intranasal", "Buccal"],
    warnings: ["Respiratory depression risk", "Have resuscitation equipment available"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Nitrazepam",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "0.25-1", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Oxcarbazepine",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Initial", dosePerKg: "8-10", unit: "mg/kg/day", frequency: "BD", route: "PO" },
    ],
    routes: ["PO"],
    maxDose: "40 mg/kg/day",
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Phenobarbitone",
    genericName: "Phenobarbital",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Loading", dosePerKg: "15-20", unit: "mg/kg", frequency: "Single dose", route: "IV", isLoadingDose: true },
      { indication: "Maintenance", dosePerKg: "3-5", unit: "mg/kg/day", frequency: "Q12H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Phenytoin",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Loading", dosePerKg: "15-20", unit: "mg/kg", frequency: "Single dose", route: "IV", isLoadingDose: true },
      { indication: "Maintenance", dosePerKg: "5-8", unit: "mg/kg/day", frequency: "Q12H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Monitor levels", "Purple glove syndrome with IV extravasation"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Thiopental",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Loading", dosePerKg: "5-10", unit: "mg/kg", frequency: "Single dose", route: "IV", isLoadingDose: true },
      { indication: "Maintenance (continuous drip)", dosePerKg: "2-10", unit: "mg/kg/hr", frequency: "Continuous", route: "IV" },
    ],
    routes: ["IV"],
    warnings: ["ICU setting only", "Intubation and ventilation required"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Topiramate",
    category: "Anti-Convulsants",
    doses: [
      { dosePerKg: "3-9", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Metabolic acidosis", "Kidney stones risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Valproate",
    genericName: "Sodium Valproate",
    category: "Anti-Convulsants",
    doses: [
      { indication: "Loading", dosePerKg: "20", unit: "mg/kg", frequency: "Slowly", route: "IV", isLoadingDose: true },
      { indication: "Maintenance", dosePerKg: "10-15", unit: "mg/kg/day", frequency: "Q12H", route: "PO/IV", notes: "Can increase up to 60 mg/kg/day" },
    ],
    routes: ["PO", "IV"],
    maxDose: "60 mg/kg/day",
    warnings: ["Hepatotoxicity risk", "Monitor LFT and levels", "Teratogenic"],
    reference: "Harriet Lane Handbook",
  },
];

const antiEmetics: PediatricDrug[] = [
  {
    name: "Domperidone",
    category: "Anti-Emetics",
    doses: [
      { dosePerKg: "0.2-0.4", unit: "mg/kg/dose", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["QT prolongation risk"],
    reference: "BNF for Children",
  },
  {
    name: "Granisetron",
    category: "Anti-Emetics",
    doses: [
      { dosePerKg: "10-20", unit: "mcg/kg/dose", frequency: "OD", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Metoclopramide",
    category: "Anti-Emetics",
    doses: [
      { dosePerKg: "0.1", unit: "mg/kg/dose", frequency: "Q8H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    maxDose: "0.8 mg/kg/dose",
    warnings: ["Extrapyramidal side effects", "Avoid prolonged use in children"],
    reference: "BNF for Children",
  },
  {
    name: "Ondansetron",
    category: "Anti-Emetics",
    doses: [
      { dosePerKg: "0.15-0.45", unit: "mg/kg/dose", frequency: "Q8H", route: "PO/IV", notes: "Give 30 min before meal" },
    ],
    routes: ["PO", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Promethazine Theoclate",
    category: "Anti-Emetics",
    doses: [
      { dosePerKg: "0.5", unit: "mg/kg/dose", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
];

const antiHistaminics: PediatricDrug[] = [
  {
    name: "Chlorpheniramine",
    genericName: "CPM",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "0.35", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Cetirizine",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "0.25", unit: "mg/kg/day", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Cyproheptadine",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "0.25-0.5", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Fexofenadine",
    category: "Anti-Histaminics",
    doses: [
      { indication: "<12 years", dosePerKg: "30 mg", unit: "BD", frequency: "BD", route: "PO" },
      { indication: ">12 years", dosePerKg: "60 mg", unit: "BD", frequency: "BD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Hydroxyzine",
    category: "Anti-Histaminics",
    doses: [
      { indication: "Oral", dosePerKg: "2", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "IM", dosePerKg: "0.5-1", unit: "mg/kg/dose", frequency: "Q8H", route: "IM" },
    ],
    routes: ["PO", "IM"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Ketotifen",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "1 mg", unit: "BD", frequency: "BD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Levocetirizine",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "0.12", unit: "mg/kg", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
  {
    name: "Methdilazine",
    category: "Anti-Histaminics",
    doses: [
      { dosePerKg: "4 mg", unit: "Q12H", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    ageRestriction: ">3 years",
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Promethazine",
    category: "Anti-Histaminics",
    doses: [
      { indication: "Sedation", dosePerKg: "0.25-1.0", unit: "mg/kg/dose", frequency: "As needed", route: "PO/IM/IV" },
      { indication: "Motion sickness", dosePerKg: "0.5", unit: "mg/kg/dose", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO", "IM", "IV"],
    warnings: ["Avoid in children <2 years - respiratory depression risk"],
    reference: "BNF for Children",
  },
];

const antiHypertensives: PediatricDrug[] = [
  {
    name: "Atenolol",
    category: "Anti-Hypertensives",
    doses: [
      { dosePerKg: "0.5-2", unit: "mg/kg/dose", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Nifedipine",
    category: "Anti-Hypertensives",
    doses: [
      { indication: "Oral", dosePerKg: "0.25-0.5", unit: "mg/kg/dose", frequency: "As needed", route: "PO" },
      { indication: "Sublingual (severe HTN)", dosePerKg: "3-5", unit: "mg/kg/dose", frequency: "Stat", route: "Sublingual" },
    ],
    routes: ["PO", "Sublingual"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Propranolol",
    category: "Anti-Hypertensives",
    doses: [
      { indication: "Hypertension", dosePerKg: "0.5-1", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Cyanotic spell", dosePerKg: "0.5-4", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Avoid in asthma", "Monitor heart rate"],
    reference: "Harriet Lane Handbook",
  },
];

const diuretics: PediatricDrug[] = [
  {
    name: "Acetazolamide",
    category: "Diuretics",
    doses: [
      { indication: "Diuretic", dosePerKg: "5", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "Hydrocephalus", dosePerKg: "50-70", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Metabolic acidosis"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Furosemide",
    genericName: "Frusemide",
    category: "Diuretics",
    doses: [
      { indication: "Oral", dosePerKg: "2-8", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "IV", dosePerKg: "1-4", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Electrolyte monitoring required", "Ototoxicity with rapid IV push"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Mannitol",
    category: "Diuretics",
    doses: [
      { dosePerKg: "0.25-1", unit: "g/kg/dose", frequency: "As needed", route: "IV", notes: "Infuse over 20-30 min" },
    ],
    routes: ["IV"],
    warnings: ["Monitor serum osmolality"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Spironolactone",
    category: "Diuretics",
    doses: [
      { dosePerKg: "1-3", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Hyperkalemia risk"],
    reference: "Harriet Lane Handbook",
  },
];

const steroidsHormones: PediatricDrug[] = [
  {
    name: "Dexamethasone",
    category: "Steroids/Hormones",
    doses: [
      { dosePerKg: "0.05-0.5", unit: "mg/kg/day", frequency: "Daily", route: "PO/IM/IV" },
    ],
    routes: ["PO", "IM", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Hydrocortisone",
    category: "Steroids/Hormones",
    doses: [
      { dosePerKg: "10", unit: "mg/kg/dose", frequency: "As needed", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Methylprednisolone",
    category: "Steroids/Hormones",
    doses: [
      { indication: "Standard", dosePerKg: "0.4-1.7", unit: "mg/kg/day", frequency: "Daily", route: "IM/IV" },
      { indication: "Pulse therapy", dosePerKg: "30", unit: "mg/kg", frequency: "IV bolus", route: "IV", notes: "Over 10-20 min" },
    ],
    routes: ["IM", "IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Prednisolone",
    category: "Steroids/Hormones",
    doses: [
      { dosePerKg: "1-2", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Taper gradually after prolonged use"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Desmopressin",
    genericName: "DDAVP",
    category: "Steroids/Hormones",
    doses: [
      { indication: "Diabetes Insipidus", dosePerKg: "5-30", unit: "mcg", frequency: "Once or twice daily", route: "Intranasal" },
      { indication: "Nocturnal enuresis", dosePerKg: "20-40", unit: "mcg", frequency: "At bedtime", route: "IM/IV" },
    ],
    routes: ["Intranasal", "IM", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Thyroxine",
    genericName: "Levothyroxine",
    category: "Steroids/Hormones",
    doses: [
      { indication: "Newborn", dosePerKg: "10-15", unit: "mcg/kg/day", frequency: "OD", route: "PO" },
      { indication: "Children", dosePerKg: "5", unit: "mcg/kg/day", frequency: "OD", route: "PO" },
      { indication: ">5 years", dosePerKg: "100 mcg/day", unit: "fixed dose", frequency: "OD", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Monitor TSH levels regularly"],
    reference: "Nelson's Textbook of Pediatrics",
  },
];

const antiViral: PediatricDrug[] = [
  {
    name: "Acyclovir",
    category: "Anti-Viral",
    doses: [
      { indication: "Varicella", dosePerKg: "80", unit: "mg/kg/day", frequency: "Q6H", route: "PO", duration: "5 days" },
    ],
    routes: ["PO"],
    reference: "Harriet Lane Handbook",
  },
];

const sedation: PediatricDrug[] = [
  {
    name: "Triclofos",
    category: "Sedation",
    doses: [
      { indication: "Sedation", dosePerKg: "20", unit: "mg/kg/dose", frequency: "Single dose", route: "PO" },
    ],
    routes: ["PO"],
    reference: "BNF for Children",
  },
];

const bronchodilators: PediatricDrug[] = [
  {
    name: "Adrenaline",
    genericName: "Epinephrine",
    category: "Bronchodilators",
    doses: [
      { dosePerKg: "0.1 ml/kg (1:10,000)", unit: "ml/kg", frequency: "As needed", route: "IV/Endotracheal" },
    ],
    routes: ["IV", "Endotracheal"],
    warnings: ["Cardiac monitoring required"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Aminophylline",
    category: "Bronchodilators",
    doses: [
      { indication: "Oral", dosePerKg: "15-20", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "IV Loading", dosePerKg: "5-7", unit: "mg/kg", frequency: "Single dose", route: "IV", isLoadingDose: true },
      { indication: "IV Maintenance", dosePerKg: "0.5-0.9", unit: "mg/kg/hr", frequency: "Continuous", route: "IV" },
      { indication: "Apnea loading", dosePerKg: "5", unit: "mg/kg", frequency: "Single dose", route: "IV/PO", isLoadingDose: true },
      { indication: "Apnea maintenance", dosePerKg: "2", unit: "mg/kg", frequency: "Q8H", route: "PO/IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Narrow therapeutic index", "Monitor drug levels"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Salbutamol",
    genericName: "Albuterol",
    category: "Bronchodilators",
    doses: [
      { indication: "Oral", dosePerKg: "0.1-0.4", unit: "mg/kg/dose", frequency: "Q8H", route: "PO" },
      { indication: "Nebulization", dosePerKg: "0.15", unit: "mg/kg/dose", frequency: "As needed", route: "Nebulization" },
    ],
    routes: ["PO", "Nebulization"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Terbutaline",
    category: "Bronchodilators",
    doses: [
      { indication: "Oral", dosePerKg: "0.1-0.15", unit: "mg/kg/day", frequency: "Q8H", route: "PO" },
      { indication: "Subcutaneous", dosePerKg: "0.01-0.02", unit: "ml/kg", frequency: "4x/day", route: "SC" },
      { indication: "Nebulization", dosePerKg: "2.5-5", unit: "mg/kg", frequency: "As needed", route: "Nebulization" },
    ],
    routes: ["PO", "SC", "Nebulization"],
    reference: "BNF for Children",
  },
];

const cardiotonics: PediatricDrug[] = [
  {
    name: "Digoxin",
    category: "Cardiotonics",
    doses: [
      { indication: "Oral", dosePerKg: "0.04-0.06", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "Parenteral", dosePerKg: "2/3 of oral dose", unit: "mg/kg/day", frequency: "Q12H", route: "IV" },
    ],
    routes: ["PO", "IV"],
    warnings: ["Narrow therapeutic index", "Monitor levels and potassium", "Toxicity: arrhythmias, nausea, visual changes"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Dobutamine",
    category: "Cardiotonics",
    doses: [
      { dosePerKg: "5-20", unit: "mcg/kg/min", frequency: "Continuous infusion", route: "IV" },
    ],
    routes: ["IV"],
    warnings: ["Cardiac monitoring required", "Titrate to effect"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Dopamine",
    category: "Cardiotonics",
    doses: [
      { indication: "Start", dosePerKg: "5", unit: "mcg/kg/min", frequency: "Continuous infusion", route: "IV" },
    ],
    routes: ["IV"],
    maxDose: "30 mcg/kg/min",
    warnings: ["Cardiac monitoring required", "Extravasation causes tissue necrosis"],
    reference: "Harriet Lane Handbook",
  },
];

const supplements: PediatricDrug[] = [
  {
    name: "Iron",
    genericName: "Ferrous Sulphate",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Prophylaxis", dosePerKg: "1", unit: "mg/kg/day", frequency: "BD", route: "PO" },
      { indication: "Treatment", dosePerKg: "3-5", unit: "mg/kg/day", frequency: "Q12H", route: "PO" },
      { indication: "IM (total dose)", dosePerKg: "4.0 x weight(kg) x Hb deficit", unit: "mg", frequency: "Calculated", route: "IM" },
    ],
    routes: ["PO", "IM"],
    warnings: ["GI side effects", "Black stools"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Vitamin A",
    genericName: "Retinol",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Daily requirement", dosePerKg: "400-1000", unit: "IU/day", frequency: "Daily", route: "PO" },
      { indication: "<12 months", dosePerKg: "1 lakh IU", unit: "single dose", frequency: "As per schedule", route: "PO" },
      { indication: ">12 months", dosePerKg: "2 lakh IU", unit: "single dose", frequency: "As per schedule", route: "PO" },
      { indication: "Deficiency treatment", dosePerKg: "2 lakh IU", unit: "on day 0, 1, 14", frequency: "Day 0, 1, 14", route: "PO" },
    ],
    routes: ["PO"],
    warnings: ["Hypervitaminosis A risk with excess dosing"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Vitamin B",
    genericName: "Pyridoxine",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Supplementation", dosePerKg: "0.3-3", unit: "mg/kg/day", frequency: "Daily", route: "PO/IM/IV" },
      { indication: "INH neuropathy", dosePerKg: "10 mg/day", unit: "fixed dose", frequency: "Daily", route: "PO" },
    ],
    routes: ["PO", "IM", "IV"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Vitamin C",
    genericName: "Ascorbic Acid",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Preterm", dosePerKg: "50 mg/day", unit: "fixed dose", frequency: "Daily", route: "PO" },
      { indication: "Term", dosePerKg: "30", unit: "mg/kg", frequency: "Daily", route: "PO" },
      { indication: "Child", dosePerKg: "40", unit: "mg/kg", frequency: "Daily", route: "PO" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Vitamin D3",
    genericName: "Cholecalciferol",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Maintenance", dosePerKg: "400 IU/day", unit: "fixed dose", frequency: "Daily", route: "PO" },
      { indication: "Deficiency", dosePerKg: "60,000 IU", unit: "daily", frequency: "Daily", route: "PO", duration: "10 days" },
    ],
    routes: ["PO"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "Vitamin K",
    genericName: "Phytomenadione",
    category: "Supplements/Vitamins",
    doses: [
      { indication: "Term baby prophylaxis", dosePerKg: "1 mg", unit: "fixed dose", frequency: "Single dose", route: "IM" },
      { indication: "Preterm baby", dosePerKg: "0.5", unit: "mg/kg", frequency: "Single dose", route: "IM" },
      { indication: "Therapeutic", dosePerKg: "5-10", unit: "mg/dose", frequency: "As needed", route: "IM/IV" },
    ],
    routes: ["IM", "IV"],
    reference: "Harriet Lane Handbook",
  },
];

const miscellaneous: PediatricDrug[] = [
  {
    name: "Heparin",
    category: "Miscellaneous",
    doses: [
      { indication: "IV", dosePerKg: "50-100", unit: "mcg/kg/dose", frequency: "Q4H", route: "IV" },
      { indication: "SC", dosePerKg: "25-50", unit: "mcg/kg", frequency: "Q12H", route: "SC" },
      { indication: "DVT prophylaxis", dosePerKg: "5000 mcg/dose", unit: "fixed dose", frequency: "Q8H", route: "SC" },
    ],
    routes: ["IV", "SC"],
    warnings: ["Monitor aPTT", "Bleeding risk", "HIT risk"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Anti-Rh D Immunoglobulin",
    category: "Miscellaneous",
    doses: [
      { dosePerKg: "500 mcg", unit: "fixed dose", frequency: "Single dose", route: "IM", notes: "Within 72 hours" },
    ],
    routes: ["IM"],
    reference: "Nelson's Textbook of Pediatrics",
  },
  {
    name: "IVIG",
    genericName: "Intravenous Immunoglobulin",
    category: "Miscellaneous",
    doses: [
      { indication: "Standard", dosePerKg: "400", unit: "mg/kg/day", frequency: "Daily", route: "IV", duration: "5 days", notes: "Infuse over 2 hours" },
      { indication: "Single dose", dosePerKg: "1", unit: "g/kg", frequency: "Single dose", route: "IV" },
    ],
    routes: ["IV"],
    warnings: ["Anaphylaxis risk", "Infusion reactions"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Normal Saline Bolus",
    category: "Miscellaneous",
    doses: [
      { dosePerKg: "20", unit: "ml/kg", frequency: "Stat", route: "IV" },
    ],
    routes: ["IV"],
    reference: "Harriet Lane Handbook",
  },
  {
    name: "Dextrose",
    genericName: "D10W",
    category: "Miscellaneous",
    doses: [
      { indication: "Hypoglycemia", dosePerKg: "2-5", unit: "ml/kg", frequency: "Stat", route: "IV", notes: "D10W IV push" },
    ],
    routes: ["IV"],
    reference: "Harriet Lane Handbook",
  },
];

export const DRUG_CATEGORIES: DrugCategory[] = [
  {
    id: "analgesics",
    name: "Analgesics & Antipyretics",
    icon: "thermometer",
    color: "#ef4444",
    drugs: analgesics,
  },
  {
    id: "antibiotics-aminoglycosides",
    name: "Antibiotics - Aminoglycosides",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsAminoglycosides,
  },
  {
    id: "antibiotics-cephalosporins",
    name: "Antibiotics - Cephalosporins",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsCephalosporins,
  },
  {
    id: "antibiotics-fluoroquinolones",
    name: "Antibiotics - Fluoroquinolones",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsFluoroquinolones,
  },
  {
    id: "antibiotics-macrolides",
    name: "Antibiotics - Macrolides",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsMacrolides,
  },
  {
    id: "antibiotics-penicillins",
    name: "Antibiotics - Penicillins",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsPenicillins,
  },
  {
    id: "antibiotics-others",
    name: "Antibiotics - Others",
    icon: "shield",
    color: "#3b82f6",
    drugs: antibioticsOthers,
  },
  {
    id: "anti-leprosy",
    name: "Anti-Leprosy",
    icon: "circle",
    color: "#78716c",
    drugs: antiLeprosy,
  },
  {
    id: "anti-malarial",
    name: "Anti-Malarial",
    icon: "droplet",
    color: "#8b5cf6",
    drugs: antiMalarial,
  },
  {
    id: "anti-protozoal",
    name: "Anti-Protozoal",
    icon: "target",
    color: "#6366f1",
    drugs: antiProtozoal,
  },
  {
    id: "anti-tubercular",
    name: "Anti-Tubercular",
    icon: "wind",
    color: "#14b8a6",
    drugs: antiTubercular,
  },
  {
    id: "anti-helmintics",
    name: "Anti-Helmintics",
    icon: "crosshair",
    color: "#f97316",
    drugs: antiHelmintics,
  },
  {
    id: "anti-convulsants",
    name: "Anti-Convulsants",
    icon: "zap",
    color: "#ec4899",
    drugs: antiConvulsants,
  },
  {
    id: "anti-emetics",
    name: "Anti-Emetics",
    icon: "rotate-ccw",
    color: "#22c55e",
    drugs: antiEmetics,
  },
  {
    id: "anti-histaminics",
    name: "Anti-Histaminics",
    icon: "feather",
    color: "#a855f7",
    drugs: antiHistaminics,
  },
  {
    id: "anti-hypertensives",
    name: "Anti-Hypertensives",
    icon: "heart",
    color: "#dc2626",
    drugs: antiHypertensives,
  },
  {
    id: "diuretics",
    name: "Diuretics",
    icon: "droplet",
    color: "#0ea5e9",
    drugs: diuretics,
  },
  {
    id: "steroids-hormones",
    name: "Steroids/Hormones",
    icon: "sun",
    color: "#f59e0b",
    drugs: steroidsHormones,
  },
  {
    id: "anti-viral",
    name: "Anti-Viral",
    icon: "shield-off",
    color: "#10b981",
    drugs: antiViral,
  },
  {
    id: "sedation",
    name: "Sedation",
    icon: "moon",
    color: "#7c3aed",
    drugs: sedation,
  },
  {
    id: "bronchodilators",
    name: "Bronchodilators",
    icon: "wind",
    color: "#06b6d4",
    drugs: bronchodilators,
  },
  {
    id: "cardiotonics",
    name: "Cardiotonics",
    icon: "heart",
    color: "#e11d48",
    drugs: cardiotonics,
  },
  {
    id: "supplements-vitamins",
    name: "Supplements/Vitamins",
    icon: "plus-circle",
    color: "#84cc16",
    drugs: supplements,
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    icon: "package",
    color: "#64748b",
    drugs: miscellaneous,
  },
];

export const ALL_DRUGS: PediatricDrug[] = DRUG_CATEGORIES.flatMap(
  (category) => category.drugs
);

export function searchDrugs(query: string): PediatricDrug[] {
  if (!query || query.trim().length === 0) return [];
  const lowerQuery = query.toLowerCase().trim();
  return ALL_DRUGS.filter(
    (drug) =>
      drug.name.toLowerCase().includes(lowerQuery) ||
      (drug.genericName && drug.genericName.toLowerCase().includes(lowerQuery)) ||
      drug.category.toLowerCase().includes(lowerQuery) ||
      (drug.subcategory && drug.subcategory.toLowerCase().includes(lowerQuery)) ||
      drug.routes.some((r) => r.toLowerCase().includes(lowerQuery))
  );
}
