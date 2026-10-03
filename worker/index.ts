import handler from "vinext/server/fetch-handler";

interface Env {
  EMAIL_PROCESSOR_SECRET?: string;
}

const EMAIL_PROCESSOR_URL =
  "https://mtg-display-cr.jeankarloscocos.workers.dev/api/email/process";

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    if (!env.EMAIL_PROCESSOR_SECRET) {
      throw new Error("EMAIL_PROCESSOR_SECRET is not configured");
    }

    const request = new Request(EMAIL_PROCESSOR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_PROCESSOR_SECRET}`,
      },
    });

    const response = await handler.fetch(request, env, ctx);
    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Scheduled email processor failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    console.log("Scheduled email processor completed", {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
      result: body.slice(0, 1000),
    });
  },
} satisfies ExportedHandler<Env>;
