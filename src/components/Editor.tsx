"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";
import Toolbar from "./Toolbar";

interface Props {
  initialContent: string;
  editable: boolean;
  onChange: (html: string) => void;
}

export default function Editor({ initialContent, editable, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: initialContent || "<p></p>",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "ProseMirror",
        spellcheck: "true",
      },
    },
    onUpdate({ editor }) {
      onChangeRef.current(editor.getHTML());
    },
  });

  // Reflect editable changes (e.g., permission changes during the session).
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className="space-y-3">
      <Toolbar editor={editor} disabled={!editable} />
      <EditorContent editor={editor} />
    </div>
  );
}
