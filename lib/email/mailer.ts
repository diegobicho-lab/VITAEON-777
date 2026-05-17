import "server-only";
import net from "node:net";
import tls from "node:tls";

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

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  let socket: net.Socket | tls.TLSSocket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  await waitForSocket(socket, secure ? "secureConnect" : "connect");
  let readResponse = createReader(socket);
  await readResponse();

  await sendCommand(socket, readResponse, "EHLO vitaeon.local");

  if (!secure && process.env.SMTP_STARTTLS !== "false") {
    await sendCommand(socket, readResponse, "STARTTLS");
    socket = tls.connect({ socket, servername: host });
    await waitForSocket(socket, "secureConnect");
    readResponse = createReader(socket);
    await sendCommand(socket, readResponse, "EHLO vitaeon.local");
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

export async function sendTransactionalEmail(payload: EmailPayload): Promise<SendEmailResult> {
  if (!configured()) {
    console.info(`[email:skipped] ${payload.subject} -> ${payload.to}`);
    return { sent: false, skipped: true, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    await Promise.race([
      sendViaSmtp(payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP_TIMEOUT")), 15_000))
    ]);
    return { sent: true };
  } catch (error) {
    console.error("[email:failed]", error);
    return { sent: false, reason: error instanceof Error ? error.message : "SMTP_FAILED" };
  }
}

export function emailShell(title: string, body: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f7fbfd;padding:32px;color:#071726">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d9e5ec;border-radius:28px;padding:32px">
        <p style="letter-spacing:0.28em;font-weight:700;color:#315f7c;font-size:12px">VITAEON</p>
        <h1 style="font-size:28px;line-height:1.2;margin:16px 0">${title}</h1>
        <div style="font-size:16px;line-height:1.7;color:#4b5b70">${body}</div>
      </div>
    </div>
  `;
}
