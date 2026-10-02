import "server-only";
import type { ZodTypeAny, z } from "zod";
import { db, type Executor } from "@/server/db/client";
import { isUniqueConstraintError } from "@/server/db/repositories/helpers";
import {
  ConflictError,
  NotFoundError,
  clearedFields,
  newId,
  parseInput,
} from "@/server/finance/common";

interface EntityRepo<Model, Values> {
  findByUserId(userId: string, exec?: Executor): Promise<Model[]>;
  findById(userId: string, id: string, exec?: Executor): Promise<Model | null>;
  insert(userId: string, values: Values, exec?: Executor): Promise<Model>;
  insertMany(userId: string, values: Values[], exec?: Executor): Promise<number>;
  update(userId: string, id: string, values: Partial<Values>, exec?: Executor): Promise<Model | null>;
  remove(userId: string, id: string, exec?: Executor): Promise<boolean>;
}

interface EntityServiceOptions<Model, Values, CreateSchema extends ZodTypeAny, UpdateSchema extends ZodTypeAny> {
  entity: string;
  idPrefix: string;
  repo: EntityRepo<Model, Values>;
  createSchema: CreateSchema;
  updateSchema: UpdateSchema;
  clearable: readonly string[];
  /** Map validated input to column values (fill defaults, timestamps). */
  toValues: (parsed: z.output<CreateSchema>, ctx: { id: string; now: string; isPublished: boolean }) => Values;
}

/**
 * Targeted CRUD for a user-owned financial entity. Every operation is scoped
 * by userId at the query level; input is validated and stripped of unknown
 * keys before it reaches the database.
 */
export function createEntityService<
  Model,
  Values extends { isPublished?: boolean },
  CreateSchema extends ZodTypeAny,
  UpdateSchema extends ZodTypeAny,
>(opts: EntityServiceOptions<Model, Values, CreateSchema, UpdateSchema>) {
  const { entity, idPrefix, repo, createSchema, updateSchema, clearable, toValues } = opts;

  function prepare(input: unknown, defaults: { isPublished: boolean }): Values {
    const parsed = parseInput(createSchema, input) as z.output<CreateSchema> & { id?: string; isPublished?: boolean };
    return toValues(parsed, {
      id: parsed.id ?? newId(idPrefix),
      now: new Date().toISOString(),
      isPublished: parsed.isPublished ?? defaults.isPublished,
    });
  }

  return {
    prepare,

    list(userId: string, exec: Executor = db): Promise<Model[]> {
      return repo.findByUserId(userId, exec);
    },

    get(userId: string, id: string, exec: Executor = db): Promise<Model | null> {
      return repo.findById(userId, id, exec);
    },

    async create(userId: string, input: unknown, options: { isPublished?: boolean; exec?: Executor } = {}): Promise<Model> {
      const values = prepare(input, { isPublished: options.isPublished ?? true });
      try {
        return await repo.insert(userId, values, options.exec ?? db);
      } catch (error) {
        if (isUniqueConstraintError(error)) throw new ConflictError(`A ${entity.toLowerCase()} with this id already exists`);
        throw error;
      }
    },

    async update(userId: string, id: string, patch: unknown, exec: Executor = db): Promise<Model> {
      const parsed = parseInput(updateSchema, patch) as Partial<Values>;
      const updated = await repo.update(
        userId,
        id,
        { ...parsed, ...(clearedFields(patch, clearable) as Partial<Values>) },
        exec
      );
      if (!updated) throw new NotFoundError(entity);
      return updated;
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.remove(userId, id))) throw new NotFoundError(entity);
    },

    async setPublished(userId: string, id: string, isPublished: boolean): Promise<Model> {
      const updated = await repo.update(userId, id, { isPublished } as Partial<Values>);
      if (!updated) throw new NotFoundError(entity);
      return updated;
    },
  };
}
