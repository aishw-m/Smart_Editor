"use client";

import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor | null;
  disabled?: boolean;
}

function Button({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={
        "px-2 py-1 rounded text-sm font-medium transition select-none " +
        (active
          ? "bg-brand-50 text-brand-700"
          : "text-gray-700 hover:bg-gray-100") +
        (disabled ? " opacity-40 cursor-not-allowed" : "")
      }
    >
      {children}
    </button>
  );
}

export default function Toolbar({ editor, disabled }: Props) {
  if (!editor) return null;
  const off = disabled === true;
  return (
    <div className="flex flex-wrap items-center gap-1 bg-white border rounded-lg px-2 py-1.5 shadow-sm">
      <Button
        title="Bold (Cmd/Ctrl+B)"
        active={editor.isActive("bold")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </Button>
      <Button
        title="Italic (Cmd/Ctrl+I)"
        active={editor.isActive("italic")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </Button>
      <Button
        title="Underline (Cmd/Ctrl+U)"
        active={editor.isActive("underline")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </Button>
      <Button
        title="Strikethrough"
        active={editor.isActive("strike")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </Button>

      <span className="w-px h-5 bg-gray-200 mx-1" />

      <Button
        title="Paragraph"
        active={editor.isActive("paragraph") && !editor.isActive("heading")}
        disabled={off}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        P
      </Button>
      <Button
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        disabled={off}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        H1
      </Button>
      <Button
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        disabled={off}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        H2
      </Button>
      <Button
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        disabled={off}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        H3
      </Button>

      <span className="w-px h-5 bg-gray-200 mx-1" />

      <Button
        title="Bulleted list"
        active={editor.isActive("bulletList")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </Button>
      <Button
        title="Numbered list"
        active={editor.isActive("orderedList")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </Button>
      <Button
        title="Blockquote"
        active={editor.isActive("blockquote")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </Button>

      <span className="w-px h-5 bg-gray-200 mx-1" />

      <Button
        title="Undo (Cmd/Ctrl+Z)"
        disabled={off || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </Button>
      <Button
        title="Redo (Cmd/Ctrl+Shift+Z)"
        disabled={off || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </Button>
    </div>
  );
}
