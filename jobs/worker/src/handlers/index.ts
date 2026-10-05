import type { JobHandler } from "../types.js";
import { handleHelloWorld } from "./helloWorld.js";
import { handleFilePeople } from "./filePeople/index.js";
import { handleFileTimeAttendance } from "./fileTimeAttendance/index.js";
import { handleFileAbsenteeism } from "./fileAbsenteeism/index.js";
import { handleFilePayroll } from "./filePayroll/index.js";

export const handlers: Record<string, JobHandler> = {
  hello_world: handleHelloWorld,
  file_people: handleFilePeople,
  file_time_attendance: handleFileTimeAttendance,
  file_absenteeism: handleFileAbsenteeism,
  file_payroll: handleFilePayroll,
};
