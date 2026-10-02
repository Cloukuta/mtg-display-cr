import type {EmailTemplateInput,RenderedEmail} from "../types";
import {absoluteUrl,emailLayout,escapeHtml} from "./shared";

export function renderWishlistAvailable({locale="es",payload,appUrl}:EmailTemplateInput):RenderedEmail{
  const href=absoluteUrl(appUrl,payload.href||"/wishlist");
  const es=locale==="es";
  const cardName=String(payload.card_name||payload.name||"").trim();
  const title=cardName?(es?`¡${cardName} ya está disponible!`:`${cardName} is now available!`):(es?"¡Una carta de tu Wishlist está disponible!":"A card from your Wishlist is available!");
  const message=es?"Encontramos una copia compatible con lo que estabas buscando en MTG Display CR.":"We found a copy matching what you were looking for on MTG Display CR.";
  const subject=cardName?(es?`${cardName} está disponible — MTG Display CR`:`${cardName} is available — MTG Display CR`):(es?"Una carta de tu Wishlist está disponible — MTG Display CR":"A Wishlist card is available — MTG Display CR");
  const body=`<p style="margin:0">${escapeHtml(message)}</p>${cardName?`<p style="margin:16px 0 0"><strong>${escapeHtml(cardName)}</strong></p>`:""}`;
  return {
    subject,
    html:emailLayout({locale,preheader:message,title,body,buttonLabel:es?"Ver disponibilidad":"View availability",buttonUrl:href}),
    text:`${title}\n\n${message}\n\n${es?"Ver disponibilidad":"View availability"}: ${href}`
  };
}
