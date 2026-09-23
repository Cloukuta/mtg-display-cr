import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWebPush } from "@/lib/webPush";

export async function POST(request:NextRequest){
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,vapidPublicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,vapidPrivateKey=process.env.VAPID_PRIVATE_KEY,vapidSubject=process.env.VAPID_SUBJECT||"https://mtg-display-cr.jeankarloscocos.workers.dev/",authorization=request.headers.get("authorization");
 if(!supabaseUrl||!publishableKey||!vapidPublicKey||!vapidPrivateKey)return NextResponse.json({error:"Push server is not configured"},{status:503});
 if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:{orderId?:number;messageId?:number};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 if(!Number.isInteger(body.orderId)||!Number.isInteger(body.messageId))return NextResponse.json({error:"Invalid request"},{status:400});
 const supabase=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const{data:{user},error:userError}=await supabase.auth.getUser(authorization.slice(7));if(userError||!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const{data:targets,error}=await supabase.rpc("get_order_message_push_targets",{p_order_id:body.orderId,p_message_id:body.messageId});
 if(error)return NextResponse.json({error:error.message},{status:403});
 if(!targets?.length)return NextResponse.json({ok:true,sent:0,noSubscription:true});
 const first=targets[0],rawMessage=String(first.message||"").replace(/\s+/g," ").trim(),preview=rawMessage.length>100?`${rawMessage.slice(0,97)}…`:rawMessage,senderName=String(first.sender_name||"Usuario");
 const payload={title:"💬 Nuevo mensaje",body:`${senderName}: ${preview||"Te envió un mensaje."}`,url:`/orders/${body.orderId}`,tag:`order-message-${body.orderId}`,icon:"/favicon.ico",badge:"/favicon.ico"};
 let sent=0;const expired:string[]=[];const failures:string[]=[];
 for(const target of targets){try{const response=await sendWebPush({endpoint:target.endpoint,p256dh:target.p256dh,auth_key:target.auth_key},payload,{subject:vapidSubject,publicKey:vapidPublicKey,privateKey:vapidPrivateKey,ttl:60});if(response.ok||response.status===201)sent++;else if(response.status===404||response.status===410)expired.push(target.id);else failures.push(`Push service returned ${response.status}`)}catch(e:any){failures.push(e?.message||"Push failed")}}
 return NextResponse.json({ok:sent>0,sent,expired:expired.length,failed:failures.length,errors:failures.slice(0,3)},{status:sent>0||!targets.length?200:502});
}
