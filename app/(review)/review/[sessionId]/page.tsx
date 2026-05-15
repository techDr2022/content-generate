import { ReviewAuthGate } from "@/components/review/ReviewAuthGate";

export default async function ReviewEntryPage({ params }: { params: Promise<{ sessionId: string }> }): Promise<JSX.Element> {
  const { sessionId } = await params;
  return <ReviewAuthGate sessionId={sessionId} />;
}
