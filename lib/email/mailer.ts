import "server-only";
import net from "node:net";
import tls from "node:tls";
import { Resend } from "resend";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendEmailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
};

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.EMAIL_FROM);
}

function fromAddress() {
  const from = process.env.EMAIL_FROM ?? "VITAEON <no-reply@vitaeon.mx>";
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

function encodeHeader(value: string) {
  return /[^\x00-\x7F]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=` : value;
}

function escapeData(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function plainFromHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
}

function waitForSocket(socket: net.Socket | tls.TLSSocket, event: "connect" | "secureConnect") {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      socket.off("error", onError);
      socket.off(event, onReady);
    };
    socket.once("error", onError);
    socket.once(event, onReady);
  });
}

function createReader(socket: net.Socket | tls.TLSSocket) {
  let buffer = "";
  const waiters: Array<(response: string) => void> = [];

  function complete(response: string) {
    const lines = response.split(/\r\n/).filter(Boolean);
    const last = lines[lines.length - 1] ?? "";
    return /^\d{3}\s/.test(last);
  }

  function flush() {
    if (!waiters.length || !complete(buffer)) return;
    const response = buffer;
    buffer = "";
    waiters.shift()?.(response);
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    flush();
  });

  return function readResponse() {
    return new Promise<string>((resolve) => {
      waiters.push(resolve);
      flush();
    });
  };
}

async function sendCommand(
  socket: net.Socket | tls.TLSSocket,
  readResponse: () => Promise<string>,
  command: string,
  expected = /^[23]/
) {
  socket.write(`${command}\r\n`);
  const response = await readResponse();
  if (!expected.test(response)) {
    throw new Error(`SMTP command failed: ${response.split(/\r\n/)[0] ?? "unknown"}`);
  }
  return response;
}

async function sendViaSmtp(payload: EmailPayload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !port) throw new Error("SMTP_NOT_CONFIGURED");

  // EHLO hostname: configurable via EMAIL_EHLO_HOSTNAME or derived from APP_URL.
  // Never hard-code "vitaeon.local" — some SMTP servers reject non-routable domains.
  const appHost = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
  const ehloHostname = process.env.EMAIL_EHLO_HOSTNAME ?? (appHost || "localhost");

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  let socket: net.Socket | tls.TLSSocket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  await waitForSocket(socket, secure ? "secureConnect" : "connect");
  let readResponse = createReader(socket);
  await readResponse();

  await sendCommand(socket, readResponse, `EHLO ${ehloHostname}`);

  if (!secure && process.env.SMTP_STARTTLS !== "false") {
    await sendCommand(socket, readResponse, "STARTTLS");
    socket = tls.connect({ socket, servername: host });
    await waitForSocket(socket, "secureConnect");
    readResponse = createReader(socket);
    await sendCommand(socket, readResponse, `EHLO ${ehloHostname}`);
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    await sendCommand(socket, readResponse, "AUTH LOGIN", /^334/);
    await sendCommand(socket, readResponse, Buffer.from(process.env.SMTP_USER).toString("base64"), /^334/);
    await sendCommand(socket, readResponse, Buffer.from(process.env.SMTP_PASSWORD).toString("base64"), /^235/);
  }

  const html = payload.html;
  const text = payload.text || (html ? plainFromHtml(html) : "");
  const boundary = `vitaeon-${Date.now()}`;
  const message = [
    `From: ${process.env.EMAIL_FROM}`,
    `To: ${payload.to}`,
    `Subject: ${encodeHeader(payload.subject)}`,
    "MIME-Version: 1.0",
    html ? `Content-Type: multipart/alternative; boundary="${boundary}"` : 'Content-Type: text/plain; charset="UTF-8"',
    "",
    html
      ? [
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          "",
          text,
          `--${boundary}`,
          'Content-Type: text/html; charset="UTF-8"',
          "",
          html,
          `--${boundary}--`
        ].join("\r\n")
      : text
  ].join("\r\n");

  await sendCommand(socket, readResponse, `MAIL FROM:<${fromAddress()}>`);
  await sendCommand(socket, readResponse, `RCPT TO:<${payload.to}>`);
  await sendCommand(socket, readResponse, "DATA", /^354/);
  socket.write(`${escapeData(message)}\r\n.\r\n`);
  const finalResponse = await readResponse();
  if (!/^250/.test(finalResponse)) throw new Error(`SMTP DATA failed: ${finalResponse.split(/\r\n/)[0] ?? "unknown"}`);
  await sendCommand(socket, readResponse, "QUIT").catch(() => undefined);
  socket.end();
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM ?? "VITAEON <no-reply@vitaeon.mx>";
  const { error } = await resend.emails.send({
    from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text
  });
  if (error) throw new Error(`Resend: ${(error as { message?: string }).message ?? "RESEND_ERROR"}`);
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<SendEmailResult> {
  // Primary: Resend HTTP API (reliable, free tier 3k emails/mo, no SMTP config needed)
  if (process.env.RESEND_API_KEY) {
    try {
      await Promise.race([
        sendViaResend(payload),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RESEND_TIMEOUT")), 15_000))
      ]);
      return { sent: true };
    } catch (error) {
      console.error("[email:resend:failed]", error);
      return { sent: false, reason: error instanceof Error ? error.message : "RESEND_FAILED" };
    }
  }

  // Fallback: custom SMTP (when RESEND_API_KEY is not set)
  if (!configured()) {
    console.info(`[email:skipped] ${payload.subject} -> ${payload.to}`);
    return { sent: false, skipped: true, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    await Promise.race([
      sendViaSmtp(payload),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("SMTP_TIMEOUT")), 15_000))
    ]);
    return { sent: true };
  } catch (error) {
    console.error("[email:smtp:failed]", error);
    return { sent: false, reason: error instanceof Error ? error.message : "SMTP_FAILED" };
  }
}

export function emailShell(title: string, body: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
  const domain = appUrl.replace(/^https?:\/\//, "");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef5f8;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${title} — VITAEON · Red médica privada en León, Gto.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef5f8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0" border="0">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${appUrl}" style="text-decoration:none;display:inline-block;">
                <span style="display:inline-block;background:#071726;border-radius:10px;padding:9px 20px;">
                  <span style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.3em;text-transform:uppercase;">VITAEON</span>
                </span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #cce0ea;border-radius:22px;padding:36px 40px;mso-padding-alt:28px 24px;">
              <!-- Title -->
              <h1 style="margin:0 0 18px 0;font-size:22px;font-weight:700;line-height:1.3;color:#071726;">${title}</h1>
              <!-- Divider -->
              <div style="height:2px;background:linear-gradient(90deg,#1a80b8,#0ea5e9);border-radius:2px;margin-bottom:22px;"></div>
              <!-- Body -->
              <div style="font-size:15px;line-height:1.8;color:#374151;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 4px 0 4px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:11px;color:#7f9aaa;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Red médica privada · León, Guanajuato</p>
              <p style="margin:0;font-size:12px;color:#7f9aaa;line-height:1.8;">
                <a href="${appUrl}" style="color:#1a80b8;text-decoration:none;font-weight:600;">${domain}</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/aviso-de-privacidad" style="color:#7f9aaa;text-decoration:none;">Privacidad</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/terminos" style="color:#7f9aaa;text-decoration:none;">Términos</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/soporte" style="color:#7f9aaa;text-decoration:none;">Soporte</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Renders a full-width CTA button for use inside emailShell body strings. */
export function emailButton(label: string, url: string) {
  return `<p style="margin:24px 0 4px 0;"><a href="${url}" style="display:inline-block;background:#071726;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;letter-spacing:0.02em;">${label} →</a></p>`;
}
