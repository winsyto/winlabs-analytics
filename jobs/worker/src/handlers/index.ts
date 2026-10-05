import type { JobHandler } from "../types.js";
import { handleHelloWorld } from "./helloWorld.js";
import { handleFilePeople } from "./filePeople/index.js";

export const handlers: Record<string, JobHandler> = {
  hello_world: handleHelloWorld,
  file_people: handleFilePeople,
};
