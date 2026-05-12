import type { CalendarPost } from "@hc/shared";
import { TableCell, TableRow as UiRow } from "@/components/ui/table";

interface CalendarRowProps {
  post: CalendarPost;
}

export function CalendarRow({ post }: CalendarRowProps) {
  return (
    <UiRow>
      <TableCell className="whitespace-nowrap">{post.date}</TableCell>
      <TableCell>{post.code}</TableCell>
      <TableCell>{post.department}</TableCell>
      <TableCell>{post.type}</TableCell>
      <TableCell>{post.style}</TableCell>
      <TableCell className="max-w-md whitespace-pre-wrap">{post.textInImage}</TableCell>
      <TableCell className="max-w-xl whitespace-pre-wrap text-xs text-slate-600">{post.supportingText}</TableCell>
    </UiRow>
  );
}
