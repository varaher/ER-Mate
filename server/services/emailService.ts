const FROM = "ErMate <noreply@ermate.in>";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[Email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("[Email] Resend error:", err);
      return false;
    }
    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (e) {
    console.warn("[Email] Failed:", e);
    return false;
  }
}

export async function sendInviteExistingUser(
  to: string,
  inviterName: string,
  departmentName: string,
  role: string
): Promise<boolean> {
  return sendEmail(
    to,
    `You've been invited to join ${departmentName} on ErMate`,
    `<p>Hi,</p>
     <p><strong>${inviterName}</strong> has invited you to join <strong>${departmentName}</strong> as a <strong>${role}</strong> on ErMate.</p>
     <p>Open the ErMate app and go to <strong>Profile → Department Invites</strong> to accept.</p>
     <p>— The ErMate Team</p>`
  );
}

export async function sendInviteNewUser(
  to: string,
  inviterName: string,
  departmentName: string,
  role: string,
  inviteToken: string,
  appDomain: string
): Promise<boolean> {
  const link = `${appDomain}/invite?token=${inviteToken}`;
  return sendEmail(
    to,
    `Join ${departmentName} on ErMate`,
    `<p>Hi,</p>
     <p><strong>${inviterName}</strong> has invited you to join <strong>${departmentName}</strong> as a <strong>${role}</strong> on ErMate — an Emergency Room EMR app.</p>
     <p><a href="${link}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">Accept Invite & Sign Up</a></p>
     <p>This link expires in 7 days.</p>
     <p>— The ErMate Team</p>`
  );
}

export async function sendShiftWarning(
  to: string,
  doctorName: string,
  shiftName: string,
  minutesLeft: number
): Promise<boolean> {
  return sendEmail(
    to,
    `Your ${shiftName} shift ends in ${minutesLeft} minutes`,
    `<p>Hi ${doctorName},</p>
     <p>Your <strong>${shiftName}</strong> shift ends in <strong>${minutesLeft} minutes</strong>.</p>
     <p>Please complete handovers and log out before your shift ends.</p>
     <p>Open ErMate → Cases → Hand Over to start the handover process.</p>
     <p>— The ErMate Team</p>`
  );
}
