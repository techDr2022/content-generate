import { z } from "zod";
import { PostFeedbackStatus } from "@prisma/client";

export const postFeedbackStatusSchema = z.nativeEnum(PostFeedbackStatus);

export const updatePostFeedbackBodySchema = z.object({
  status: postFeedbackStatusSchema,
  editedCaption: z.string().max(20000).optional(),
  editedHashtags: z.string().max(8000).optional(),
  rejectionReason: z.string().max(5000).optional(),
  clientNote: z.string().max(5000).optional(),
});

export type UpdatePostFeedbackBody = z.infer<typeof updatePostFeedbackBodySchema>;

export const createReviewSessionBodySchema = z.object({
  calendarId: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

export type CreateReviewSessionBody = z.infer<typeof createReviewSessionBodySchema>;
