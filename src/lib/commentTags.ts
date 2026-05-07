// Comment tag helpers — encode/decode inline tags inside comment content.
// Format: [@user:UUID|Name]  [#action:UUID|Title]  [#task:UUID|Title]  [📅:YYYY-MM-DD|Display]

export type ParsedTagToken =
  | { kind: "text"; value: string }
  | { kind: "user"; id: string; label: string }
  | { kind: "action"; id: string; label: string }
  | { kind: "task"; id: string; label: string }
  | { kind: "date"; iso: string; label: string };

const TAG_REGEX = /\[(@user|#action|#task|📅):([^|\]]+)\|([^\]]+)\]/g;

export function parseCommentContent(content: string): ParsedTagToken[] {
  const tokens: ParsedTagToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: content.slice(lastIndex, match.index) });
    }
    const [, kind, id, label] = match;
    if (kind === "@user") tokens.push({ kind: "user", id, label });
    else if (kind === "#action") tokens.push({ kind: "action", id, label });
    else if (kind === "#task") tokens.push({ kind: "task", id, label });
    else if (kind === "📅") tokens.push({ kind: "date", iso: id, label });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    tokens.push({ kind: "text", value: content.slice(lastIndex) });
  }
  return tokens;
}

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  const re = /\[@user:([^|\]]+)\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) ids.add(m[1]);
  return [...ids];
}

export function buildUserTag(id: string, label: string) {
  return `[@user:${id}|${label.replace(/[\|\]]/g, " ")}]`;
}
export function buildActionTag(id: string, label: string) {
  return `[#action:${id}|${label.replace(/[\|\]]/g, " ").slice(0, 80)}]`;
}
export function buildTaskTag(id: string, label: string) {
  return `[#task:${id}|${label.replace(/[\|\]]/g, " ").slice(0, 80)}]`;
}
export function buildDateTag(iso: string, label: string) {
  return `[📅:${iso}|${label}]`;
}
