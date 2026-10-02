import type {EmailTemplateInput,EmailTemplateKey,RenderedEmail} from "./types";
import {renderSaleCreated} from "./templates/sale-created";
import {renderWishlistAvailable} from "./templates/wishlist-available";

const templates:Record<EmailTemplateKey,(input:EmailTemplateInput)=>RenderedEmail>={
  sale_created:renderSaleCreated,
  wishlist_available:renderWishlistAvailable,
};

export function renderEmailTemplate(templateKey:EmailTemplateKey,input:EmailTemplateInput):RenderedEmail{
  const renderer=templates[templateKey];
  if(!renderer)throw new Error(`Unsupported email template: ${templateKey}`);
  return renderer(input);
}

export function isEmailTemplateKey(value:string):value is EmailTemplateKey{
  return value==="sale_created"||value==="wishlist_available";
}
