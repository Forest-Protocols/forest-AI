import { Address, Hex } from "viem";
import { z } from "zod";

const hexSchema = z.string().startsWith("0x", "Must start with '0x'");

/**
 * Schema for a private key field.
 */
export const privateKeySchema = hexSchema
  .length(66)
  .transform((value) => value as Hex);
export const PrivateKeySchema = privateKeySchema; // alias

/**
 * Schema for a public wallet address field.
 */
export const addressSchema = hexSchema
  .length(42)
  .transform((value) => value as Address);

/**
 * Alias for `addressSchema`
 */
export const AddressSchema = addressSchema;
