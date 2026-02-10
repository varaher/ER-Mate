export interface MedicalSearchResult {
  id: string;
  title: string;
  source: string;
  authors?: string;
  year?: string;
  url: string;
  snippet: string;
  sourceType: "pubmed" | "textbook" | "guideline" | "wikem";
}

async function searchPubMed(query: string, maxResults: number = 5): Promise<MedicalSearchResult[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + " emergency medicine")}&retmax=${maxResults}&sort=relevance&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];

    const fetchData = await fetchRes.json();
    const results: MedicalSearchResult[] = [];

    for (const id of ids) {
      const article = fetchData?.result?.[id];
      if (!article || article.error) continue;

      const authors = article.authors?.slice(0, 3).map((a: { name: string }) => a.name).join(", ");
      const year = article.pubdate?.split(" ")?.[0] || "";

      results.push({
        id: `pubmed_${id}`,
        title: article.title || "",
        source: article.fulljournalname || article.source || "PubMed",
        authors: authors ? (article.authors?.length > 3 ? `${authors} et al.` : authors) : undefined,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: article.title || "",
        sourceType: "pubmed",
      });
    }

    return results;
  } catch (error) {
    console.error("PubMed search error:", error);
    return [];
  }
}

async function searchWikEM(query: string): Promise<MedicalSearchResult[]> {
  try {
    const searchUrl = `https://wikem.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=3&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];

    const data = await res.json();
    const searchResults = data?.query?.search || [];

    return searchResults.map((item: { pageid: number; title: string; snippet: string }, i: number) => ({
      id: `wikem_${item.pageid}`,
      title: item.title,
      source: "WikEM - Global Emergency Medicine Wiki",
      year: new Date().getFullYear().toString(),
      url: `https://wikem.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      snippet: item.snippet?.replace(/<[^>]+>/g, "") || "",
      sourceType: "wikem" as const,
    }));
  } catch (error) {
    console.error("WikEM search error:", error);
    return [];
  }
}

function getTextbookReferences(complaint: string, isPediatric: boolean): MedicalSearchResult[] {
  const refs: MedicalSearchResult[] = [];
  const complaintLower = complaint.toLowerCase();

  refs.push({
    id: "textbook_tintinalli",
    title: "Tintinalli's Emergency Medicine: A Comprehensive Study Guide, 9th Edition",
    source: "McGraw-Hill Education",
    authors: "Tintinalli JE, Ma OJ, Yealy DM et al.",
    year: "2020",
    url: "https://accessemergencymedicine.mhmedical.com/book.aspx?bookid=2353",
    snippet: "Comprehensive emergency medicine reference covering evaluation, diagnosis, and management.",
    sourceType: "textbook",
  });

  refs.push({
    id: "textbook_rosens",
    title: "Rosen's Emergency Medicine: Concepts and Clinical Practice, 10th Edition",
    source: "Elsevier",
    authors: "Walls RM, Hockberger RS, Gausche-Hill M",
    year: "2023",
    url: "https://www.elsevier.com/books/rosens-emergency-medicine/walls/978-0-323-75489-3",
    snippet: "Gold standard clinical practice reference for emergency physicians.",
    sourceType: "textbook",
  });

  if (isPediatric) {
    refs.push({
      id: "textbook_fleisher",
      title: "Fleisher & Ludwig's Textbook of Pediatric Emergency Medicine, 8th Edition",
      source: "Wolters Kluwer",
      authors: "Shaw KN, Bachur RG",
      year: "2021",
      url: "https://shop.lww.com/fleisher-ludwigs-textbook-of-pediatric-emergency-medicine/p/9781975134556",
      snippet: "Definitive pediatric emergency medicine textbook with evidence-based protocols.",
      sourceType: "textbook",
    });

    refs.push({
      id: "guideline_pals",
      title: "Pediatric Advanced Life Support (PALS) Provider Manual",
      source: "American Heart Association",
      authors: "AHA",
      year: "2020",
      url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support",
      snippet: "AHA guidelines for pediatric resuscitation and emergency cardiovascular care.",
      sourceType: "guideline",
    });
  }

  if (/trauma|fracture|fall|accident|injury|wound|laceration|head injury|blunt|penetrating/.test(complaintLower)) {
    refs.push({
      id: "guideline_atls",
      title: "Advanced Trauma Life Support (ATLS) Student Course Manual, 10th Edition",
      source: "American College of Surgeons",
      authors: "ACS Committee on Trauma",
      year: "2018",
      url: "https://www.facs.org/quality-programs/trauma/education/advanced-trauma-life-support/",
      snippet: "Systematic approach to trauma assessment and management: primary and secondary surveys.",
      sourceType: "guideline",
    });

    refs.push({
      id: "guideline_east",
      title: "EAST Practice Management Guidelines",
      source: "Eastern Association for the Surgery of Trauma",
      authors: "EAST",
      year: "2023",
      url: "https://www.east.org/education-resources/practice-management-guidelines",
      snippet: "Evidence-based practice management guidelines for surgical trauma care.",
      sourceType: "guideline",
    });
  }

  if (/chest pain|mi|acs|angina|stemi|nstemi|cardiac|heart|palpitation/.test(complaintLower)) {
    refs.push({
      id: "guideline_aha_acs",
      title: "2021 ACC/AHA/SCAI Guideline for Coronary Artery Revascularization",
      source: "Journal of the American College of Cardiology",
      authors: "Lawton JS, Tamis-Holland JE, Bangalore S et al.",
      year: "2022",
      url: "https://www.jacc.org/doi/10.1016/j.jacc.2021.09.006",
      snippet: "Evidence-based guidelines for management of acute coronary syndromes and revascularization.",
      sourceType: "guideline",
    });
  }

  if (/sepsis|septic|infection|fever|pneumonia|uti|cellulitis|bacteremia|meningitis/.test(complaintLower)) {
    refs.push({
      id: "guideline_ssc",
      title: "Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021",
      source: "Intensive Care Medicine",
      authors: "Evans L, Rhodes A, Alhazzani W et al.",
      year: "2021",
      url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/Adult-Patients",
      snippet: "Hour-1 bundle: lactate, blood cultures, broad-spectrum antibiotics, crystalloid for hypotension, vasopressors if needed.",
      sourceType: "guideline",
    });
  }

  if (/stroke|tia|weakness|hemiparesis|aphasia|facial droop|slurred speech/.test(complaintLower)) {
    refs.push({
      id: "guideline_aha_stroke",
      title: "2019 AHA/ASA Guideline for the Early Management of Patients With Acute Ischemic Stroke",
      source: "Stroke (AHA/ASA)",
      authors: "Powers WJ, Rabinstein AA, Ackerson T et al.",
      year: "2019",
      url: "https://www.ahajournals.org/doi/10.1161/STR.0000000000000211",
      snippet: "Door-to-needle time <60 min, IV alteplase within 4.5h window, mechanical thrombectomy within 24h for large vessel occlusion.",
      sourceType: "guideline",
    });
  }

  if (/asthma|copd|dyspnea|breathless|wheeze|respiratory|shortness of breath|sob/.test(complaintLower)) {
    refs.push({
      id: "guideline_gina",
      title: "Global Initiative for Asthma (GINA) Report 2023",
      source: "GINA",
      authors: "GINA Science Committee",
      year: "2023",
      url: "https://ginasthma.org/gina-reports/",
      snippet: "Stepwise approach to asthma management, acute exacerbation protocols, and severity assessment.",
      sourceType: "guideline",
    });
  }

  if (/poison|overdose|toxicology|ingestion|intoxication|drug abuse/.test(complaintLower)) {
    refs.push({
      id: "textbook_goldfrank",
      title: "Goldfrank's Toxicologic Emergencies, 11th Edition",
      source: "McGraw-Hill Education",
      authors: "Nelson LS, Howland MA, Lewin NA et al.",
      year: "2019",
      url: "https://accessemergencymedicine.mhmedical.com/book.aspx?bookid=2569",
      snippet: "Comprehensive toxicology reference: toxidromes, antidotes, decontamination, and enhanced elimination.",
      sourceType: "textbook",
    });
  }

  if (/abdominal|appendicitis|bowel|gi bleed|vomiting|diarrhea|obstruction|pancreatitis/.test(complaintLower)) {
    refs.push({
      id: "guideline_aga",
      title: "ACG Clinical Guidelines for Abdominal Pain Assessment",
      source: "American College of Gastroenterology",
      authors: "ACG",
      year: "2023",
      url: "https://journals.lww.com/ajg/pages/default.aspx",
      snippet: "Evidence-based approach to acute abdominal pain: differential diagnosis, imaging, and management.",
      sourceType: "guideline",
    });
  }

  if (/headache|migraine|subarachnoid|meningitis|head/.test(complaintLower)) {
    refs.push({
      id: "guideline_headache",
      title: "ACEP Clinical Policy: Critical Issues in the Evaluation of Adult Patients Presenting with Acute Headache",
      source: "Annals of Emergency Medicine",
      authors: "Godwin SA, Cherkas DS, Panagos PD et al.",
      year: "2019",
      url: "https://www.acep.org/patient-care/clinical-policies/",
      snippet: "Risk stratification for headache emergencies, SAH screening criteria, CT/LP decision rules.",
      sourceType: "guideline",
    });
  }

  return refs;
}

export async function searchMedicalLiterature(
  chiefComplaint: string,
  age: number,
  additionalContext?: string
): Promise<MedicalSearchResult[]> {
  const isPediatric = age <= 16;
  const searchQuery = additionalContext
    ? `${chiefComplaint} ${additionalContext} ${isPediatric ? "pediatric" : ""}`
    : `${chiefComplaint} ${isPediatric ? "pediatric" : ""} emergency`;

  const [pubmedResults, wikemResults] = await Promise.all([
    searchPubMed(searchQuery, 5),
    searchWikEM(chiefComplaint),
  ]);

  const textbookRefs = getTextbookReferences(chiefComplaint, isPediatric);

  const allResults = [...textbookRefs, ...pubmedResults, ...wikemResults];

  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
