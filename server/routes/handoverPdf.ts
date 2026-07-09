import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getPool } from "../db";
import { extractUserId } from "../lib/auth";

const TYPE_LABEL: Record<string, string> = {
  clinical_update: "CLINICAL UPDATE",
  investigation_result: "INVESTIGATION RESULT",
  consultant_review: "CONSULTANT REVIEW",
  cross_consultation: "CROSS-CONSULTATION",
  medication_change: "MEDICATION CHANGE",
  procedure_note: "PROCEDURE NOTE",
  shift_handover: "SHIFT HANDOVER",
  correction: "CORRECTION",
};

const TYPE_COLOR: Record<string, string> = {
  clinical_update: "#10B981",
  investigation_result: "#3B82F6",
  consultant_review: "#7C3AED",
  cross_consultation: "#4F46E5",
  medication_change: "#D97706",
  procedure_note: "#0D9488",
  shift_handover: "#64748B",
  correction: "#F97316",
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function drawColorDot(doc: PDFKit.PDFDocument, color: string, x: number, y: number) {
  doc.save();
  doc.fillColor(color).circle(x, y, 3).fill();
  doc.restore();
}

export function registerHandoverPdfRoutes(app: Express): void {
  // GET /api/cases/handover-status?ids=id1,id2,... — returns which case IDs have a shift_handover addendum
  app.get("/api/cases/handover-status", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database unavailable" });

    const raw = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) return res.json({ ready: [] });

    try {
      const result = await pool.query(
        `SELECT DISTINCT case_id FROM case_addenda
         WHERE case_id = ANY($1::text[]) AND type = 'shift_handover'`,
        [ids]
      );
      const ready: string[] = result.rows.map((r: any) => r.case_id);
      return res.json({ ready });
    } catch (err: any) {
      console.error("[HANDOVER-STATUS] error:", err);
      return res.status(500).json({ error: "Failed to check handover status" });
    }
  });

  // POST /api/cases/:id/handover-pdf — generates a printable 2-page shift handover PDF
  // Page 1: patient summary, active issues, pending tasks
  // Page 2: full timeline, current medications, signature lines
  app.post("/api/cases/:id/handover-pdf", async (req: Request, res: Response) => {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pool = getPool();
    if (!pool) return res.status(503).json({ error: "Database unavailable" });

    const { id } = req.params;
    const {
      patientName,
      patientAge,
      patientSex,
      arrivalTime,
      chiefComplaint,
      medications,
      handingDoctor,
      receivingDoctor,
    } = req.body || {};

    try {
      // Ownership check — mirrors GET /api/cases/:id/addenda
      const accessCheck = await pool.query(
        `SELECT 1 FROM case_addenda WHERE case_id=$1 AND doctor_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays WHERE case_id=$1 AND doctor_user_id=$2
         UNION ALL
         SELECT 1 FROM case_overlays co
           JOIN shift_sessions ss ON co.shift_session_id = ss.id
           JOIN shifts s ON ss.shift_id = s.id
           JOIN department_members dm ON dm.department_id = s.department_id AND dm.user_id=$2
         WHERE co.case_id=$1
         LIMIT 1`,
        [id, userId]
      );

      const addendaResult = await pool.query(
        `SELECT * FROM case_addenda WHERE case_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      const addenda = accessCheck.rowCount === 0
        ? addendaResult.rows.filter((r: any) => r.doctor_id === userId)
        : addendaResult.rows;

      const hasShiftHandover = addenda.some((a: any) => a.type === "shift_handover");
      if (!hasShiftHandover) {
        return res.status(400).json({ error: "No shift handover addendum found for this case" });
      }

      const handoverEntries = addenda.filter((a: any) => a.type === "shift_handover");
      const activeIssues = addenda.filter((a: any) => a.type !== "shift_handover");
      const lastHandover = handoverEntries[handoverEntries.length - 1];
      const fromDoctor = handingDoctor || lastHandover?.handover_from_doctor || lastHandover?.doctor_name || "_________________";
      const toDoctor = receivingDoctor || lastHandover?.handover_to_doctor || "_________________";

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="shift_handover_${(patientName || "patient").replace(/\s+/g, "_")}.pdf"`
        );
        res.send(pdfBuffer);
      });

      // ── Page 1: Patient summary + active issues + pending tasks ──────────────
      doc.fontSize(18).font("Helvetica-Bold").text("SHIFT HANDOVER SUMMARY", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text("Emergency Department", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(11).font("Helvetica-Bold").text("PATIENT SUMMARY");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Name: ${patientName || "N/A"}        Age/Sex: ${patientAge || "N/A"} / ${patientSex || "N/A"}`);
      doc.text(`Arrival: ${formatDateTime(arrivalTime)}`);
      doc.text(`Chief Complaint: ${chiefComplaint || "Not documented"}`);
      doc.moveDown(0.6);

      doc.font("Helvetica-Bold").fontSize(11).text("ACTIVE ISSUES");
      doc.moveDown(0.3);
      if (activeIssues.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(10).text("No additional clinical updates documented.");
      } else {
        activeIssues.forEach((a: any) => {
          const color = TYPE_COLOR[a.type] || "#374151";
          const label = TYPE_LABEL[a.type] || String(a.type).toUpperCase();
          const y = doc.y + 5;
          drawColorDot(doc, color, 53, y);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(color).text(`  ${label}`, 58, doc.y, { continued: false });
          doc.fillColor("#000000").font("Helvetica").fontSize(9).text(
            `${formatDateTime(a.created_at)}${a.doctor_name ? ` · ${a.doctor_name}` : ""}`,
            { indent: 10 }
          );
          doc.font("Helvetica").fontSize(10).text(a.content, { indent: 10 });
          doc.moveDown(0.4);
        });
      }
      doc.moveDown(0.4);

      doc.font("Helvetica-Bold").fontSize(11).text("PENDING TASKS");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      handoverEntries.forEach((h: any, idx: number) => {
        doc.text(`${idx + 1}. ${h.content}`, { indent: 10 });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#6B7280");
      doc.text(`Handing over from ${fromDoctor} to ${toDoctor}`);
      doc.fillColor("#000000");

      // ── Page 2: Full timeline + medications + signatures ──────────────────────
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("FULL CLINICAL TIMELINE", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      if (addenda.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(10).text("No addenda recorded for this case.");
      } else {
        addenda.forEach((a: any) => {
          const color = TYPE_COLOR[a.type] || "#374151";
          const label = TYPE_LABEL[a.type] || String(a.type).toUpperCase();
          const y = doc.y + 5;
          drawColorDot(doc, color, 53, y);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(color).text(`  ${label}`, 58, doc.y);
          const who = [a.doctor_name, a.doctor_role, a.specialty].filter(Boolean).join(" · ");
          doc.fillColor("#374151").font("Helvetica").fontSize(9).text(
            `${formatDateTime(a.created_at)}${who ? ` · ${who}` : ""}`,
            { indent: 10 }
          );
          if (a.handover_from_doctor) {
            doc.font("Helvetica-Oblique").fontSize(9).text(
              `From: ${a.handover_from_doctor} -> To: ${a.handover_to_doctor || "?"}`,
              { indent: 10 }
            );
          }
          doc.fillColor("#000000").font("Helvetica").fontSize(10).text(a.content, { indent: 10 });
          doc.moveDown(0.4);
        });
      }

      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11).text("CURRENT MEDICATIONS");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).text(medications || "None documented");
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.6);

      const sigY = doc.y;
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(`Handing Doctor: ${fromDoctor}`, 50, sigY);
      doc.text(`Receiving Doctor: ${toDoctor}`, 300, sigY);
      doc.moveDown(1.5);
      const lineY = doc.y;
      doc.moveTo(50, lineY).lineTo(240, lineY).stroke();
      doc.moveTo(300, lineY).lineTo(490, lineY).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
      doc.text("Signature & Time", 50, doc.y);
      doc.text("Signature & Time", 300, doc.y);

      doc.moveDown(1.2);
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#6B7280");
      doc.text(
        "This handover sheet is generated from documented case addenda and is intended to support continuity of care during shift transitions.",
        { align: "center" }
      );

      doc.end();
    } catch (err: any) {
      console.error("[HANDOVER-PDF] error:", err);
      res.status(500).json({ error: err.message || "Failed to generate handover PDF" });
    }
  });
}
