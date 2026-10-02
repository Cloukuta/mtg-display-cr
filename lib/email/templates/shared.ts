import type {EmailLocale} from "../types";

export function escapeHtml(value:unknown){
  return String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]||char));
}

export function absoluteUrl(appUrl:string|undefined,href:unknown){
  const path=String(href||"/");
  if(/^https?:\/\//i.test(path))return path;
  const base=(appUrl||process.env.NEXT_PUBLIC_SITE_URL||"https://mtgdisplaycr.com").replace(/\/$/,"");
  return `${base}${path.startsWith("/")?path:`/${path}`}`;
}

export function emailLayout({locale,preheader,title,body,buttonLabel,buttonUrl}:{locale:EmailLocale;preheader:string;title:string;body:string;buttonLabel:string;buttonUrl:string}){
  const footer=locale==="es"?"Este correo fue enviado por MTG Display CR porque ocurrió un evento importante relacionado con tu cuenta.":"This email was sent by MTG Display CR because an important event related to your account occurred.";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f7f8;font-family:Arial,Helvetica,sans-serif;color:#171717"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e7e7e7;border-radius:18px;overflow:hidden"><tr><td style="padding:24px 28px;border-bottom:1px solid #eeeeee"><div style="font-size:21px;font-weight:800;letter-spacing:-.3px">MTG Display CR</div></td></tr><tr><td style="padding:32px 28px"><h1 style="margin:0 0 14px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.65;color:#4a4a4a">${body}</div><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px"><tr><td><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:10px">${escapeHtml(buttonLabel)}</a></td></tr></table></td></tr><tr><td style="padding:20px 28px;background:#fafafa;border-top:1px solid #eeeeee;font-size:12px;line-height:1.55;color:#777777">${escapeHtml(footer)}</td></tr></table></td></tr></table></body></html>`;
}
