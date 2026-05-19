import { describe, it, expect } from "vitest";
import { convertUpload, MAX_UPLOAD_BYTES } from "@/lib/upload";

describe("convertUpload", () => {
  it("converts plain text into paragraphs with the filename stem as title", async () => {
    const buf = Buffer.from(
      "Hello world.\n\nSecond paragraph.\nWith a newline.",
      "utf8"
    );
    const out = await convertUpload("Notes.txt", buf);
    expect(out.title).toBe("Notes");
    expect(out.html).toContain("<p>Hello world.</p>");
    expect(out.html).toContain("<p>Second paragraph.<br />With a newline.</p>");
  });

  it("renders markdown headings and lists", async () => {
    const md = "# Heading\n\n- one\n- two\n\n**bold** and *italic*";
    const out = await convertUpload("readme.md", Buffer.from(md, "utf8"));
    expect(out.title).toBe("readme");
    expect(out.html).toContain("<h1>Heading</h1>");
    expect(out.html).toContain("<ul>");
    expect(out.html).toContain("<li>one</li>");
    expect(out.html).toContain("<strong>bold</strong>");
    expect(out.html).toContain("<em>italic</em>");
  });

  it("strips disallowed HTML to prevent injection", async () => {
    const md = '<script>alert(1)</script><p onclick="x()">hi</p>';
    const out = await convertUpload("evil.md", Buffer.from(md, "utf8"));
    expect(out.html).not.toContain("<script");
    expect(out.html).not.toContain("onclick");
    expect(out.html).toContain("hi");
  });

  it("escapes HTML special chars in .txt uploads", async () => {
    const buf = Buffer.from("<script>x</script>", "utf8");
    const out = await convertUpload("a.txt", buf);
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("rejects unknown extensions", async () => {
    await expect(
      convertUpload("a.pdf", Buffer.from("x"))
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("rejects empty uploads", async () => {
    await expect(convertUpload("a.txt", Buffer.alloc(0))).rejects.toThrow(
      /empty/i
    );
  });

  it("rejects files over the size limit", async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x20);
    await expect(convertUpload("big.txt", big)).rejects.toThrow(/too large/i);
  });
});
