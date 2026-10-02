import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {sendBrevoEmail} from "@/lib/email/brevo";
import {isEmailTemplateKey,renderEmailTemplate} from "@/lib/email/render";
import type {EmailLocale} from "@/lib/email/types";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MAX_BATCH=10;
const MAX_ATTEMPTS=3;

type Job={id:string;recipient_email:string;template_key:string;locale:string;payload:Record<string,unknown>|null;attempt_count:number};

function retryAt(attempt:number){return new Date(Date.now()+Math.min(60,5*Math.pow(2,Math.max(0,attempt-1)))*60_000).toISOString()}

export async function POST(request:NextRequest){
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const processorSecret=process.env.EMAIL_PROCESSOR_SECRET;
  const supplied=request.headers.get("authorization");
  if(!supabaseUrl||!serviceKey)return NextResponse.json({error:"Email processor database configuration is missing"},{status:503});
  if(!processorSecret)return NextResponse.json({error:"Email processor is not configured"},{status:503});
  if(supplied!==`Bearer ${processorSecret}`)return NextResponse.json({error:"Unauthorized"},{status:401});

  const supabase=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const now=new Date().toISOString();
  const {data,error}=await supabase.from("email_notification_outbox").select("id,recipient_email,template_key,locale,payload,attempt_count").in("status",["pending","failed"]).or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`).lt("attempt_count",MAX_ATTEMPTS).order("created_at",{ascending:true}).limit(MAX_BATCH);
  if(error)return NextResponse.json({error:"Could not load email queue"},{status:500});

  const results:{id:string;status:string}[]=[];
  for(const job of (data||[]) as Job[]){
    const attempt=(job.attempt_count||0)+1;
    const {data:claimed,error:claimError}=await supabase.from("email_notification_outbox").update({status:"processing",attempt_count:attempt,last_error:null,updated_at:now}).eq("id",job.id).in("status",["pending","failed"]).select("id").maybeSingle();
    if(claimError||!claimed){results.push({id:job.id,status:"skipped"});continue}
    try{
      if(!isEmailTemplateKey(job.template_key))throw new Error(`Unsupported email template: ${job.template_key}`);
      const locale:EmailLocale=job.locale==="en"?"en":"es";
      const rendered=renderEmailTemplate(job.template_key,{locale,payload:job.payload||{},appUrl:process.env.NEXT_PUBLIC_SITE_URL});
      const delivery=await sendBrevoEmail({recipient:job.recipient_email,email:rendered,tag:job.template_key});
      await supabase.from("email_notification_outbox").update({status:"sent",provider:delivery.provider,provider_message_id:delivery.messageId,sent_at:new Date().toISOString(),next_attempt_at:null,last_error:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","processing");
      results.push({id:job.id,status:"sent"});
    }catch(error:any){
      const finalFailure=attempt>=MAX_ATTEMPTS;
      const message=String(error?.message||"Email delivery failed").slice(0,1000);
      await supabase.from("email_notification_outbox").update({status:"failed",last_error:message,next_attempt_at:finalFailure?null:retryAt(attempt),updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","processing");
      console.error("Email outbox delivery failed",job.id,message);
      results.push({id:job.id,status:finalFailure?"failed-final":"failed-retry"});
    }
  }
  return NextResponse.json({ok:true,processed:results.length,results});
}
