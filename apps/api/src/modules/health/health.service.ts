import { singleton } from "tsyringe";

const VERSION = "2.0.0";

@singleton()
export class HealthService {
  status() {
    return {
      version: VERSION,
      time: new Date(),
    };
  }
}
