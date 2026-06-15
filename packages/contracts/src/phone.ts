import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod/v4";

const PHONE_ERROR = "Enter a valid phone number (e.g. +1 415 555 2671)";

export const phoneSchema = z
  .string()
  .refine((v) => isValidPhoneNumber(v), { message: PHONE_ERROR });

export const optionalPhoneSchema = z
  .union([z.literal(""), phoneSchema])
  .optional()
  .nullable();
