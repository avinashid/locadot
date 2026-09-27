import * as hosts from "./hosts";
import * as proxy from "./proxy";
import * as files from "./files";
import * as system from "./system";
import * as tunnel from "./tunnel";
import * as remote from "./remote";
import { doctor } from "./doctor";

export type { TargetOptions } from "./hosts";
export type { PortOptions } from "./proxy";

const Commands = { ...hosts, ...proxy, ...files, ...system, ...tunnel, ...remote, doctor };

export default Commands;
