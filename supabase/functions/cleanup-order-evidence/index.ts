import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey)return new Response("Missing Supabase environment",{status:500});
  const supabase=createClient(url,serviceKey,{auth:{persistSession:false}});
  const{data:candidates,error}=await supabase.rpc("evidence_cleanup_candidates",{p_retention_days:14,p_limit:200});
  if(error)return Response.json({ok:false,error:error.message},{status:500});
  if(!candidates?.length)return Response.json({ok:true,candidates:0,deleted:0,bytes_freed:0});
  let deleted=0,bytesFreed=0;
  const failures:Array<{id:number;error:string}>=[];
  for(const row of candidates){
    const{error:removeError}=await supabase.storage.from("order-attachments").remove([row.storage_path]);
    if(removeError){failures.push({id:row.attachment_id,error:removeError.message});continue}
    const{error:markError}=await supabase.rpc("mark_evidence_storage_deleted",{p_attachment_ids:[row.attachment_id],p_reason:"retention_14_days"});
    if(markError){failures.push({id:row.attachment_id,error:`deleted from Storage but metadata mark failed: ${markError.message}`});continue}
    deleted++;bytesFreed+=Number(row.size_bytes||0);
  }
  return Response.json({ok:failures.length===0,candidates:candidates.length,deleted,bytes_freed:bytesFreed,failures});
});
