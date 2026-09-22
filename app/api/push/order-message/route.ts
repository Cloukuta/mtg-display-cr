import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function decodeBase64Url(value:string){const normalized=value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-(value.length%4))%4);return Uint8Array.from(atob(normalized),c=>c.charCodeAt(0))}
function encodeBase64Url(value:Uint8Array){let binary="";for(const byte of value)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function encodeJson(value:unknown){return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)))}
async function createVapidJwt(endpoint:string,subject:string,publicKey:string,privateKey:string){const rawPublic=decodeBase64Url(publicKey);if(rawPublic.length!==65||rawPublic[0]!==4)throw new Error("Invalid VAPID public key");const x=encodeBase64Url(rawPublic.slice(1,33)),y=encodeBase64Url(rawPublic.slice(33,65));const key=await crypto.subtle.importKey("jwk",{kty:"EC",crv:"P-256",x,y,d:privateKey,ext:true},{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);const audience=new URL(endpoint).origin,header=encodeJson({typ:"JWT",alg:"ES256"}),claims=encodeJson({aud:audience,exp:Math.floor(Date.now()/1000)+12*60*60,sub:subject}),unsigned=`${header}.${claims}`,signature=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(unsigned)));return `${unsigned}.${encodeBase64Url(signature)}`}
async function sendEmptyPush(endpoint:string,subject:string,publicKey:string,privateKey:string){const jwt=await createVapidJwt(endpoint,subject,publicKey,privateKey);return fetch(endpoint,{method:"POST",headers:{TTL:"60",Authorization:`vapid t=${jwt}, k=${publicKey}`}})}

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
 let sent=0;const expired:string[]=[];
 for(const target of targets){try{const response=await sendEmptyPush(target.endpoint,vapidSubject,vapidPublicKey,vapidPrivateKey);if(response.ok||response.status===201)sent++;else if(response.status===404||response.status===410)expired.push(target.id)}catch{}}
 // Expired subscriptions are intentionally left for their owner to replace/remove under current RLS.
 return NextResponse.json({ok:true,sent,expired:expired.length});
}
