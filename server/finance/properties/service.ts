import "server-only";
import * as propertyRepo from "@/server/db/repositories/propertyRepository";
import { propertyInputSchema, propertyUpdateSchema } from "@/shared/schemas/finance";
import { createEntityService } from "@/server/finance/entityService";

export const propertyService = createEntityService({
  entity: "Property",
  idPrefix: "prop",
  repo: propertyRepo,
  createSchema: propertyInputSchema,
  updateSchema: propertyUpdateSchema,
  clearable: ["assetType", "currentValue", "description"],
  toValues: (parsed, { id, now, isPublished }): propertyRepo.PropertyValues => ({
    ...parsed,
    id,
    isPublished,
    createdAt: now,
    updatedAt: now,
  }),
});
