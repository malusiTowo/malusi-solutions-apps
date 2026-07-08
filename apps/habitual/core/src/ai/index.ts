import { registryLayer } from "@repo/ai";
import { coachModule } from "./coach";

/** Habitual's AI module registry — feeds the generic engine. */
export const HabitualAiRegistry = registryLayer([coachModule]);

export { coachModule } from "./coach";
