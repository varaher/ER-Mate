import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { generateDiagnosisSuggestions, recordFeedback, getFeedbackStats, getLearningInsights, generateCourseInHospital, extractClinicalDataFromVoice, type AIFeedback, type FeedbackResult, type ExtractedClinicalData } from "./services/aiDiagnosis";

interface VitalsData {
  hr?: string;
  bp?: string;
  rr?: string;
  spo2?: string;
  gcs?: string;
  pain_score?: string;
  grbs?: string;
  temp?: string;
}

interface DischargeSummaryData {
  patient: {
    name: string;
    age: string | number;
    sex: string;
    phone?: string;
  };
  discharge_summary: {
    mlc?: boolean;
    allergy?: string;
    vitals_arrival?: VitalsData;
    presenting_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: string;
    family_history?: string;
    lmp?: string;
    primary_assessment?: {
      airway?: string;
      breathing?: string;
      circulation?: string;
      disability?: string;
      exposure?: string;
      efast?: string;
    };
    secondary_assessment?: {
      pallor?: boolean;
      icterus?: boolean;
      cyanosis?: boolean;
      clubbing?: boolean;
      lymphadenopathy?: boolean;
      edema?: boolean;
    };
    systemic_exam?: {
      chest?: string;
      cvs?: string;
      pa?: string;
      cns?: string;
      extremities?: string;
    };
    course_in_hospital?: string;
    investigations?: string;
    diagnosis?: string;
    discharge_medications?: string;
    disposition_type?: string;
    condition_at_discharge?: string;
    vitals_discharge?: VitalsData;
    follow_up_advice?: string;
    ed_resident?: string;
    ed_consultant?: string;
    sign_time_resident?: string;
    sign_time_consultant?: string;
    discharge_date?: string;
    treatment_given?: string;
    medications?: string;
    follow_up?: string;
    instructions?: string;
    doctor_name?: string;
  };
  created_at?: string;
}

function formatDate(dateString?: string): string {
  if (!dateString) return new Date().toLocaleDateString("en-IN");
  try {
    return new Date(dateString).toLocaleDateString("en-IN");
  } catch {
    return new Date().toLocaleDateString("en-IN");
  }
}

function formatVitals(vitals: VitalsData | undefined): string {
  if (!vitals) return "";
  const parts: string[] = [];
  if (vitals.hr) parts.push(`HR: ${vitals.hr}`);
  if (vitals.bp) parts.push(`BP: ${vitals.bp}`);
  if (vitals.rr) parts.push(`RR: ${vitals.rr}`);
  if (vitals.spo2) parts.push(`SpO2: ${vitals.spo2}%`);
  if (vitals.gcs) parts.push(`GCS: ${vitals.gcs}`);
  if (vitals.pain_score) parts.push(`Pain: ${vitals.pain_score}`);
  if (vitals.grbs) parts.push(`GRBS: ${vitals.grbs}`);
  if (vitals.temp) parts.push(`Temp: ${vitals.temp}`);
  return parts.join(" | ");
}

function formatSecondaryAssessment(assessment: DischargeSummaryData["discharge_summary"]["secondary_assessment"]): string {
  if (!assessment) return "";
  const findings: string[] = [];
  if (assessment.pallor) findings.push("Pallor");
  if (assessment.icterus) findings.push("Icterus");
  if (assessment.cyanosis) findings.push("Cyanosis");
  if (assessment.clubbing) findings.push("Clubbing");
  if (assessment.lymphadenopathy) findings.push("Lymphadenopathy");
  if (assessment.edema) findings.push("Edema");
  return findings.length > 0 ? findings.join(", ") : "No significant findings";
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/export/discharge-pdf", async (req: Request, res: Response) => {
    try {
      const data: DischargeSummaryData = req.body;
      
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }

      const ds = data.discharge_summary;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="discharge_summary_${data.patient.name.replace(/\s+/g, "_")}.pdf"`);
        res.send(pdfBuffer);
      });

      doc.fontSize(18).font("Helvetica-Bold").text("DISCHARGE SUMMARY", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text("Emergency Department", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(11).font("Helvetica-Bold").text("PATIENT INFORMATION");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Name: ${data.patient.name || "N/A"}        Age/Sex: ${data.patient.age || "N/A"} / ${data.patient.sex || "N/A"}`);
      doc.text(`MLC: ${ds.mlc ? "Yes" : "No"}        Allergy: ${ds.allergy || "No known allergies"}`);
      doc.text(`Admission: ${formatDate(data.created_at)}        Discharge: ${ds.discharge_date || formatDate()}`);
      doc.moveDown(0.5);

      if (ds.vitals_arrival) {
        doc.font("Helvetica-Bold").fontSize(10).text("Vitals at Time of Arrival:");
        doc.font("Helvetica").text(formatVitals(ds.vitals_arrival));
        doc.moveDown(0.3);
      }

      if (ds.presenting_complaint) {
        doc.font("Helvetica-Bold").text("Presenting Complaints:");
        doc.font("Helvetica").text(ds.presenting_complaint);
        doc.moveDown(0.3);
      }

      if (ds.history_of_present_illness) {
        doc.font("Helvetica-Bold").text("History of Present Illness:");
        doc.font("Helvetica").text(ds.history_of_present_illness);
        doc.moveDown(0.3);
      }

      if (ds.past_medical_history) {
        doc.font("Helvetica-Bold").text("Past Medical/Surgical Histories:");
        doc.font("Helvetica").text(ds.past_medical_history);
        doc.moveDown(0.3);
      }

      if (ds.family_history || ds.lmp) {
        if (ds.family_history) {
          doc.font("Helvetica-Bold").text("Family/Gynae History:");
          doc.font("Helvetica").text(ds.family_history);
        }
        if (ds.lmp) {
          doc.font("Helvetica-Bold").text("LMP:");
          doc.font("Helvetica").text(ds.lmp);
        }
        doc.moveDown(0.3);
      }

      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).text("PRIMARY ASSESSMENT");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);

      if (ds.primary_assessment) {
        const pa = ds.primary_assessment;
        if (pa.airway) doc.text(`Airway: ${pa.airway}`);
        if (pa.breathing) doc.text(`Breathing: ${pa.breathing}`);
        if (pa.circulation) doc.text(`Circulation: ${pa.circulation}`);
        if (pa.disability) doc.text(`Disability: ${pa.disability}`);
        if (pa.exposure) doc.text(`Exposure: ${pa.exposure}`);
        if (pa.efast) doc.text(`EFAST: ${pa.efast}`);
      }
      doc.moveDown(0.3);

      doc.font("Helvetica-Bold").fontSize(11).text("SECONDARY ASSESSMENT");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`General Examination: ${formatSecondaryAssessment(ds.secondary_assessment)}`);

      if (ds.systemic_exam) {
        const se = ds.systemic_exam;
        if (se.chest) doc.text(`CHEST: ${se.chest}`);
        if (se.cvs) doc.text(`CVS: ${se.cvs}`);
        if (se.pa) doc.text(`P/A: ${se.pa}`);
        if (se.cns) doc.text(`CNS: ${se.cns}`);
        if (se.extremities) doc.text(`EXTREMITIES: ${se.extremities}`);
      }
      doc.moveDown(0.5);

      if (ds.course_in_hospital) {
        doc.font("Helvetica-Bold").fontSize(11).text("COURSE IN HOSPITAL WITH MEDICATIONS AND PROCEDURES");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(10).text(ds.course_in_hospital);
        doc.moveDown(0.3);
      }

      if (ds.investigations) {
        doc.font("Helvetica-Bold").fontSize(10).text("Investigations:");
        doc.font("Helvetica").text(ds.investigations);
        doc.moveDown(0.3);
      }

      if (ds.diagnosis) {
        doc.font("Helvetica-Bold").fontSize(11).text("DIAGNOSIS AT TIME OF DISCHARGE");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(10).text(ds.diagnosis);
        doc.moveDown(0.3);
      }

      if (ds.discharge_medications) {
        doc.font("Helvetica-Bold").fontSize(10).text("Discharge Medications:");
        doc.font("Helvetica").text(ds.discharge_medications);
        doc.moveDown(0.3);
      }

      doc.font("Helvetica-Bold").fontSize(10).text("Disposition:");
      doc.font("Helvetica").text(`[ ${ds.disposition_type === "Normal Discharge" ? "X" : " "} ] Normal Discharge`);
      doc.text(`[ ${ds.disposition_type === "Discharge at Request" ? "X" : " "} ] Discharge at Request`);
      doc.text(`[ ${ds.disposition_type === "Discharge Against Medical Advice" ? "X" : " "} ] Discharge Against Medical Advice`);
      doc.text(`[ ${ds.disposition_type === "Referred" ? "X" : " "} ] Referred`);
      doc.moveDown(0.3);

      doc.font("Helvetica-Bold").text(`Condition at Time of Discharge: ${ds.condition_at_discharge || "STABLE"}`);
      doc.moveDown(0.3);

      if (ds.vitals_discharge) {
        doc.font("Helvetica-Bold").text("Vitals at Time of Discharge:");
        doc.font("Helvetica").text(formatVitals(ds.vitals_discharge));
        doc.moveDown(0.3);
      }

      if (ds.follow_up_advice) {
        doc.font("Helvetica-Bold").text("Follow-Up Advice:");
        doc.font("Helvetica").text(ds.follow_up_advice);
        doc.moveDown(0.5);
      }

      doc.moveDown(0.5);
      const sigY = doc.y;
      doc.text(`ED Resident: ${ds.ed_resident || "_________________"}`, 50, sigY);
      doc.text(`ED Consultant: ${ds.ed_consultant || "_________________"}`, 300, sigY);
      doc.moveDown(0.3);
      const timeY = doc.y;
      doc.text(`Sign and Time: ${ds.sign_time_resident || "_________________"}`, 50, timeY);
      doc.text(`Sign and Time: ${ds.sign_time_consultant || "_________________"}`, 300, timeY);
      doc.moveDown(0.5);
      doc.text(`Date: ${ds.discharge_date || formatDate()}`, 50);
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica-Oblique");
      doc.text("This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.", { align: "center" });

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.post("/api/export/discharge-docx", async (req: Request, res: Response) => {
    try {
      const data: DischargeSummaryData = req.body;
      
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }

      const ds = data.discharge_summary;
      const children: Paragraph[] = [];

      children.push(
        new Paragraph({
          text: "DISCHARGE SUMMARY",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: "Emergency Department",
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "PATIENT INFORMATION",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({ text: `Name: ${data.patient.name || "N/A"}        Age/Sex: ${data.patient.age || "N/A"} / ${data.patient.sex || "N/A"}` }),
        new Paragraph({ text: `MLC: ${ds.mlc ? "Yes" : "No"}        Allergy: ${ds.allergy || "No known allergies"}` }),
        new Paragraph({ text: `Admission: ${formatDate(data.created_at)}        Discharge: ${ds.discharge_date || formatDate()}`, spacing: { after: 200 } })
      );

      if (ds.vitals_arrival) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Vitals at Time of Arrival: ", bold: true }), new TextRun({ text: formatVitals(ds.vitals_arrival) })] })
        );
      }

      if (ds.presenting_complaint) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Presenting Complaints: ", bold: true }), new TextRun({ text: ds.presenting_complaint })] })
        );
      }

      if (ds.history_of_present_illness) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "History of Present Illness: ", bold: true }), new TextRun({ text: ds.history_of_present_illness })] })
        );
      }

      if (ds.past_medical_history) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Past Medical/Surgical Histories: ", bold: true }), new TextRun({ text: ds.past_medical_history })] })
        );
      }

      if (ds.family_history) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Family/Gynae History: ", bold: true }), new TextRun({ text: ds.family_history })] })
        );
      }

      if (ds.lmp) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "LMP: ", bold: true }), new TextRun({ text: ds.lmp })] })
        );
      }

      children.push(
        new Paragraph({
          text: "PRIMARY ASSESSMENT",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        })
      );

      if (ds.primary_assessment) {
        const pa = ds.primary_assessment;
        if (pa.airway) children.push(new Paragraph({ text: `Airway: ${pa.airway}` }));
        if (pa.breathing) children.push(new Paragraph({ text: `Breathing: ${pa.breathing}` }));
        if (pa.circulation) children.push(new Paragraph({ text: `Circulation: ${pa.circulation}` }));
        if (pa.disability) children.push(new Paragraph({ text: `Disability: ${pa.disability}` }));
        if (pa.exposure) children.push(new Paragraph({ text: `Exposure: ${pa.exposure}` }));
        if (pa.efast) children.push(new Paragraph({ text: `EFAST: ${pa.efast}` }));
      }

      children.push(
        new Paragraph({
          text: "SECONDARY ASSESSMENT",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({ text: `General Examination: ${formatSecondaryAssessment(ds.secondary_assessment)}` })
      );

      if (ds.systemic_exam) {
        const se = ds.systemic_exam;
        if (se.chest) children.push(new Paragraph({ text: `CHEST: ${se.chest}` }));
        if (se.cvs) children.push(new Paragraph({ text: `CVS: ${se.cvs}` }));
        if (se.pa) children.push(new Paragraph({ text: `P/A: ${se.pa}` }));
        if (se.cns) children.push(new Paragraph({ text: `CNS: ${se.cns}` }));
        if (se.extremities) children.push(new Paragraph({ text: `EXTREMITIES: ${se.extremities}` }));
      }

      if (ds.course_in_hospital) {
        children.push(
          new Paragraph({
            text: "COURSE IN HOSPITAL WITH MEDICATIONS AND PROCEDURES",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({ text: ds.course_in_hospital, spacing: { after: 200 } })
        );
      }

      if (ds.investigations) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Investigations: ", bold: true }), new TextRun({ text: ds.investigations })] })
        );
      }

      if (ds.diagnosis) {
        children.push(
          new Paragraph({
            text: "DIAGNOSIS AT TIME OF DISCHARGE",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({ text: ds.diagnosis, spacing: { after: 200 } })
        );
      }

      if (ds.discharge_medications) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Discharge Medications: ", bold: true }), new TextRun({ text: ds.discharge_medications })] })
        );
      }

      children.push(
        new Paragraph({ children: [new TextRun({ text: "Disposition:", bold: true })], spacing: { before: 200 } }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Normal Discharge" ? "X" : " "} ] Normal Discharge` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Discharge at Request" ? "X" : " "} ] Discharge at Request` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Discharge Against Medical Advice" ? "X" : " "} ] Discharge Against Medical Advice` }),
        new Paragraph({ text: `[ ${ds.disposition_type === "Referred" ? "X" : " "} ] Referred` })
      );

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Condition at Time of Discharge: ${ds.condition_at_discharge || "STABLE"}`, bold: true })],
          spacing: { before: 200 },
        })
      );

      if (ds.vitals_discharge) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Vitals at Time of Discharge: ", bold: true }), new TextRun({ text: formatVitals(ds.vitals_discharge) })] })
        );
      }

      if (ds.follow_up_advice) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Follow-Up Advice: ", bold: true }), new TextRun({ text: ds.follow_up_advice })], spacing: { after: 300 } })
        );
      }

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `ED Resident: ${ds.ed_resident || "_________________"}` }),
            new TextRun({ text: "     |     " }),
            new TextRun({ text: `ED Consultant: ${ds.ed_consultant || "_________________"}` }),
          ],
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Sign and Time: ${ds.sign_time_resident || "_________________"}` }),
            new TextRun({ text: "     |     " }),
            new TextRun({ text: `Sign and Time: ${ds.sign_time_consultant || "_________________"}` }),
          ],
          spacing: { before: 100 },
        }),
        new Paragraph({ text: `Date: ${ds.discharge_date || formatDate()}`, spacing: { before: 100, after: 300 } })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.",
              italics: true,
              size: 18,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        })
      );

      const docxDoc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
      });

      const buffer = await Packer.toBuffer(docxDoc);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="discharge_summary_${data.patient.name.replace(/\s+/g, "_")}.docx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("DOCX generation error:", err);
      res.status(500).json({ error: "Failed to generate DOCX" });
    }
  });

  app.post("/api/export/casesheet-pdf", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      
      if (!data.patient) {
        return res.status(400).json({ error: "Missing patient data" });
      }

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.pdf"`);
      doc.pipe(res);

      doc.fontSize(18).font("Helvetica-Bold").text("EMERGENCY DEPARTMENT CASE SHEET", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text("PATIENT INFORMATION");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Name: ${data.patient?.name || "N/A"}     Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}`);
      doc.text(`MLC: ${data.mlc ? "Yes" : "No"}     Allergy: ${data.allergy || "No known allergies"}`);
      doc.moveDown(0.5);

      if (data.presenting_complaint?.text || data.triage?.chief_complaint) {
        doc.font("Helvetica-Bold").text("Presenting Complaint:");
        doc.font("Helvetica").text(data.presenting_complaint?.text || data.triage?.chief_complaint || "");
        doc.moveDown(0.3);
      }

      if (data.vitals_at_arrival || data.triage?.vitals) {
        const vitals = data.vitals_at_arrival || data.triage?.vitals || {};
        doc.font("Helvetica-Bold").text("Vitals at Arrival:");
        doc.font("Helvetica").text(formatVitals(vitals));
        doc.moveDown(0.5);
      }

      const pa = data.primary_assessment || {};
      if (Object.keys(pa).length > 0) {
        doc.font("Helvetica-Bold").text("PRIMARY ASSESSMENT (ABCDE)");
        doc.moveDown(0.3);
        doc.font("Helvetica");
        if (pa.airway_status) doc.text(`Airway: ${pa.airway_status}${pa.airway_intervention ? `, Intervention: ${pa.airway_intervention}` : ""}`);
        if (pa.breathing_rr) doc.text(`Breathing: RR ${pa.breathing_rr}, SpO2 ${pa.breathing_spo2 || "N/A"}%`);
        if (pa.circulation_hr) doc.text(`Circulation: HR ${pa.circulation_hr}, BP ${pa.circulation_bp_systolic || ""}/${pa.circulation_bp_diastolic || ""}`);
        if (pa.disability_gcs_e) doc.text(`Disability: GCS E${pa.disability_gcs_e}V${pa.disability_gcs_v}M${pa.disability_gcs_m}`);
        if (pa.exposure_temperature) doc.text(`Exposure: Temp ${pa.exposure_temperature}°C`);
        doc.moveDown(0.5);
      }

      const sample = data.sample || {};
      if (Object.keys(sample).length > 0) {
        doc.font("Helvetica-Bold").text("SAMPLE HISTORY");
        doc.moveDown(0.3);
        doc.font("Helvetica");
        if (sample.symptoms) doc.text(`Symptoms: ${sample.symptoms}`);
        if (sample.allergies) doc.text(`Allergies: ${sample.allergies}`);
        if (sample.medications) doc.text(`Medications: ${sample.medications}`);
        if (sample.pastMedicalHistory) doc.text(`Past History: ${sample.pastMedicalHistory}`);
        if (sample.lastMeal) doc.text(`Last Meal/LMP: ${sample.lastMeal}`);
        if (sample.eventsHopi) doc.text(`Events/HOPI: ${sample.eventsHopi}`);
        doc.moveDown(0.5);
      }

      const exam = data.examination || {};
      if (Object.keys(exam).length > 0) {
        doc.font("Helvetica-Bold").text("SYSTEMIC EXAMINATION");
        doc.moveDown(0.3);
        doc.font("Helvetica");
        if (exam.cvs_status) doc.text(`CVS: ${exam.cvs_status}${exam.cvs_additional_notes ? ` - ${exam.cvs_additional_notes}` : ""}`);
        if (exam.respiratory_status) doc.text(`Respiratory: ${exam.respiratory_status}${exam.respiratory_additional_notes ? ` - ${exam.respiratory_additional_notes}` : ""}`);
        if (exam.abdomen_status) doc.text(`Abdomen: ${exam.abdomen_status}${exam.abdomen_additional_notes ? ` - ${exam.abdomen_additional_notes}` : ""}`);
        if (exam.cns_status) doc.text(`CNS: ${exam.cns_status}${exam.cns_additional_notes ? ` - ${exam.cns_additional_notes}` : ""}`);
        doc.moveDown(0.5);
      }

      const treatment = data.treatment || {};
      if (treatment.primary_diagnosis || treatment.medications) {
        doc.font("Helvetica-Bold").text("TREATMENT");
        doc.moveDown(0.3);
        doc.font("Helvetica");
        if (treatment.primary_diagnosis) doc.text(`Diagnosis: ${treatment.primary_diagnosis}`);
        if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
          doc.font("Helvetica-Bold").text("Medications:");
          doc.font("Helvetica");
          treatment.medications.forEach((med: any) => {
            doc.text(`  - ${med.name || ""} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`);
          });
        }
        if (treatment.iv_fluids) doc.text(`IV Fluids: ${treatment.iv_fluids}`);
        doc.moveDown(0.5);
      }

      doc.end();
    } catch (err) {
      console.error("Case sheet PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.post("/api/export/casesheet-docx", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      
      if (!data.patient) {
        return res.status(400).json({ error: "Missing patient data" });
      }

      const children: Paragraph[] = [];

      children.push(
        new Paragraph({
          text: "EMERGENCY DEPARTMENT CASE SHEET",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "PATIENT INFORMATION",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({ text: `Name: ${data.patient?.name || "N/A"}        Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}` }),
        new Paragraph({ text: `MLC: ${data.mlc ? "Yes" : "No"}        Allergy: ${data.allergy || "No known allergies"}`, spacing: { after: 200 } })
      );

      if (data.presenting_complaint?.text || data.triage?.chief_complaint) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "Presenting Complaint: ", bold: true }), new TextRun({ text: data.presenting_complaint?.text || data.triage?.chief_complaint || "" })] })
        );
      }

      const pa = data.primary_assessment || {};
      if (Object.keys(pa).length > 0) {
        children.push(
          new Paragraph({ text: "PRIMARY ASSESSMENT (ABCDE)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } })
        );
        if (pa.airway_status) children.push(new Paragraph({ text: `Airway: ${pa.airway_status}` }));
        if (pa.breathing_rr) children.push(new Paragraph({ text: `Breathing: RR ${pa.breathing_rr}, SpO2 ${pa.breathing_spo2 || "N/A"}%` }));
        if (pa.circulation_hr) children.push(new Paragraph({ text: `Circulation: HR ${pa.circulation_hr}, BP ${pa.circulation_bp_systolic}/${pa.circulation_bp_diastolic}` }));
        if (pa.disability_gcs_e) children.push(new Paragraph({ text: `Disability: GCS E${pa.disability_gcs_e}V${pa.disability_gcs_v}M${pa.disability_gcs_m}` }));
      }

      const sample = data.sample || {};
      if (Object.keys(sample).length > 0) {
        children.push(
          new Paragraph({ text: "SAMPLE HISTORY", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } })
        );
        if (sample.symptoms) children.push(new Paragraph({ text: `Symptoms: ${sample.symptoms}` }));
        if (sample.allergies) children.push(new Paragraph({ text: `Allergies: ${sample.allergies}` }));
        if (sample.medications) children.push(new Paragraph({ text: `Medications: ${sample.medications}` }));
        if (sample.pastMedicalHistory) children.push(new Paragraph({ text: `Past History: ${sample.pastMedicalHistory}` }));
        if (sample.eventsHopi) children.push(new Paragraph({ text: `Events/HOPI: ${sample.eventsHopi}` }));
      }

      const exam = data.examination || {};
      if (Object.keys(exam).length > 0) {
        children.push(
          new Paragraph({ text: "SYSTEMIC EXAMINATION", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } })
        );
        if (exam.cvs_status) children.push(new Paragraph({ text: `CVS: ${exam.cvs_status}` }));
        if (exam.respiratory_status) children.push(new Paragraph({ text: `Respiratory: ${exam.respiratory_status}` }));
        if (exam.abdomen_status) children.push(new Paragraph({ text: `Abdomen: ${exam.abdomen_status}` }));
        if (exam.cns_status) children.push(new Paragraph({ text: `CNS: ${exam.cns_status}` }));
      }

      const treatment = data.treatment || {};
      if (treatment.primary_diagnosis || treatment.medications) {
        children.push(
          new Paragraph({ text: "TREATMENT", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } })
        );
        if (treatment.primary_diagnosis) children.push(new Paragraph({ text: `Diagnosis: ${treatment.primary_diagnosis}` }));
        if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Medications:", bold: true })] }));
          treatment.medications.forEach((med: any) => {
            children.push(new Paragraph({ text: `  - ${med.name || ""} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}` }));
          });
        }
      }

      const docxDoc = new Document({
        sections: [{ properties: {}, children }],
      });

      const buffer = await Packer.toBuffer(docxDoc);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.docx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Case sheet DOCX generation error:", err);
      res.status(500).json({ error: "Failed to generate DOCX" });
    }
  });

  app.post("/api/ai/diagnose", async (req: Request, res: Response) => {
    try {
      const { chiefComplaint, vitals, history, examination, age, gender } = req.body;
      
      if (!chiefComplaint) {
        return res.status(400).json({ error: "Chief complaint is required" });
      }

      const result = await generateDiagnosisSuggestions({
        chiefComplaint,
        vitals: vitals || {},
        history: history || "",
        examination: examination || "",
        age: age || 30,
        gender: gender || "Unknown",
      });

      res.json(result);
    } catch (error) {
      console.error("AI diagnosis error:", error);
      res.status(500).json({ error: "Failed to generate diagnosis suggestions" });
    }
  });

  app.post("/api/ai/feedback", async (req: Request, res: Response) => {
    try {
      const { suggestionId, caseId, feedbackType, userCorrection, suggestionText, userId } = req.body;
      
      if (!suggestionId || !feedbackType) {
        return res.status(400).json({ error: "Missing required fields (suggestionId, feedbackType)" });
      }

      if (!caseId || caseId.trim() === "") {
        return res.status(400).json({ error: "Valid caseId is required for feedback tracking" });
      }

      const feedback: AIFeedback = {
        suggestionId,
        caseId,
        feedbackType,
        userCorrection,
        suggestionText,
        userId,
        timestamp: new Date(),
      };

      const result = await recordFeedback(feedback);
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(503).json({ error: result.error || "Failed to record feedback" });
      }
    } catch (error) {
      console.error("Feedback error:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });

  app.get("/api/ai/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getFeedbackStats();
      const insights = await getLearningInsights();
      res.json({ stats, insights });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to get AI stats" });
    }
  });

  app.post("/api/ai/discharge-summary", async (req: Request, res: Response) => {
    try {
      const { case_id, summary_data } = req.body;
      
      if (!summary_data) {
        return res.status(400).json({ error: "Summary data is required" });
      }

      const result = await generateCourseInHospital(summary_data);
      
      res.json({ 
        success: true, 
        summary: {
          course_in_hospital: result.course_in_hospital,
          diagnosis: result.diagnosis,
        }
      });
    } catch (error) {
      console.error("Discharge summary generation error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to generate discharge summary" });
    }
  });

  app.post("/api/ai/extract-clinical", async (req: Request, res: Response) => {
    try {
      const { transcription, patientContext } = req.body;
      
      if (!transcription) {
        return res.status(400).json({ error: "Transcription is required" });
      }

      const extracted = await extractClinicalDataFromVoice(transcription, patientContext);
      
      res.json({ 
        success: true, 
        extracted 
      });
    } catch (error) {
      console.error("Clinical extraction error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to extract clinical data" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
