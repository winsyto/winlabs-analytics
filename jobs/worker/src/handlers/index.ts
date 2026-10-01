import type { JobHandler } from "../types.js";
import { handleHelloWorld } from "./helloWorld.js";

export const handlers: Record<string, JobHandler> = {
  hello_world: handleHelloWorld,
};
