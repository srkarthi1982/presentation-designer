import { defineTable, column, NOW } from "astro:db";

export const Presentations = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),
    description: column.text({ optional: true }),
    theme: column.text({ optional: true }),        // e.g. "minimal", "corporate", "playful"
    aspectRatio: column.text({ optional: true }),  // e.g. "16:9", "4:3"
    slideCount: column.number({ optional: true }), // cached for quick listing
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Slides = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    presentationId: column.text({
      references: () => Presentations.columns.id,
    }),
    orderIndex: column.number(),             // Slide order
    layoutType: column.text({ optional: true }), // "title", "title-and-body", "two-column", etc.
    title: column.text({ optional: true }),
    content: column.text({ optional: true }),    // main body text / bullet text
    notes: column.text({ optional: true }),      // speaker notes
    rawData: column.text({ optional: true }),    // JSON string for advanced layout/config
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Presentations,
  Slides,
} as const;
