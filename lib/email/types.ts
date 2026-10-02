export type EmailLocale = "es" | "en";
export type EmailTemplateKey = "sale_created" | "wishlist_available";

export type EmailTemplatePayload = Record<string, unknown>;

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplateInput = {
  locale?: EmailLocale;
  payload: EmailTemplatePayload;
  appUrl?: string;
};
