"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubmitReviewModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stats: { approved: number; approvedWithEdits: number; rejected: number; total: number };
  pending: boolean;
  onConfirm: () => void;
}

export function SubmitReviewModal({
  open,
  onOpenChange,
  stats,
  pending,
  onConfirm,
}: SubmitReviewModalProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit review?</DialogTitle>
          <DialogDescription>
            You are about to send your final decisions for {stats.total} posts. Approved: {stats.approved}, with edits:{" "}
            {stats.approvedWithEdits}, rejected: {stats.rejected}. You will not be able to make further changes after
            submitting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={() => onConfirm()}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
