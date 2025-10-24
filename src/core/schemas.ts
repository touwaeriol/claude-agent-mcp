import { z } from "zod";

export const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
]);

export const createSessionArgs = {
  cwd: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  permissionMode: permissionModeSchema.optional(),
  systemPrompt: z.string().min(1).optional(),
} satisfies z.ZodRawShape;
export const createSessionSchema = z.object(createSessionArgs);

export const closeSessionArgs = {
  sessionId: z.string().min(1),
} satisfies z.ZodRawShape;
export const closeSessionSchema = z.object(closeSessionArgs);

export const queryArgs = {
  sessionId: z.string().min(1),
  prompt: z.string(),
  closeAfter: z.boolean().optional(),
  includeThinking: z.boolean().optional(),
} satisfies z.ZodRawShape;
export const querySchema = z.object(queryArgs);

export const interruptArgs = {
  sessionId: z.string().min(1),
} satisfies z.ZodRawShape;
export const interruptSchema = z.object(interruptArgs);

export const modelArgs = {
  sessionId: z.string().min(1),
  model: z.string().min(1),
} satisfies z.ZodRawShape;
export const modelSchema = z.object(modelArgs);

export const modeArgs = {
  sessionId: z.string().min(1),
  permissionMode: permissionModeSchema,
} satisfies z.ZodRawShape;
export const modeSchema = z.object(modeArgs);

export const directQueryArgs = {
  prompt: z.string(),
  model: z.string().min(1).optional(),
  permissionMode: permissionModeSchema.optional(),
  includeThinking: z.boolean().optional(),
  systemPrompt: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
} satisfies z.ZodRawShape;
export const directQuerySchema = z.object(directQueryArgs);

export const listSessionsArgs = {} satisfies z.ZodRawShape;
export const listSessionsSchema = z.object(listSessionsArgs);

export const sessionStatusArgs = {
  sessionId: z.string().min(1),
} satisfies z.ZodRawShape;
export const sessionStatusSchema = z.object(sessionStatusArgs);

export const serverConfigArgs = {
  modelUpdateTimeoutMs: z.number().int().min(1000).max(600000).optional(),
} satisfies z.ZodRawShape;
export const serverConfigSchema = z.object(serverConfigArgs);
