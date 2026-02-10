import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import multer from "multer";
import { generateDiagnosisSuggestions, recordFeedback, getFeedbackStats, getLearningInsights, generateCourseInHospital, extractClinicalDataFromVoice, transcribeAndExtractVoice, type AIFeedback, type FeedbackResult, type ExtractedClinicalData } from "./services/aiDiagnosis";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

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

function formatVitals(vitals: any): string {
  if (!vitals) return "";
  const parts: string[] = [];
  if (vitals.hr) parts.push(`HR: ${vitals.hr}`);
  const bp = vitals.bp || ((vitals.bp_systolic || vitals.bp_diastolic) ? `${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"}` : "");
  if (bp) parts.push(`BP: ${bp}`);
  if (vitals.rr) parts.push(`RR: ${vitals.rr}`);
  if (vitals.spo2) parts.push(`SpO2: ${vitals.spo2}%`);
  const temp = vitals.temperature || vitals.temp;
  if (temp) parts.push(`Temp: ${temp}\u00B0F`);
  const gcsE = vitals.gcs_e; const gcsV = vitals.gcs_v; const gcsM = vitals.gcs_m;
  if (gcsE || gcsV || gcsM) {
    const total = (parseInt(gcsE) || 0) + (parseInt(gcsV) || 0) + (parseInt(gcsM) || 0);
    parts.push(`GCS: ${total || "-"} (E${gcsE || "-"}V${gcsV || "-"}M${gcsM || "-"})`);
  } else if (vitals.gcs) {
    parts.push(`GCS: ${vitals.gcs}`);
  }
  if (vitals.pain_score) parts.push(`Pain: ${vitals.pain_score}/10`);
  if (vitals.grbs) parts.push(`GRBS: ${vitals.grbs}`);
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

      const patientAge = parseFloat(data.patient?.age) || 0;
      const isPed = patientAge > 0 && patientAge <= 16;
      const primary = data.primary_assessment || data.abcde || {};
      const vitals = data.vitals_at_arrival || data.triage?.vitals || {};
      const adjuncts = data.adjuncts || {};
      const abgData = data.abg || adjuncts.abg || {};
      const history = data.history || {};
      const exam = data.examination || {};
      const investigations = data.investigations || {};
      const treatment = data.treatment || {};
      const procedures = data.procedures || {};
      const proceduresPerformed = data.procedures_performed || procedures.procedures_performed || procedures.performed || [];
      const proceduresNotes = procedures.general_notes || procedures.generalNotes || "";
      const disposition = data.disposition || {};
      const erObs = data.er_observation || {};
      const addendumNotes = treatment.addendum_notes || data.addendum_notes || [];

      const airway = primary.airway || {};
      const breathing = primary.breathing || {};
      const circulation = primary.circulation || {};
      const disability = primary.disability || {};
      const exposure = primary.exposure || {};
      const pat = primary.pat || {};
      const efast = primary.efast || {};

      const sections: string[] = [];
      if (data.patient) sections.push("patient");
      if (Object.keys(vitals).length > 0) sections.push("vitals");
      if (Object.keys(primary).length > 0) sections.push("primary_assessment");
      if (Object.keys(adjuncts).length > 0) sections.push("adjuncts");
      if (Object.keys(abgData).length > 0) sections.push("abg");
      if (Object.keys(history).length > 0) sections.push("history");
      if (Object.keys(exam).length > 0) sections.push("examination");
      if (Object.keys(investigations).length > 0) sections.push("investigations");
      if (Object.keys(treatment).length > 0) sections.push("treatment");
      if (proceduresPerformed.length > 0 || proceduresNotes) sections.push("procedures");
      if (Object.keys(disposition).length > 0) sections.push("disposition");
      if (Object.keys(erObs).length > 0) sections.push("er_observation");
      if (Array.isArray(addendumNotes) && addendumNotes.length > 0) sections.push("addendum_notes");
      console.log("[EXPORT] PDF sections found:", sections.join(", "), "| isPediatric:", isPed);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="casesheet_${(data.patient?.name || "patient").replace(/\s+/g, "_")}.pdf"`);
      doc.pipe(res);

      const pdfLine = () => { doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(); };
      const pdfHeading = (t: string) => { doc.moveDown(0.3); doc.fontSize(12).font("Helvetica-Bold").text(t); doc.moveDown(0.2); doc.fontSize(10).font("Helvetica"); };
      const pdfSubHeading = (t: string) => { doc.fontSize(10).font("Helvetica-Bold").text(t); doc.font("Helvetica"); };
      const pdfField = (label: string, val: any) => { if (val !== undefined && val !== null && val !== "") doc.text(`${label}: ${val}`); };
      const pdfFieldArr = (label: string, arr: any) => {
        if (!arr) return;
        const text = Array.isArray(arr) ? arr.filter(Boolean).join(", ") : String(arr);
        if (text) doc.text(`${label}: ${text}`);
      };
      const ensureSpace = () => { if (doc.y > 720) doc.addPage(); };

      doc.fontSize(18).font("Helvetica-Bold").text("EMERGENCY DEPARTMENT CASE SHEET", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
      doc.moveDown(0.5);
      pdfLine();

      pdfHeading("PATIENT INFORMATION");
      pdfField("Name", data.patient?.name || "N/A");
      doc.text(`Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}`);
      pdfField("UHID", data.patient?.uhid);
      pdfField("Phone", data.patient?.phone);
      pdfField("Mode of Arrival", data.patient?.mode_of_arrival || data.mode_of_arrival);
      pdfField("MLC", data.mlc ? "Yes" : "No");
      if (data.patient?.arrival_datetime) pdfField("Arrival Time", new Date(data.patient.arrival_datetime).toLocaleString("en-IN"));
      if (data.em_resident) pdfField("EM Resident", data.em_resident);
      if (data.em_consultant) pdfField("EM Consultant", data.em_consultant);
      doc.moveDown(0.3);

      if (data.triage_priority) {
        pdfSubHeading("Triage");
        doc.text(`Priority ${data.triage_priority} - ${(data.triage_color || "").toUpperCase()}`);
        doc.moveDown(0.2);
      }

      const complaintText = data.presenting_complaint?.text || data.triage?.chief_complaint || "";
      if (complaintText) {
        pdfSubHeading("Presenting Complaint");
        let ccLine = complaintText;
        if (data.presenting_complaint?.duration) ccLine += ` | Duration: ${data.presenting_complaint.duration}`;
        if (data.presenting_complaint?.onset_type) ccLine += ` | Onset: ${data.presenting_complaint.onset_type}`;
        doc.text(ccLine);
        doc.moveDown(0.3);
      }

      if (Object.keys(vitals).length > 0) {
        pdfSubHeading("Vitals at Arrival");
        doc.text(formatVitals(vitals));
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(primary).length > 0) {
        pdfHeading("PRIMARY ASSESSMENT (ABCDE)");

        if (isPed && Object.keys(pat).length > 0) {
          pdfSubHeading("Pediatric Assessment Triangle (PAT)");
          const appearance = pat.appearance || {};
          const appParts: string[] = [];
          const tone = appearance.tone || pat.tone; if (tone) appParts.push(`Tone: ${tone}`);
          const interactivity = appearance.interactivity || pat.interactivity; if (interactivity) appParts.push(`Interactivity: ${interactivity}`);
          const consolability = appearance.consolability || pat.consolability; if (consolability) appParts.push(`Consolability: ${consolability}`);
          const lookGaze = appearance.lookGaze || pat.lookGaze; if (lookGaze) appParts.push(`Look/Gaze: ${lookGaze}`);
          const speechCry = appearance.speechCry || pat.speechCry; if (speechCry) appParts.push(`Speech/Cry: ${speechCry}`);
          if (appParts.length > 0) doc.text(`Appearance: ${appParts.join(", ")}`);
          pdfField("Work of Breathing", pat.workOfBreathing);
          pdfField("Circulation to Skin", pat.circulationToSkin);
          doc.moveDown(0.2);
        }

        const airwayStatus = airway.status || primary.airway_status;
        const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
        const airwayNotes = airway.notes || primary.airway_additional_notes;
        if (airwayStatus || airwayInterventions || airwayNotes) {
          let aLine = `Airway: ${airwayStatus || "N/A"}`;
          if (airwayInterventions) aLine += ` | Interventions: ${Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions}`;
          if (airway.cry) aLine += ` | Cry: ${airway.cry}`;
          if (airwayNotes) aLine += ` | Notes: ${airwayNotes}`;
          doc.text(aLine);
        }

        const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
        const bSpO2 = breathing.spo2 || primary.breathing_spo2;
        const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
        const bO2Device = breathing.o2Device || primary.breathing_oxygen_device;
        const bO2Flow = breathing.o2Flow || primary.breathing_oxygen_flow;
        if (bRR || bSpO2 || bEffort) {
          let bLine = "Breathing:";
          if (bRR) bLine += ` RR ${bRR}`;
          if (bSpO2) bLine += `, SpO2 ${bSpO2}%`;
          if (bEffort) bLine += ` | Effort: ${Array.isArray(bEffort) ? bEffort.join(", ") : bEffort}`;
          if (bO2Device) bLine += ` | O2 Device: ${bO2Device}`;
          if (bO2Flow) bLine += ` @ ${bO2Flow} L/min`;
          if (breathing.airEntry) bLine += ` | Air Entry: ${breathing.airEntry}`;
          if (breathing.abnormalPositioning) bLine += ` | Positioning: ${breathing.abnormalPositioning}`;
          if (breathing.subcutaneousEmphysema) bLine += ` | Subcut Emphysema: ${breathing.subcutaneousEmphysema}`;
          if (breathing.intervention) bLine += ` | Intervention: ${Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention}`;
          doc.text(bLine);
        }

        const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
        const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
        const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
        const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
        const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
        if (cHR || cBPS || cCRT) {
          let cLine = "Circulation:";
          if (cHR) cLine += ` HR ${cHR}`;
          if (cBPS && cBPD) cLine += `, BP ${cBPS}/${cBPD}`;
          else if (cBPS) cLine += `, BP ${cBPS}`;
          if (cCRT) cLine += ` | CRT: ${cCRT}`;
          if (circulation.skinColorTemp) cLine += ` | Skin: ${circulation.skinColorTemp}`;
          if (circulation.distendedNeckVeins) cLine += ` | Neck Veins: ${circulation.distendedNeckVeins}`;
          if (cAdj) cLine += ` | Adjuncts: ${Array.isArray(cAdj) ? cAdj.join(", ") : cAdj}`;
          doc.text(cLine);
        }

        const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
        const dGE = disability.gcsE || primary.disability_gcs_e;
        const dGV = disability.gcsV || primary.disability_gcs_v;
        const dGM = disability.gcsM || primary.disability_gcs_m;
        const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
        const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
        const dGlucose = disability.glucose || primary.disability_grbs;
        if (dAVPU || dGE || dPupilSize || dGlucose) {
          let dLine = "Disability:";
          if (dAVPU) dLine += ` ${dAVPU}`;
          if (dGE || dGV || dGM) {
            const total = (parseInt(dGE) || 0) + (parseInt(dGV) || 0) + (parseInt(dGM) || 0);
            dLine += ` | GCS ${total || "-"} (E${dGE || "-"}V${dGV || "-"}M${dGM || "-"})`;
          }
          if (dPupilSize) dLine += ` | Pupils: ${dPupilSize}`;
          if (dPupilReact) dLine += ` (${dPupilReact})`;
          if (dGlucose) dLine += ` | Glucose: ${dGlucose}`;
          if (disability.abnormalResponses) dLine += ` | Abnormal Responses: ${disability.abnormalResponses}`;
          doc.text(dLine);
        }

        const eTemp = exposure.temperature || primary.exposure_temperature;
        const eNotes = exposure.notes || primary.exposure_additional_notes;
        if (eTemp || eNotes || exposure.trauma || exposure.signsOfTraumaIllness) {
          let eLine = "Exposure:";
          if (eTemp) eLine += ` Temp ${eTemp}\u00B0F`;
          if (exposure.trauma) eLine += ` | Trauma: ${exposure.trauma}`;
          if (exposure.signsOfTraumaIllness) eLine += ` | Signs: ${Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness}`;
          if (exposure.evidenceOfInfection) eLine += ` | Infection: ${exposure.evidenceOfInfection}`;
          if (exposure.longBoneDeformities) eLine += ` | Long Bone: ${exposure.longBoneDeformities}`;
          if (exposure.extremities) eLine += ` | Extremities: ${exposure.extremities}`;
          if (exposure.immobilize) eLine += ` | Immobilize: ${exposure.immobilize}`;
          if (eNotes) eLine += ` | Notes: ${eNotes}`;
          doc.text(eLine);
        }

        if (isPed && Object.keys(efast).length > 0) {
          let efLine = "EFAST:";
          if (efast.heart) efLine += ` Heart: ${efast.heart}`;
          if (efast.abdomen) efLine += ` | Abdomen: ${efast.abdomen}`;
          if (efast.lungs) efLine += ` | Lungs: ${efast.lungs}`;
          if (efast.pelvis) efLine += ` | Pelvis: ${efast.pelvis}`;
          doc.text(efLine);
        }
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(adjuncts).length > 0 && (adjuncts.ecg_findings || adjuncts.bedside_echo || adjuncts.additional_notes || adjuncts.efast_status || adjuncts.efast_notes)) {
        pdfHeading("ADJUNCTS TO PRIMARY SURVEY");
        pdfField("ABG/VBG", adjuncts.additional_notes);
        pdfField("ECG", adjuncts.ecg_findings);
        if (adjuncts.efast_status || adjuncts.efast_notes) doc.text(`EFAST: ${adjuncts.efast_status || ""}${adjuncts.efast_notes ? ` - ${adjuncts.efast_notes}` : ""}`);
        pdfField("Bedside Echo", adjuncts.bedside_echo);
        doc.moveDown(0.3);
      }

      if (Object.keys(abgData).length > 0) {
        pdfSubHeading("ABG Values");
        const abgParts: string[] = [];
        if (abgData.pH) abgParts.push(`pH: ${abgData.pH}`);
        if (abgData.pCO2) abgParts.push(`pCO2: ${abgData.pCO2}`);
        if (abgData.pO2) abgParts.push(`pO2: ${abgData.pO2}`);
        if (abgData.HCO3) abgParts.push(`HCO3: ${abgData.HCO3}`);
        if (abgData.BE) abgParts.push(`BE: ${abgData.BE}`);
        if (abgData.Lactate) abgParts.push(`Lactate: ${abgData.Lactate}`);
        if (abgData.SaO2) abgParts.push(`SaO2: ${abgData.SaO2}`);
        if (abgData.FiO2) abgParts.push(`FiO2: ${abgData.FiO2}`);
        if (abgData.Na) abgParts.push(`Na: ${abgData.Na}`);
        if (abgData.K) abgParts.push(`K: ${abgData.K}`);
        if (abgData.Cl) abgParts.push(`Cl: ${abgData.Cl}`);
        if (abgData.AnionGap) abgParts.push(`AG: ${abgData.AnionGap}`);
        if (abgData.Glucose) abgParts.push(`Glucose: ${abgData.Glucose}`);
        if (abgData.Hb) abgParts.push(`Hb: ${abgData.Hb}`);
        if (abgData.AaGradient) abgParts.push(`A-a Gradient: ${abgData.AaGradient}`);
        if (abgParts.length > 0) doc.text(abgParts.join(" | "));
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(history).length > 0) {
        if (isPed) {
          pdfHeading("SAMPLE HISTORY (PEDIATRIC)");
          const signsObj = history.signsAndSymptoms || {};
          const signsText = history.signs_and_symptoms || "";
          if (Object.keys(signsObj).length > 0) {
            const sParts: string[] = [];
            if (signsObj.breathingDifficulty) sParts.push(`Breathing Difficulty: ${signsObj.breathingDifficulty}`);
            if (signsObj.fever) sParts.push(`Fever: ${signsObj.fever}`);
            if (signsObj.vomiting) sParts.push(`Vomiting: ${signsObj.vomiting}`);
            if (signsObj.decreasedOralIntake) sParts.push(`Decreased Oral Intake: ${signsObj.decreasedOralIntake}`);
            if (signsObj.timeCourse) sParts.push(`Time Course: ${signsObj.timeCourse}`);
            if (signsObj.notes) sParts.push(`Notes: ${signsObj.notes}`);
            doc.text(`Signs & Symptoms: ${sParts.join(", ")}`);
          } else if (signsText) {
            pdfField("Signs & Symptoms", signsText);
          }
          pdfFieldArr("Allergies", history.allergies);
          pdfField("Current Medications", history.currentMedications || history.medications || history.drug_history);
          pdfField("Last Dose Medications", history.lastDoseMedications);
          pdfField("Medications in Environment", history.medicationsInEnvironment);
          pdfField("Health History", history.healthHistory || history.past_medical);
          pdfField("Underlying Conditions", history.underlyingConditions);
          pdfField("Immunization Status", history.immunizationStatus);
          pdfField("Last Meal", history.lastMeal || history.last_meal);
          pdfField("LMP", history.lmp);
          pdfField("Events", history.events || history.hpi || history.events_hopi);
          pdfField("Treatment Before Arrival", history.treatmentBeforeArrival);
        } else {
          pdfHeading("HISTORY");
          const hpi = history.hpi || history.events_hopi || data.sample?.eventsHopi || "";
          pdfField("HPI / Events", hpi);
          const pastMed = Array.isArray(history.past_medical) ? history.past_medical.join(", ") : history.past_medical;
          pdfField("Past Medical History", pastMed);
          pdfField("Past Surgical History", history.past_surgical);
          const allergies = Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies;
          pdfField("Allergies", allergies);
          pdfField("Medications / Drug History", history.medications || history.drug_history);
          pdfField("Last Meal / LMP", history.last_meal || history.last_meal_lmp);
          pdfField("LMP", history.lmp);
        }
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(exam).length > 0) {
        if (isPed) {
          pdfHeading("PHYSICAL EXAMINATION (PEDIATRIC)");
          const heent = exam.heent || data.heent || data.physical_exam?.heent || {};
          if (typeof heent === "object" && Object.keys(heent).length > 0) {
            pdfSubHeading("HEENT");
            pdfField("Head", heent.head);
            pdfField("Eyes", heent.eyes);
            pdfField("Ears", heent.ears);
            pdfField("Nose", heent.nose);
            pdfField("Throat", heent.throat);
            pdfField("Lymph Nodes", heent.lymphNodes);
          }
          pdfField("Respiratory", exam.respiratory || data.physical_exam?.respiratory || exam.respiratory_additional_notes);
          pdfField("Cardiovascular", exam.cardiovascular || data.physical_exam?.cardiovascular || exam.cvs_additional_notes);
          pdfField("Abdomen", exam.abdomen || data.physical_exam?.abdomen || exam.abdomen_additional_notes);
          pdfField("Back", exam.back || data.physical_exam?.back);
          pdfField("Extremities", exam.extremities || data.physical_exam?.extremities || exam.extremities_additional_notes || exam.extremities_findings);
        } else {
          pdfHeading("PHYSICAL EXAMINATION");
          const genFindings: string[] = [];
          if (exam.general_pallor) genFindings.push("Pallor");
          if (exam.general_icterus) genFindings.push("Icterus");
          if (exam.general_cyanosis) genFindings.push("Cyanosis");
          if (exam.general_clubbing) genFindings.push("Clubbing");
          if (exam.general_lymphadenopathy) genFindings.push("Lymphadenopathy");
          if (exam.general_edema) genFindings.push("Edema");
          if (genFindings.length > 0 || exam.general_appearance || exam.general_additional_notes) {
            pdfSubHeading("General Examination");
            if (exam.general_appearance) doc.text(`Appearance: ${exam.general_appearance}`);
            doc.text(genFindings.length > 0 ? genFindings.join(", ") : "No significant findings");
            if (exam.general_additional_notes) doc.text(`Notes: ${exam.general_additional_notes}`);
          }
          if (exam.cvs_status || exam.cvs_additional_notes) {
            pdfSubHeading("CVS");
            pdfField("Status", exam.cvs_status);
            pdfField("S1/S2", exam.cvs_s1_s2);
            pdfField("Pulse", exam.cvs_pulse);
            pdfField("Pulse Rate", exam.cvs_pulse_rate);
            pdfField("Apex Beat", exam.cvs_apexBeat);
            pdfField("Murmurs", exam.cvs_murmurs);
            pdfField("Added Sounds", exam.cvs_added_sounds);
            pdfField("Notes", exam.cvs_additional_notes);
          }
          if (exam.respiratory_status || exam.respiratory_additional_notes) {
            pdfSubHeading("Respiratory");
            pdfField("Status", exam.respiratory_status);
            pdfField("Expansion", exam.respiratory_expansion);
            pdfField("Breath Sounds", exam.respiratory_breath_sounds);
            pdfField("Percussion", exam.respiratory_percussion);
            pdfField("Added Sounds", exam.respiratory_added_sounds);
            pdfField("Notes", exam.respiratory_additional_notes);
          }
          if (exam.abdomen_status || exam.abdomen_additional_notes) {
            pdfSubHeading("Abdomen");
            pdfField("Status", exam.abdomen_status);
            pdfField("Bowel Sounds", exam.abdomen_bowel_sounds);
            pdfField("Percussion", exam.abdomen_percussion);
            pdfField("Organomegaly", exam.abdomen_organomegaly);
            pdfField("Notes", exam.abdomen_additional_notes);
          }
          if (exam.cns_status || exam.cns_additional_notes) {
            pdfSubHeading("CNS");
            pdfField("Status", exam.cns_status);
            pdfField("Higher Mental Functions", exam.cns_higher_mental_functions);
            pdfField("Cranial Nerves", exam.cns_cranial_nerves);
            pdfField("Motor System", exam.cns_motor_system);
            pdfField("Sensory System", exam.cns_sensory_system);
            pdfField("Reflexes", exam.cns_reflexes);
            pdfField("Notes", exam.cns_additional_notes);
          }
          if (exam.extremities_status || exam.extremities_findings || exam.extremities_additional_notes) {
            pdfSubHeading("Extremities");
            pdfField("Status", exam.extremities_status);
            pdfField("Findings", exam.extremities_findings);
            pdfField("Notes", exam.extremities_additional_notes);
          }
        }
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(investigations).length > 0 && (investigations.panels_selected?.length > 0 || investigations.individual_tests?.length > 0 || investigations.imaging || investigations.results_notes)) {
        pdfHeading("INVESTIGATIONS");
        if (Array.isArray(investigations.panels_selected) && investigations.panels_selected.length > 0) doc.text(`Lab Panels: ${investigations.panels_selected.join(", ")}`);
        if (Array.isArray(investigations.individual_tests) && investigations.individual_tests.length > 0) doc.text(`Individual Tests: ${investigations.individual_tests.join(", ")}`);
        if (investigations.imaging) {
          const imgText = Array.isArray(investigations.imaging) ? investigations.imaging.join(", ") : investigations.imaging;
          doc.text(`Imaging: ${imgText}`);
        }
        pdfField("Results Notes", investigations.results_notes);
        doc.moveDown(0.3);
      }

      ensureSpace();
      const primaryDiag = treatment.primary_diagnosis || (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0 ? treatment.provisional_diagnoses[0] : "");
      if (primaryDiag || treatment.medications?.length > 0 || treatment.infusions?.length > 0 || treatment.fluids || treatment.interventions?.length > 0 || treatment.intervention_notes || treatment.other_medications) {
        pdfHeading("TREATMENT");
        pdfField("Primary Diagnosis", primaryDiag);
        if (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0) {
          doc.text(`Provisional Diagnoses: ${treatment.provisional_diagnoses.join(", ")}`);
        }
        if (treatment.differential_diagnoses) {
          const diffs = Array.isArray(treatment.differential_diagnoses) ? treatment.differential_diagnoses.join(", ") : treatment.differential_diagnoses;
          pdfField("Differential Diagnoses", diffs);
        }
        if (Array.isArray(treatment.interventions) && treatment.interventions.length > 0) doc.text(`Interventions: ${treatment.interventions.join(", ")}`);
        pdfField("Intervention Notes", treatment.intervention_notes);

        if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
          pdfSubHeading("Medications:");
          treatment.medications.forEach((med: any) => {
            const name = med.name || med.drug_name || "";
            doc.text(`  - ${name} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim());
          });
        }
        if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
          pdfSubHeading("Infusions:");
          treatment.infusions.forEach((inf: any) => {
            const name = inf.name || inf.drug_name || inf.drug || "";
            doc.text(`  - ${name} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim());
          });
        }
        if (treatment.fluids) pdfField("IV Fluids", treatment.fluids);
        if (treatment.other_medications) pdfField("Other Medications", treatment.other_medications);
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (proceduresPerformed.length > 0 || proceduresNotes) {
        pdfHeading("PROCEDURES");
        if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
          proceduresPerformed.forEach((proc: any) => {
            if (typeof proc === "string") {
              doc.text(`  - ${proc}`);
            } else {
              doc.text(`  - ${proc.name || "Procedure"}${proc.notes ? `: ${proc.notes}` : ""}`);
            }
          });
        }
        if (proceduresNotes) pdfField("General Notes", proceduresNotes);
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (erObs.notes || erObs.duration) {
        pdfHeading("ER OBSERVATION");
        pdfField("Duration", erObs.duration);
        pdfField("Notes", erObs.notes);
        doc.moveDown(0.3);
      }

      ensureSpace();
      if (Object.keys(disposition).length > 0 && (disposition.type || disposition.admit_to || disposition.destination || disposition.department || disposition.notes)) {
        pdfHeading("DISPOSITION");
        pdfField("Type", disposition.type);
        pdfField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
        pdfField("Room", disposition.admit_to_room);
        pdfField("Refer To", disposition.refer_to);
        pdfField("Condition at Discharge", disposition.condition_at_discharge || disposition.condition);
        pdfField("Notes", disposition.notes);
        doc.moveDown(0.3);
      }

      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        ensureSpace();
        pdfHeading("ADDENDUM NOTES");
        addNotes.forEach((note: string, i: number) => {
          doc.text(`${i + 1}. ${note}`);
        });
        doc.moveDown(0.3);
      }

      if (data.status || data.created_at || data.updated_at) {
        ensureSpace();
        pdfSubHeading("Case Info");
        pdfField("Status", data.status);
        if (data.created_at) pdfField("Created", new Date(data.created_at).toLocaleString("en-IN"));
        if (data.updated_at) pdfField("Updated", new Date(data.updated_at).toLocaleString("en-IN"));
        doc.moveDown(0.3);
      }

      doc.moveDown(0.5);
      pdfLine();
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica-Oblique").text("This case sheet is generated from ERmate for clinical documentation purposes.", { align: "center" });

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

      const patientAge = parseFloat(data.patient?.age) || 0;
      const isPed = patientAge > 0 && patientAge <= 16;
      const primary = data.primary_assessment || data.abcde || {};
      const vitals = data.vitals_at_arrival || data.triage?.vitals || {};
      const adjuncts = data.adjuncts || {};
      const abgData = data.abg || adjuncts.abg || {};
      const history = data.history || {};
      const exam = data.examination || {};
      const investigations = data.investigations || {};
      const treatment = data.treatment || {};
      const procedures = data.procedures || {};
      const proceduresPerformed = data.procedures_performed || procedures.procedures_performed || procedures.performed || [];
      const proceduresNotes = procedures.general_notes || procedures.generalNotes || "";
      const disposition = data.disposition || {};
      const erObs = data.er_observation || {};
      const addendumNotes = treatment.addendum_notes || data.addendum_notes || [];

      const airway = primary.airway || {};
      const breathing = primary.breathing || {};
      const circulation = primary.circulation || {};
      const disability = primary.disability || {};
      const exposure = primary.exposure || {};
      const pat = primary.pat || {};
      const efast = primary.efast || {};

      const dSections: string[] = [];
      if (data.patient) dSections.push("patient");
      if (Object.keys(vitals).length > 0) dSections.push("vitals");
      if (Object.keys(primary).length > 0) dSections.push("primary_assessment");
      if (Object.keys(adjuncts).length > 0) dSections.push("adjuncts");
      if (Object.keys(abgData).length > 0) dSections.push("abg");
      if (Object.keys(history).length > 0) dSections.push("history");
      if (Object.keys(exam).length > 0) dSections.push("examination");
      if (Object.keys(investigations).length > 0) dSections.push("investigations");
      if (Object.keys(treatment).length > 0) dSections.push("treatment");
      if (proceduresPerformed.length > 0 || proceduresNotes) dSections.push("procedures");
      if (Object.keys(disposition).length > 0) dSections.push("disposition");
      if (Object.keys(erObs).length > 0) dSections.push("er_observation");
      if (Array.isArray(addendumNotes) && addendumNotes.length > 0) dSections.push("addendum_notes");
      console.log("[EXPORT] DOCX sections found:", dSections.join(", "), "| isPediatric:", isPed);

      const children: Paragraph[] = [];

      const dH = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } });
      const dP = (t: string) => new Paragraph({ text: t, spacing: { after: 40 } });
      const dBold = (label: string, val: string) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: val })], spacing: { after: 40 } });
      const dField = (label: string, val: any) => { if (val !== undefined && val !== null && val !== "") children.push(dBold(label, String(val))); };
      const dFieldArr = (label: string, arr: any) => {
        if (!arr) return;
        const text = Array.isArray(arr) ? arr.filter(Boolean).join(", ") : String(arr);
        if (text) children.push(dBold(label, text));
      };

      children.push(
        new Paragraph({ text: "EMERGENCY DEPARTMENT CASE SHEET", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ text: `Generated: ${new Date().toLocaleDateString("en-IN")}`, alignment: AlignmentType.CENTER, spacing: { after: 300 } })
      );

      children.push(dH("PATIENT INFORMATION"));
      dField("Name", data.patient?.name || "N/A");
      children.push(dP(`Age/Sex: ${data.patient?.age || "N/A"} / ${data.patient?.sex || "N/A"}`));
      dField("UHID", data.patient?.uhid);
      dField("Phone", data.patient?.phone);
      dField("Mode of Arrival", data.patient?.mode_of_arrival || data.mode_of_arrival);
      dField("MLC", data.mlc ? "Yes" : "No");
      if (data.patient?.arrival_datetime) dField("Arrival Time", new Date(data.patient.arrival_datetime).toLocaleString("en-IN"));
      if (data.em_resident) dField("EM Resident", data.em_resident);
      if (data.em_consultant) dField("EM Consultant", data.em_consultant);

      if (data.triage_priority) {
        children.push(dBold("Triage", `Priority ${data.triage_priority} - ${(data.triage_color || "").toUpperCase()}`));
      }

      const complaintText = data.presenting_complaint?.text || data.triage?.chief_complaint || "";
      if (complaintText) {
        let ccLine = complaintText;
        if (data.presenting_complaint?.duration) ccLine += ` | Duration: ${data.presenting_complaint.duration}`;
        if (data.presenting_complaint?.onset_type) ccLine += ` | Onset: ${data.presenting_complaint.onset_type}`;
        children.push(dBold("Presenting Complaint", ccLine));
      }

      if (Object.keys(vitals).length > 0) {
        children.push(dBold("Vitals at Arrival", formatVitals(vitals)));
      }

      if (Object.keys(primary).length > 0) {
        children.push(dH("PRIMARY ASSESSMENT (ABCDE)"));

        if (isPed && Object.keys(pat).length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Pediatric Assessment Triangle (PAT)", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
          const appearance = pat.appearance || {};
          const appParts: string[] = [];
          const tone = appearance.tone || pat.tone; if (tone) appParts.push(`Tone: ${tone}`);
          const interactivity = appearance.interactivity || pat.interactivity; if (interactivity) appParts.push(`Interactivity: ${interactivity}`);
          const consolability = appearance.consolability || pat.consolability; if (consolability) appParts.push(`Consolability: ${consolability}`);
          const lookGaze = appearance.lookGaze || pat.lookGaze; if (lookGaze) appParts.push(`Look/Gaze: ${lookGaze}`);
          const speechCry = appearance.speechCry || pat.speechCry; if (speechCry) appParts.push(`Speech/Cry: ${speechCry}`);
          if (appParts.length > 0) children.push(dBold("Appearance", appParts.join(", ")));
          if (pat.workOfBreathing) dField("Work of Breathing", pat.workOfBreathing);
          if (pat.circulationToSkin) dField("Circulation to Skin", pat.circulationToSkin);
        }

        const airwayStatus = airway.status || primary.airway_status;
        const airwayInterventions = airway.interventions || primary.airway_interventions || airway.intervention;
        const airwayNotes = airway.notes || primary.airway_additional_notes;
        if (airwayStatus || airwayInterventions || airwayNotes) {
          let aLine = airwayStatus || "N/A";
          if (airwayInterventions) aLine += ` | Interventions: ${Array.isArray(airwayInterventions) ? airwayInterventions.join(", ") : airwayInterventions}`;
          if (airway.cry) aLine += ` | Cry: ${airway.cry}`;
          if (airwayNotes) aLine += ` | Notes: ${airwayNotes}`;
          children.push(dBold("Airway", aLine));
        }

        const bRR = breathing.rr || breathing.respiratoryRate || primary.breathing_rr;
        const bSpO2 = breathing.spo2 || primary.breathing_spo2;
        const bEffort = breathing.effort || breathing.workOfBreathing || primary.breathing_work;
        const bO2Device = breathing.o2Device || primary.breathing_oxygen_device;
        const bO2Flow = breathing.o2Flow || primary.breathing_oxygen_flow;
        if (bRR || bSpO2 || bEffort) {
          let bLine = "";
          if (bRR) bLine += `RR ${bRR}`;
          if (bSpO2) bLine += `, SpO2 ${bSpO2}%`;
          if (bEffort) bLine += ` | Effort: ${Array.isArray(bEffort) ? bEffort.join(", ") : bEffort}`;
          if (bO2Device) bLine += ` | O2 Device: ${bO2Device}`;
          if (bO2Flow) bLine += ` @ ${bO2Flow} L/min`;
          if (breathing.airEntry) bLine += ` | Air Entry: ${breathing.airEntry}`;
          if (breathing.abnormalPositioning) bLine += ` | Positioning: ${breathing.abnormalPositioning}`;
          if (breathing.subcutaneousEmphysema) bLine += ` | Subcut Emphysema: ${breathing.subcutaneousEmphysema}`;
          if (breathing.intervention) bLine += ` | Intervention: ${Array.isArray(breathing.intervention) ? breathing.intervention.join(", ") : breathing.intervention}`;
          children.push(dBold("Breathing", bLine));
        }

        const cHR = circulation.hr || circulation.heartRate || primary.circulation_hr;
        const cBPS = circulation.bpSystolic || primary.circulation_bp_systolic || circulation.bloodPressure;
        const cBPD = circulation.bpDiastolic || primary.circulation_bp_diastolic;
        const cCRT = circulation.capillaryRefill || circulation.crt || primary.circulation_crt;
        const cAdj = circulation.interventions || primary.circulation_adjuncts || circulation.intervention;
        if (cHR || cBPS || cCRT) {
          let cLine = "";
          if (cHR) cLine += `HR ${cHR}`;
          if (cBPS && cBPD) cLine += `, BP ${cBPS}/${cBPD}`;
          else if (cBPS) cLine += `, BP ${cBPS}`;
          if (cCRT) cLine += ` | CRT: ${cCRT}`;
          if (circulation.skinColorTemp) cLine += ` | Skin: ${circulation.skinColorTemp}`;
          if (circulation.distendedNeckVeins) cLine += ` | Neck Veins: ${circulation.distendedNeckVeins}`;
          if (cAdj) cLine += ` | Adjuncts: ${Array.isArray(cAdj) ? cAdj.join(", ") : cAdj}`;
          children.push(dBold("Circulation", cLine));
        }

        const dAVPU = disability.motorResponse || disability.avpuGcs || primary.disability_avpu;
        const dGE = disability.gcsE || primary.disability_gcs_e;
        const dGV = disability.gcsV || primary.disability_gcs_v;
        const dGM = disability.gcsM || primary.disability_gcs_m;
        const dPupilSize = disability.pupilSize || disability.pupils || primary.disability_pupils_size;
        const dPupilReact = disability.pupilReaction || primary.disability_pupils_reaction;
        const dGlucose = disability.glucose || primary.disability_grbs;
        if (dAVPU || dGE || dPupilSize || dGlucose) {
          let dLine = "";
          if (dAVPU) dLine += dAVPU;
          if (dGE || dGV || dGM) {
            const total = (parseInt(dGE) || 0) + (parseInt(dGV) || 0) + (parseInt(dGM) || 0);
            dLine += ` | GCS ${total || "-"} (E${dGE || "-"}V${dGV || "-"}M${dGM || "-"})`;
          }
          if (dPupilSize) dLine += ` | Pupils: ${dPupilSize}`;
          if (dPupilReact) dLine += ` (${dPupilReact})`;
          if (dGlucose) dLine += ` | Glucose: ${dGlucose}`;
          if (disability.abnormalResponses) dLine += ` | Abnormal Responses: ${disability.abnormalResponses}`;
          children.push(dBold("Disability", dLine));
        }

        const eTemp = exposure.temperature || primary.exposure_temperature;
        const eNotes = exposure.notes || primary.exposure_additional_notes;
        if (eTemp || eNotes || exposure.trauma || exposure.signsOfTraumaIllness) {
          let eLine = "";
          if (eTemp) eLine += `Temp ${eTemp}\u00B0F`;
          if (exposure.trauma) eLine += ` | Trauma: ${exposure.trauma}`;
          if (exposure.signsOfTraumaIllness) eLine += ` | Signs: ${Array.isArray(exposure.signsOfTraumaIllness) ? exposure.signsOfTraumaIllness.join(", ") : exposure.signsOfTraumaIllness}`;
          if (exposure.evidenceOfInfection) eLine += ` | Infection: ${exposure.evidenceOfInfection}`;
          if (exposure.longBoneDeformities) eLine += ` | Long Bone: ${exposure.longBoneDeformities}`;
          if (exposure.extremities) eLine += ` | Extremities: ${exposure.extremities}`;
          if (exposure.immobilize) eLine += ` | Immobilize: ${exposure.immobilize}`;
          if (eNotes) eLine += ` | Notes: ${eNotes}`;
          children.push(dBold("Exposure", eLine));
        }

        if (isPed && Object.keys(efast).length > 0) {
          let efLine = "";
          if (efast.heart) efLine += `Heart: ${efast.heart}`;
          if (efast.abdomen) efLine += ` | Abdomen: ${efast.abdomen}`;
          if (efast.lungs) efLine += ` | Lungs: ${efast.lungs}`;
          if (efast.pelvis) efLine += ` | Pelvis: ${efast.pelvis}`;
          children.push(dBold("EFAST", efLine));
        }
      }

      if (Object.keys(adjuncts).length > 0 && (adjuncts.ecg_findings || adjuncts.bedside_echo || adjuncts.additional_notes || adjuncts.efast_status || adjuncts.efast_notes)) {
        children.push(dH("ADJUNCTS TO PRIMARY SURVEY"));
        if (adjuncts.additional_notes) children.push(dBold("ABG/VBG", adjuncts.additional_notes));
        if (adjuncts.ecg_findings) children.push(dBold("ECG", adjuncts.ecg_findings));
        if (adjuncts.efast_status || adjuncts.efast_notes) children.push(dBold("EFAST", `${adjuncts.efast_status || ""}${adjuncts.efast_notes ? ` - ${adjuncts.efast_notes}` : ""}`));
        if (adjuncts.bedside_echo) children.push(dBold("Bedside Echo", adjuncts.bedside_echo));
      }

      if (Object.keys(abgData).length > 0) {
        const abgParts: string[] = [];
        if (abgData.pH) abgParts.push(`pH: ${abgData.pH}`);
        if (abgData.pCO2) abgParts.push(`pCO2: ${abgData.pCO2}`);
        if (abgData.pO2) abgParts.push(`pO2: ${abgData.pO2}`);
        if (abgData.HCO3) abgParts.push(`HCO3: ${abgData.HCO3}`);
        if (abgData.BE) abgParts.push(`BE: ${abgData.BE}`);
        if (abgData.Lactate) abgParts.push(`Lactate: ${abgData.Lactate}`);
        if (abgData.SaO2) abgParts.push(`SaO2: ${abgData.SaO2}`);
        if (abgData.FiO2) abgParts.push(`FiO2: ${abgData.FiO2}`);
        if (abgData.Na) abgParts.push(`Na: ${abgData.Na}`);
        if (abgData.K) abgParts.push(`K: ${abgData.K}`);
        if (abgData.Cl) abgParts.push(`Cl: ${abgData.Cl}`);
        if (abgData.AnionGap) abgParts.push(`AG: ${abgData.AnionGap}`);
        if (abgData.Glucose) abgParts.push(`Glucose: ${abgData.Glucose}`);
        if (abgData.Hb) abgParts.push(`Hb: ${abgData.Hb}`);
        if (abgData.AaGradient) abgParts.push(`A-a Gradient: ${abgData.AaGradient}`);
        if (abgParts.length > 0) children.push(dBold("ABG Values", abgParts.join(" | ")));
      }

      if (Object.keys(history).length > 0) {
        if (isPed) {
          children.push(dH("SAMPLE HISTORY (PEDIATRIC)"));
          const signsObj = history.signsAndSymptoms || {};
          const signsText = history.signs_and_symptoms || "";
          if (Object.keys(signsObj).length > 0) {
            const sParts: string[] = [];
            if (signsObj.breathingDifficulty) sParts.push(`Breathing Difficulty: ${signsObj.breathingDifficulty}`);
            if (signsObj.fever) sParts.push(`Fever: ${signsObj.fever}`);
            if (signsObj.vomiting) sParts.push(`Vomiting: ${signsObj.vomiting}`);
            if (signsObj.decreasedOralIntake) sParts.push(`Decreased Oral Intake: ${signsObj.decreasedOralIntake}`);
            if (signsObj.timeCourse) sParts.push(`Time Course: ${signsObj.timeCourse}`);
            if (signsObj.notes) sParts.push(`Notes: ${signsObj.notes}`);
            children.push(dBold("Signs & Symptoms", sParts.join(", ")));
          } else if (signsText) {
            dField("Signs & Symptoms", signsText);
          }
          dFieldArr("Allergies", history.allergies);
          dField("Current Medications", history.currentMedications || history.medications || history.drug_history);
          dField("Last Dose Medications", history.lastDoseMedications);
          dField("Medications in Environment", history.medicationsInEnvironment);
          dField("Health History", history.healthHistory || history.past_medical);
          dField("Underlying Conditions", history.underlyingConditions);
          dField("Immunization Status", history.immunizationStatus);
          dField("Last Meal", history.lastMeal || history.last_meal);
          dField("LMP", history.lmp);
          dField("Events", history.events || history.hpi || history.events_hopi);
          dField("Treatment Before Arrival", history.treatmentBeforeArrival);
        } else {
          children.push(dH("HISTORY"));
          const hpi = history.hpi || history.events_hopi || data.sample?.eventsHopi || "";
          dField("HPI / Events", hpi);
          const pastMed = Array.isArray(history.past_medical) ? history.past_medical.join(", ") : history.past_medical;
          dField("Past Medical History", pastMed);
          dField("Past Surgical History", history.past_surgical);
          const allergies = Array.isArray(history.allergies) ? history.allergies.join(", ") : history.allergies;
          dField("Allergies", allergies);
          dField("Medications / Drug History", history.medications || history.drug_history);
          dField("Last Meal / LMP", history.last_meal || history.last_meal_lmp);
          dField("LMP", history.lmp);
        }
      }

      if (Object.keys(exam).length > 0) {
        if (isPed) {
          children.push(dH("PHYSICAL EXAMINATION (PEDIATRIC)"));
          const heent = exam.heent || data.heent || data.physical_exam?.heent || {};
          if (typeof heent === "object" && Object.keys(heent).length > 0) {
            children.push(new Paragraph({ children: [new TextRun({ text: "HEENT", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Head", heent.head);
            dField("Eyes", heent.eyes);
            dField("Ears", heent.ears);
            dField("Nose", heent.nose);
            dField("Throat", heent.throat);
            dField("Lymph Nodes", heent.lymphNodes);
          }
          dField("Respiratory", exam.respiratory || data.physical_exam?.respiratory || exam.respiratory_additional_notes);
          dField("Cardiovascular", exam.cardiovascular || data.physical_exam?.cardiovascular || exam.cvs_additional_notes);
          dField("Abdomen", exam.abdomen || data.physical_exam?.abdomen || exam.abdomen_additional_notes);
          dField("Back", exam.back || data.physical_exam?.back);
          dField("Extremities", exam.extremities || data.physical_exam?.extremities || exam.extremities_additional_notes || exam.extremities_findings);
        } else {
          children.push(dH("PHYSICAL EXAMINATION"));
          const genFindings: string[] = [];
          if (exam.general_pallor) genFindings.push("Pallor");
          if (exam.general_icterus) genFindings.push("Icterus");
          if (exam.general_cyanosis) genFindings.push("Cyanosis");
          if (exam.general_clubbing) genFindings.push("Clubbing");
          if (exam.general_lymphadenopathy) genFindings.push("Lymphadenopathy");
          if (exam.general_edema) genFindings.push("Edema");
          if (genFindings.length > 0 || exam.general_appearance || exam.general_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "General Examination", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            if (exam.general_appearance) dField("Appearance", exam.general_appearance);
            children.push(dP(genFindings.length > 0 ? genFindings.join(", ") : "No significant findings"));
            if (exam.general_additional_notes) dField("Notes", exam.general_additional_notes);
          }
          if (exam.cvs_status || exam.cvs_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "CVS", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Status", exam.cvs_status);
            dField("S1/S2", exam.cvs_s1_s2);
            dField("Pulse", exam.cvs_pulse);
            dField("Pulse Rate", exam.cvs_pulse_rate);
            dField("Apex Beat", exam.cvs_apexBeat);
            dField("Murmurs", exam.cvs_murmurs);
            dField("Added Sounds", exam.cvs_added_sounds);
            dField("Notes", exam.cvs_additional_notes);
          }
          if (exam.respiratory_status || exam.respiratory_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Respiratory", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Status", exam.respiratory_status);
            dField("Expansion", exam.respiratory_expansion);
            dField("Breath Sounds", exam.respiratory_breath_sounds);
            dField("Percussion", exam.respiratory_percussion);
            dField("Added Sounds", exam.respiratory_added_sounds);
            dField("Notes", exam.respiratory_additional_notes);
          }
          if (exam.abdomen_status || exam.abdomen_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Abdomen", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Status", exam.abdomen_status);
            dField("Bowel Sounds", exam.abdomen_bowel_sounds);
            dField("Percussion", exam.abdomen_percussion);
            dField("Organomegaly", exam.abdomen_organomegaly);
            dField("Notes", exam.abdomen_additional_notes);
          }
          if (exam.cns_status || exam.cns_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "CNS", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Status", exam.cns_status);
            dField("Higher Mental Functions", exam.cns_higher_mental_functions);
            dField("Cranial Nerves", exam.cns_cranial_nerves);
            dField("Motor System", exam.cns_motor_system);
            dField("Sensory System", exam.cns_sensory_system);
            dField("Reflexes", exam.cns_reflexes);
            dField("Notes", exam.cns_additional_notes);
          }
          if (exam.extremities_status || exam.extremities_findings || exam.extremities_additional_notes) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Extremities", bold: true, underline: {} })], spacing: { before: 100, after: 40 } }));
            dField("Status", exam.extremities_status);
            dField("Findings", exam.extremities_findings);
            dField("Notes", exam.extremities_additional_notes);
          }
        }
      }

      if (Object.keys(investigations).length > 0 && (investigations.panels_selected?.length > 0 || investigations.individual_tests?.length > 0 || investigations.imaging || investigations.results_notes)) {
        children.push(dH("INVESTIGATIONS"));
        if (Array.isArray(investigations.panels_selected) && investigations.panels_selected.length > 0) children.push(dBold("Lab Panels", investigations.panels_selected.join(", ")));
        if (Array.isArray(investigations.individual_tests) && investigations.individual_tests.length > 0) children.push(dBold("Individual Tests", investigations.individual_tests.join(", ")));
        if (investigations.imaging) {
          const imgText = Array.isArray(investigations.imaging) ? investigations.imaging.join(", ") : investigations.imaging;
          children.push(dBold("Imaging", imgText));
        }
        dField("Results Notes", investigations.results_notes);
      }

      const primaryDiag = treatment.primary_diagnosis || (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0 ? treatment.provisional_diagnoses[0] : "");
      if (primaryDiag || treatment.medications?.length > 0 || treatment.infusions?.length > 0 || treatment.fluids || treatment.interventions?.length > 0 || treatment.intervention_notes || treatment.other_medications) {
        children.push(dH("TREATMENT"));
        dField("Primary Diagnosis", primaryDiag);
        if (Array.isArray(treatment.provisional_diagnoses) && treatment.provisional_diagnoses.length > 0) {
          children.push(dBold("Provisional Diagnoses", treatment.provisional_diagnoses.join(", ")));
        }
        if (treatment.differential_diagnoses) {
          const diffs = Array.isArray(treatment.differential_diagnoses) ? treatment.differential_diagnoses.join(", ") : treatment.differential_diagnoses;
          dField("Differential Diagnoses", diffs);
        }
        if (Array.isArray(treatment.interventions) && treatment.interventions.length > 0) children.push(dBold("Interventions", treatment.interventions.join(", ")));
        dField("Intervention Notes", treatment.intervention_notes);

        if (Array.isArray(treatment.medications) && treatment.medications.length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Medications:", bold: true })], spacing: { before: 80, after: 40 } }));
          treatment.medications.forEach((med: any) => {
            const name = med.name || med.drug_name || "";
            children.push(dP(`  - ${name} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`.trim()));
          });
        }
        if (Array.isArray(treatment.infusions) && treatment.infusions.length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: "Infusions:", bold: true })], spacing: { before: 80, after: 40 } }));
          treatment.infusions.forEach((inf: any) => {
            const name = inf.name || inf.drug_name || inf.drug || "";
            children.push(dP(`  - ${name} ${inf.dose || ""} in ${inf.dilution || ""} at ${inf.rate || ""}`.trim()));
          });
        }
        if (treatment.fluids) dField("IV Fluids", treatment.fluids);
        if (treatment.other_medications) dField("Other Medications", treatment.other_medications);
      }

      if (proceduresPerformed.length > 0 || proceduresNotes) {
        children.push(dH("PROCEDURES"));
        if (Array.isArray(proceduresPerformed) && proceduresPerformed.length > 0) {
          proceduresPerformed.forEach((proc: any) => {
            if (typeof proc === "string") {
              children.push(dP(`  - ${proc}`));
            } else {
              children.push(dP(`  - ${proc.name || "Procedure"}${proc.notes ? `: ${proc.notes}` : ""}`));
            }
          });
        }
        if (proceduresNotes) dField("General Notes", proceduresNotes);
      }

      if (erObs.notes || erObs.duration) {
        children.push(dH("ER OBSERVATION"));
        dField("Duration", erObs.duration);
        dField("Notes", erObs.notes);
      }

      if (Object.keys(disposition).length > 0 && (disposition.type || disposition.admit_to || disposition.destination || disposition.department || disposition.notes)) {
        children.push(dH("DISPOSITION"));
        dField("Type", disposition.type);
        dField("Admit To", disposition.admit_to || disposition.destination || disposition.department);
        dField("Room", disposition.admit_to_room);
        dField("Refer To", disposition.refer_to);
        dField("Condition at Discharge", disposition.condition_at_discharge || disposition.condition);
        dField("Notes", disposition.notes);
      }

      const addNotes = Array.isArray(addendumNotes) ? addendumNotes.filter(Boolean) : [];
      if (addNotes.length > 0) {
        children.push(dH("ADDENDUM NOTES"));
        addNotes.forEach((note: string, i: number) => {
          children.push(dP(`${i + 1}. ${note}`));
        });
      }

      if (data.status || data.created_at || data.updated_at) {
        children.push(dH("CASE INFO"));
        dField("Status", data.status);
        if (data.created_at) dField("Created", new Date(data.created_at).toLocaleString("en-IN"));
        if (data.updated_at) dField("Updated", new Date(data.updated_at).toLocaleString("en-IN"));
      }

      children.push(new Paragraph({ text: "This case sheet is generated from ERmate for clinical documentation purposes.", alignment: AlignmentType.CENTER, spacing: { before: 400 } }));

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

  app.post("/api/ai/interpret-abg", async (req: Request, res: Response) => {
    try {
      const { abg_values, patient_context } = req.body;
      
      if (!abg_values) {
        return res.status(400).json({ error: "ABG values are required" });
      }

      const { interpretABG } = await import("./services/aiDiagnosis");
      const interpretation = await interpretABG(abg_values, patient_context);
      
      res.json({ interpretation });
    } catch (error) {
      console.error("ABG interpretation error:", error);
      res.status(500).json({ error: "Failed to interpret ABG values" });
    }
  });

  app.post("/api/ai/extract-from-image", async (req: Request, res: Response) => {
    try {
      const { imageBase64, patientContext } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const { extractClinicalDataFromImage } = await import("./services/aiDiagnosis");
      const extractedData = await extractClinicalDataFromImage(imageBase64, patientContext);
      
      res.json({ extractedData });
    } catch (error) {
      console.error("Image extraction error:", error);
      res.status(500).json({ error: "Failed to extract data from image" });
    }
  });

  app.post("/api/ai/diagnose", async (req: Request, res: Response) => {
    try {
      const { chiefComplaint, vitals, history, examination, age, gender, abgData } = req.body;
      
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
        abgData: abgData || undefined,
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

  app.post("/api/voice/transcribe", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      let patientContext;
      if (req.body.patientContext) {
        try {
          patientContext = JSON.parse(req.body.patientContext);
        } catch {
          patientContext = undefined;
        }
      }
      
      const mode = req.body.mode || 'full';
      const filename = file.originalname || 'voice.m4a';

      const result = await transcribeAndExtractVoice(
        file.buffer,
        filename,
        patientContext,
        mode
      );

      res.json(result);
    } catch (error) {
      console.error("Voice transcription error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to transcribe audio" });
    }
  });

  app.post("/api/scan/document", upload.single('document'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No document file provided" });
      }

      const { isSarvamAvailable, sarvamParsePDF } = await import("./services/sarvamAI");
      
      if (!isSarvamAvailable()) {
        return res.status(503).json({ error: "Document scanning service not available - Sarvam AI not configured" });
      }

      const pageNumber = parseInt(req.body.pageNumber) || 1;
      let pdfBuffer = file.buffer;

      const isImage = file.mimetype.startsWith("image/");
      if (isImage) {
        const { default: PDFDocument } = await import("pdfkit");
        pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument({ size: "A4" });
          const chunks: Buffer[] = [];
          doc.on("data", (chunk: Buffer) => chunks.push(chunk));
          doc.on("end", () => resolve(Buffer.concat(chunks)));
          doc.on("error", reject);
          doc.image(file.buffer, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
          doc.end();
        });
      }

      const parsedText = await sarvamParsePDF(pdfBuffer, pageNumber);

      if (!parsedText || parsedText.trim().length === 0) {
        return res.json({ 
          success: true, 
          text: "", 
          structured: null,
          message: "No text could be extracted from the document" 
        });
      }

      let structured = null;
      let patientContext;
      if (req.body.patientContext) {
        try { patientContext = JSON.parse(req.body.patientContext); } catch { patientContext = undefined; }
      }

      const extractMode = req.body.mode || "clinical";
      if (extractMode === "clinical") {
        try {
          structured = await extractClinicalDataFromVoice(parsedText, patientContext);
        } catch (extractErr) {
          console.warn("[Doc Scan] Clinical extraction failed:", extractErr);
        }
      }

      res.json({
        success: true,
        text: parsedText,
        structured,
      });
    } catch (error) {
      console.error("Document scan error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to scan document" });
    }
  });

  app.get("/api/sarvam/status", async (_req: Request, res: Response) => {
    const { isSarvamAvailable } = await import("./services/sarvamAI");
    res.json({ available: isSarvamAvailable() });
  });

  app.post("/api/treatment-history/save", async (req: Request, res: Response) => {
    try {
      const { userId, diagnosis, medications, infusions, patientAge, patientSex, caseId } = req.body;
      
      if (!diagnosis || (!medications?.length && !infusions?.length)) {
        return res.status(400).json({ error: "Diagnosis and at least one medication/infusion required" });
      }

      const { getDb } = await import("./db");
      const db = getDb();
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const ageGroup = parseInt(patientAge) <= 16 ? "pediatric" : "adult";
      const savedItems: any[] = [];

      for (const med of (medications || [])) {
        const existing = await db.select().from(treatmentHistory)
          .where(and(
            eq(treatmentHistory.diagnosis, diagnosis),
            eq(treatmentHistory.drugName, med.name),
            eq(treatmentHistory.drugType, "medication")
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(treatmentHistory)
            .set({ 
              usageCount: (existing[0].usageCount || 1) + 1,
              updatedAt: new Date()
            })
            .where(eq(treatmentHistory.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db.insert(treatmentHistory).values({
            userId,
            diagnosis,
            drugName: med.name,
            dose: med.dose,
            route: med.route,
            frequency: med.frequency,
            drugType: "medication",
            ageGroup,
            patientAge: String(patientAge),
            patientSex,
            caseId,
          }).returning();
          savedItems.push(newRecord[0]);
        }
      }

      for (const inf of (infusions || [])) {
        const existing = await db.select().from(treatmentHistory)
          .where(and(
            eq(treatmentHistory.diagnosis, diagnosis),
            eq(treatmentHistory.drugName, inf.name),
            eq(treatmentHistory.drugType, "infusion")
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(treatmentHistory)
            .set({ 
              usageCount: (existing[0].usageCount || 1) + 1,
              updatedAt: new Date()
            })
            .where(eq(treatmentHistory.id, existing[0].id));
          savedItems.push({ ...existing[0], updated: true });
        } else {
          const newRecord = await db.insert(treatmentHistory).values({
            userId,
            diagnosis,
            drugName: inf.name,
            dose: inf.dose,
            dilution: inf.dilution,
            rate: inf.rate,
            drugType: "infusion",
            ageGroup,
            patientAge: String(patientAge),
            patientSex,
            caseId,
          }).returning();
          savedItems.push(newRecord[0]);
        }
      }

      res.json({ success: true, savedCount: savedItems.length });
    } catch (error) {
      console.error("Treatment history save error:", error);
      res.status(500).json({ error: "Failed to save treatment history" });
    }
  });

  app.get("/api/treatment-history/recommendations", async (req: Request, res: Response) => {
    try {
      const { diagnosis, ageGroup, limit = "10" } = req.query;
      
      if (!diagnosis) {
        return res.status(400).json({ error: "Diagnosis is required" });
      }

      const { getDb } = await import("./db");
      const db = getDb();
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }
      const { treatmentHistory } = await import("@shared/schema");
      const { eq, and, ilike, desc } = await import("drizzle-orm");

      let results: any[] = [];
      
      if (ageGroup && (ageGroup === "pediatric" || ageGroup === "adult")) {
        results = await db.select().from(treatmentHistory)
          .where(and(
            ilike(treatmentHistory.diagnosis, `%${diagnosis}%`),
            eq(treatmentHistory.ageGroup, ageGroup as string)
          ))
          .orderBy(desc(treatmentHistory.usageCount))
          .limit(parseInt(limit as string));
      } else {
        results = await db.select().from(treatmentHistory)
          .where(ilike(treatmentHistory.diagnosis, `%${diagnosis}%`))
          .orderBy(desc(treatmentHistory.usageCount))
          .limit(parseInt(limit as string));
      }

      const medications = results.filter((r: any) => r.drugType === "medication");
      const infusions = results.filter((r: any) => r.drugType === "infusion");

      res.json({ 
        success: true, 
        recommendations: {
          medications: medications.map((m: any) => ({
            name: m.drugName,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            usageCount: m.usageCount,
          })),
          infusions: infusions.map((i: any) => ({
            name: i.drugName,
            dose: i.dose,
            dilution: i.dilution,
            rate: i.rate,
            usageCount: i.usageCount,
          })),
        }
      });
    } catch (error) {
      console.error("Treatment recommendations error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
