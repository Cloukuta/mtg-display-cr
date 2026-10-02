import type {RenderedEmail} from "./types";

const BREVO_SEND_URL="https://api.brevo.com/v3/smtp/email";

export async function sendBrevoEmail({recipient,email,tag}:{recipient:string;email:RenderedEmail;tag:string}){
  const apiKey=process.env.BREVO_API_KEY;
  const fromAddress=process.env.EMAIL_FROM_ADDRESS;
  const fromName=process.env.EMAIL_FROM_NAME||"MTG Display CR";
  const replyTo=process.env.EMAIL_REPLY_TO||fromAddress;
  if(!apiKey||!fromAddress)throw new Error("Email server is not configured");

  const response=await fetch(BREVO_SEND_URL,{method:"POST",headers:{accept:"application/json","api-key":apiKey,"content-type":"application/json"},body:JSON.stringify({sender:{name:fromName,email:fromAddress},to:[{email:recipient}],replyTo:replyTo?{email:replyTo}:undefined,subject:email.subject,htmlContent:email.html,textContent:email.text,tags:[tag]})});
  let body:any=null;
  try{body=await response.json()}catch{}
  if(!response.ok){const error=new Error(`Brevo rejected email (${response.status})`);(error as any).providerStatus=response.status;(error as any).providerBody=body;throw error}
  return {provider:"brevo",messageId:body?.messageId||null};
}
