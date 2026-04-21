/**
 * Normalize LLM chat text so react-markdown can render headings and lists.
 * Models often glue "### Section" to the previous sentence without newlines;
 * CommonMark requires block elements (headings) to start at the beginning of a line.
 */

export function normalizeChatMarkdown(text: string): string {
  let s = text.replace(/\r\n/g, '\n').trim();
  if (!s) return s;

  // ATX headings with a space after hashes: "...text ### Title"
  s = s.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');

  // ATX headings missing space after hashes: "...text###Title" or "###🎯 Title"
  s = s.replace(/([^\n])(#{1,6})([^\s#\n])/g, '$1\n\n$2 $3');

  // Trim runs of 3+ blank lines to double (readable spacing)
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}
