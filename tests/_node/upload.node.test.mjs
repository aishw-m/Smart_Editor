import { test } from "node:test";
import assert from "node:assert/strict";
import { marked } from "marked";
import sanitizeHtmlPkg from "sanitize-html";

// Mirror the behavior in src/lib/upload.ts in plain JS so we can run the same
// assertions without TypeScript compilation. If the lib changes, this should
// be kept in sync — the canonical version lives at src/lib/upload.ts.

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4",
  "blockquote", "code", "pre", "hr", "a",
];

const sanitizeHtml = sanitizeHtmlPkg.default ?? sanitizeHtmlPkg;

function sanitize(html) {
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

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function txtToHtml(text) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("") || "<p></p>";
}

async function convertUpload(filename, buffer) {
  if (buffer.byteLength === 0) throw new Error("Uploaded file is empty");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`);
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
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer });
    return { title: stem, html: sanitize(result.value || "<p></p>") };
  }
  throw new Error("Unsupported file type. Allowed: .txt, .md, .markdown, .docx");
}

test("converts plain text into paragraphs with the filename stem as title", async () => {
  const buf = Buffer.from("Hello world.\n\nSecond paragraph.\nWith a newline.", "utf8");
  const out = await convertUpload("Notes.txt", buf);
  assert.equal(out.title, "Notes");
  assert.ok(out.html.includes("<p>Hello world.</p>"));
  assert.ok(out.html.includes("<p>Second paragraph.<br />With a newline.</p>"));
});

test("renders markdown headings and lists", async () => {
  const md = "# Heading\n\n- one\n- two\n\n**bold** and *italic*";
  const out = await convertUpload("readme.md", Buffer.from(md, "utf8"));
  assert.equal(out.title, "readme");
  assert.ok(out.html.includes("<h1>Heading</h1>"));
  assert.ok(out.html.includes("<ul>"));
  assert.ok(out.html.includes("<li>one</li>"));
  assert.ok(out.html.includes("<strong>bold</strong>"));
  assert.ok(out.html.includes("<em>italic</em>"));
});

test("strips disallowed HTML to prevent injection", async () => {
  const md = '<script>alert(1)</script><p onclick="x()">hi</p>';
  const out = await convertUpload("evil.md", Buffer.from(md, "utf8"));
  assert.ok(!out.html.includes("<script"));
  assert.ok(!out.html.includes("onclick"));
  assert.ok(out.html.includes("hi"));
});

test("escapes HTML special chars in .txt uploads", async () => {
  const buf = Buffer.from("<script>x</script>", "utf8");
  const out = await convertUpload("a.txt", buf);
  assert.ok(!out.html.includes("<script>"));
  assert.ok(out.html.includes("&lt;script&gt;"));
});

test("rejects unknown extensions", async () => {
  await assert.rejects(convertUpload("a.pdf", Buffer.from("x")), /Unsupported file type/);
});

test("rejects empty uploads", async () => {
  await assert.rejects(convertUpload("a.txt", Buffer.alloc(0)), /empty/i);
});

test("rejects files over the size limit", async () => {
  const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x20);
  await assert.rejects(convertUpload("big.txt", big), /too large/i);
});
