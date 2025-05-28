import { z } from "zod";

export const ProtocolOfferParamsSchema = z.object({
  name: z.string().nonempty(),
  unit: z.union([z.string().nonempty(), z.array(z.string().nonempty())]),
  priority: z.number().optional(),
  isFilterable: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

export const ProtocolDetailsSchema = z.object({
  name: z.string().nonempty(),
  softwareStack: z.string().optional(),
  version: z.string().optional(),
  tests: z.array(z.any()).default([]), // TODO: define a shape
  offerParams: z.array(ProtocolOfferParamsSchema),
});

export const ActorDetailsSchema = z.object({
  name: z.string().nonempty(),
  description: z.string().optional(),
  homepage: z.string().optional(),
});

// Aliases for the base actor schema
export const ProviderDetailsSchema = ActorDetailsSchema;
export const ValidatorDetailsSchema = ActorDetailsSchema;
export const ProtocolOwnerDetailsSchema = ActorDetailsSchema;

export const OfferNumericParamSchema = z.object({
  value: z.number(),
  unit: z.string(),
});

export const OfferSingleParamSchema = z.union([
  z.string(),
  z.boolean(),
  OfferNumericParamSchema,
]);

export const OfferMultipleParamSchema = z.array(OfferSingleParamSchema);

export const OfferParamSchema = z.union([
  OfferSingleParamSchema,
  OfferMultipleParamSchema,
]);

export const OfferDetailsSchema = z.object({
  name: z.string().nonempty(),
  deploymentParams: z.any().optional(),
  params: z.record(z.string(), OfferParamSchema),
});
