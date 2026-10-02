import type {EmailTemplateInput,RenderedEmail} from "../types";
import {absoluteUrl,emailLayout,escapeHtml} from "./shared";

export function renderSaleCreated({locale="es",payload,appUrl}:EmailTemplateInput):RenderedEmail{
  const href=absoluteUrl(appUrl,payload.href||(`/orders/${payload.order_id||""}`));
  const orderId=payload.order_id?`#${payload.order_id}`:"";
  const es=locale==="es";
  const subject=es?`Nueva venta ${orderId} en MTG Display CR`.trim():`New sale ${orderId} on MTG Display CR`.trim();
  const title=es?"¡Tienes una nueva venta!":"You have a new sale!";
  const message=es?"Se generó un nuevo pedido y requiere tu atención como vendedor.":"A new order was created and requires your attention as the seller.";
  const body=`<p style="margin:0">${escapeHtml(message)}</p>${orderId?`<p style="margin:16px 0 0"><strong>${es?"Pedido":"Order"}:</strong> ${escapeHtml(orderId)}</p>`:""}`;
  return {
    subject,
    html:emailLayout({locale,preheader:message,title,body,buttonLabel:es?"Ver venta":"View sale",buttonUrl:href}),
    text:`${title}\n\n${message}${orderId?`\n${es?"Pedido":"Order"}: ${orderId}`:""}\n\n${es?"Ver venta":"View sale"}: ${href}`
  };
}
