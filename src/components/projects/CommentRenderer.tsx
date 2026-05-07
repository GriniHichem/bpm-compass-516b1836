import { AtSign, Hash, ListTodo, CalendarIcon } from "lucide-react";
import type { ParsedTagToken } from "@/lib/commentTags";
import { parseCommentContent } from "@/lib/commentTags";

interface Props {
  content: string;
}

export function CommentRenderer({ content }: Props) {
  const tokens = parseCommentContent(content);
  return (
    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5 leading-relaxed">
      {tokens.map((tok, i) => {
        if (tok.kind === "text") return <span key={i}>{tok.value}</span>;
        if (tok.kind === "user") {
          return (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-primary/15 text-primary px-1.5 py-0.5 mx-0.5 text-[11px] font-medium align-baseline">
              <AtSign className="h-2.5 w-2.5" />
              {tok.label}
            </span>
          );
        }
        if (tok.kind === "action") {
          return (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 mx-0.5 text-[11px] font-medium align-baseline">
              <Hash className="h-2.5 w-2.5" />
              {tok.label}
            </span>
          );
        }
        if (tok.kind === "task") {
          return (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 mx-0.5 text-[11px] font-medium align-baseline">
              <ListTodo className="h-2.5 w-2.5" />
              {tok.label}
            </span>
          );
        }
        if (tok.kind === "date") {
          return (
            <span key={i} className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 mx-0.5 text-[11px] font-medium align-baseline">
              <CalendarIcon className="h-2.5 w-2.5" />
              {tok.label}
            </span>
          );
        }
        return null;
      })}
    </p>
  );
}
