import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import PDFDocument from "pdfkit";

interface DischargeSummaryData {
  patient: {
    name: string;
    age: string | number;
    sex: string;
    phone?: string;
  };
  triage?: {
    chief_complaint?: string;
    mode_of_arrival?: string;
    triage_category?: string;
  };
  vitals?: {
    hr?: string;
    bp_systolic?: string;
    bp_diastolic?: string;
    rr?: string;
    spo2?: string;
    temperature?: string;
  };
  discharge_summary: {
    diagnosis: string;
    treatment_given: string;
    condition_at_discharge: string;
    medications: string;
    follow_up: string;
    instructions: string;
    doctor_name: string;
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/export/discharge-pdf", async (req: Request, res: Response) => {
    try {
      const data: DischargeSummaryData = req.body;
      
      if (!data.patient || !data.discharge_summary) {
        return res.status(400).json({ error: "Missing patient or discharge summary data" });
      }

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="discharge_summary_${data.patient.name.replace(/\s+/g, "_")}.pdf"`);
        res.send(pdfBuffer);
      });

      doc.fontSize(20).font("Helvetica-Bold").text("DISCHARGE SUMMARY", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text("Emergency Department", { align: "center" });
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text("PATIENT INFORMATION", { underline: true });
      doc.moveDown(0.5);
      doc.font("Helvetica");
      doc.text(`Name: ${data.patient.name || "N/A"}`);
      doc.text(`Age/Sex: ${data.patient.age || "N/A"} / ${data.patient.sex || "N/A"}`);
      if (data.patient.phone) {
        doc.text(`Contact: ${data.patient.phone}`);
      }
      doc.text(`Admission Date: ${formatDate(data.created_at)}`);
      doc.text(`Discharge Date: ${formatDate()}`);
      doc.moveDown(1);

      if (data.triage?.chief_complaint) {
        doc.font("Helvetica-Bold").text("PRESENTING COMPLAINT", { underline: true });
        doc.moveDown(0.3);
        doc.font("Helvetica").text(data.triage.chief_complaint);
        doc.moveDown(1);
      }

      if (data.vitals && (data.vitals.hr || data.vitals.bp_systolic)) {
        doc.font("Helvetica-Bold").text("VITAL SIGNS AT PRESENTATION", { underline: true });
        doc.moveDown(0.3);
        doc.font("Helvetica");
        const vitalsText: string[] = [];
        if (data.vitals.hr) vitalsText.push(`HR: ${data.vitals.hr}/min`);
        if (data.vitals.bp_systolic && data.vitals.bp_diastolic) {
          vitalsText.push(`BP: ${data.vitals.bp_systolic}/${data.vitals.bp_diastolic} mmHg`);
        }
        if (data.vitals.rr) vitalsText.push(`RR: ${data.vitals.rr}/min`);
        if (data.vitals.spo2) vitalsText.push(`SpO2: ${data.vitals.spo2}%`);
        if (data.vitals.temperature) vitalsText.push(`Temp: ${data.vitals.temperature}°F`);
        doc.text(vitalsText.join("  |  "));
        doc.moveDown(1);
      }

      doc.font("Helvetica-Bold").text("FINAL DIAGNOSIS", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.discharge_summary.diagnosis || "N/A");
      doc.moveDown(1);

      doc.font("Helvetica-Bold").text("TREATMENT GIVEN", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.discharge_summary.treatment_given || "N/A");
      doc.moveDown(1);

      doc.font("Helvetica-Bold").text("CONDITION AT DISCHARGE", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.discharge_summary.condition_at_discharge || "Stable");
      doc.moveDown(1);

      if (data.discharge_summary.medications) {
        doc.font("Helvetica-Bold").text("MEDICATIONS TO CONTINUE", { underline: true });
        doc.moveDown(0.3);
        doc.font("Helvetica").text(data.discharge_summary.medications);
        doc.moveDown(1);
      }

      doc.font("Helvetica-Bold").text("FOLLOW-UP", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.discharge_summary.follow_up || "As advised");
      doc.moveDown(1);

      if (data.discharge_summary.instructions) {
        doc.font("Helvetica-Bold").text("INSTRUCTIONS", { underline: true });
        doc.moveDown(0.3);
        doc.font("Helvetica").text(data.discharge_summary.instructions);
        doc.moveDown(1);
      }

      doc.moveDown(2);
      doc.moveTo(350, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text(data.discharge_summary.doctor_name || "Treating Physician", { align: "right" });
      doc.font("Helvetica").fontSize(10).text("Emergency Medicine", { align: "right" });

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
