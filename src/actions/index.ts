import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  Presentations,
  Slides,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedPresentation(presentationId: string, userId: string) {
  const [presentation] = await db
    .select()
    .from(Presentations)
    .where(and(eq(Presentations.id, presentationId), eq(Presentations.userId, userId)));

  if (!presentation) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Presentation not found.",
    });
  }

  return presentation;
}

export const server = {
  createPresentation: defineAction({
    input: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      theme: z.string().optional(),
      aspectRatio: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();
      const id = crypto.randomUUID();

      const [presentation] = await db
        .insert(Presentations)
        .values({
          id,
          userId: user.id,
          title: input.title,
          description: input.description,
          theme: input.theme,
          aspectRatio: input.aspectRatio,
          slideCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        success: true,
        data: { presentation },
      };
    },
  }),

  updatePresentation: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        theme: z.string().optional(),
        aspectRatio: z.string().optional(),
        slideCount: z.number().int().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.description !== undefined ||
          input.theme !== undefined ||
          input.aspectRatio !== undefined ||
          input.slideCount !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPresentation(input.id, user.id);

      const [presentation] = await db
        .update(Presentations)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.theme !== undefined ? { theme: input.theme } : {}),
          ...(input.aspectRatio !== undefined ? { aspectRatio: input.aspectRatio } : {}),
          ...(input.slideCount !== undefined ? { slideCount: input.slideCount } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Presentations.id, input.id))
        .returning();

      return {
        success: true,
        data: { presentation },
      };
    },
  }),

  listPresentations: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const presentations = await db
        .select()
        .from(Presentations)
        .where(eq(Presentations.userId, user.id));

      return {
        success: true,
        data: { items: presentations, total: presentations.length },
      };
    },
  }),

  createSlide: defineAction({
    input: z.object({
      presentationId: z.string().min(1),
      orderIndex: z.number().int().optional(),
      layoutType: z.string().optional(),
      title: z.string().optional(),
      content: z.string().optional(),
      notes: z.string().optional(),
      rawData: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPresentation(input.presentationId, user.id);

      const existingOrders = await db
        .select({ orderIndex: Slides.orderIndex })
        .from(Slides)
        .where(eq(Slides.presentationId, input.presentationId));

      const nextOrder =
        input.orderIndex ??
        (existingOrders.length
          ? Math.max(...existingOrders.map((row) => row.orderIndex ?? 0)) + 1
          : 1);

      const now = new Date();
      const [slide] = await db
        .insert(Slides)
        .values({
          id: crypto.randomUUID(),
          presentationId: input.presentationId,
          orderIndex: nextOrder,
          layoutType: input.layoutType,
          title: input.title,
          content: input.content,
          notes: input.notes,
          rawData: input.rawData,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db
        .update(Presentations)
        .set({
          slideCount: existingOrders.length + 1,
          updatedAt: now,
        })
        .where(eq(Presentations.id, input.presentationId));

      return {
        success: true,
        data: { slide },
      };
    },
  }),

  updateSlide: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        presentationId: z.string().min(1),
        orderIndex: z.number().int().optional(),
        layoutType: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        notes: z.string().optional(),
        rawData: z.string().optional(),
      })
      .refine(
        (input) =>
          input.orderIndex !== undefined ||
          input.layoutType !== undefined ||
          input.title !== undefined ||
          input.content !== undefined ||
          input.notes !== undefined ||
          input.rawData !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPresentation(input.presentationId, user.id);

      const [existing] = await db
        .select()
        .from(Slides)
        .where(
          and(
            eq(Slides.id, input.id),
            eq(Slides.presentationId, input.presentationId)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Slide not found.",
        });
      }

      const [slide] = await db
        .update(Slides)
        .set({
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.layoutType !== undefined ? { layoutType: input.layoutType } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.rawData !== undefined ? { rawData: input.rawData } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Slides.id, input.id))
        .returning();

      return {
        success: true,
        data: { slide },
      };
    },
  }),

  deleteSlide: defineAction({
    input: z.object({
      id: z.string().min(1),
      presentationId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPresentation(input.presentationId, user.id);

      const result = await db
        .delete(Slides)
        .where(
          and(
            eq(Slides.id, input.id),
            eq(Slides.presentationId, input.presentationId)
          )
        );

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Slide not found.",
        });
      }

      return { success: true };
    },
  }),

  listSlides: defineAction({
    input: z.object({
      presentationId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPresentation(input.presentationId, user.id);

      const slides = await db
        .select()
        .from(Slides)
        .where(eq(Slides.presentationId, input.presentationId));

      return {
        success: true,
        data: { items: slides, total: slides.length },
      };
    },
  }),
};
