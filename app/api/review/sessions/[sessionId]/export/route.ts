import { requireAuthPayload } from "@/lib/server/auth";
import { exportReviewSessionWorkbook } from "@/lib/server/handlers/review";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const auth = requireAuthPayload(req);
    const { sessionId } = await ctx.params;
    const buf = await exportReviewSessionWorkbook(auth.sub, sessionId);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="review-${sessionId}.xlsx"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
