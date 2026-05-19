import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Tags the TipTap StarterKit + Underline extensions can round-trip.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
];

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}

function txtToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    );
  return paragraphs.join("") || "<p></p>";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ConvertedDoc {
  title: string;
  html: string;
}

/**
 * Convert an uploaded file to a TipTap-compatible HTML document.
 * Supports .txt, .md, .docx.
 */
export async function convertUpload(
  filename: string,
  buffer: Buffer
): Promise<ConvertedDoc> {
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`
    );
  }

  const lower = filename.toLowerCase();
  const stem = filename.replace(/\.[^.]+$/, "") || "Untitled";

  if (lower.endsWith(".txt")) {
    return { title: stem, html: sanitize(txtToHtml(buffer.toString("utf8"))) };
  }

  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    const html = await marked.parse(buffer.toString("utf8"), { async: true });
    return { title: stem, html: sanitize(html) };
  }

  if (lower.endsWith(".docx")) {
    // Lazy-load mammoth so cold-start of unrelated routes stays fast and so
    // bundlers don't try to ship its server-only deps to the browser.
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer });
    return { title: stem, html: sanitize(result.value || "<p></p>") };
  }

  throw new Error(
    "Unsupported file type. Allowed: .txt, .md, .markdown, .docx"
  );
}
