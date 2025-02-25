// src/schemas/map.schema.ts
import { z } from 'zod';

export const mapSchema = z.object({
  id: z.number(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable(),
  created_at: z.string()
});

export const mapFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default('')
});

export type MapSchema = z.infer<typeof mapSchema>;
export type MapFormSchema = z.infer<typeof mapFormSchema>;