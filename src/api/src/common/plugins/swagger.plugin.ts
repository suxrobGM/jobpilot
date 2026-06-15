import { swagger } from "@elysiajs/swagger";

export const swaggerPlugin = swagger({
  documentation: {
    info: { title: "JobPilot API", version: "2.0.0" },
  },
});
