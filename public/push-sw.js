self.addEventListener("push",event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||""}}const title=data.title||"MTG Display CR";event.waitUntil(self.registration.showNotification(title,{body:data.body||"Tienes una nueva notificación.",icon:data.icon||"/favicon.ico",badge:data.badge||"/favicon.ico",tag:data.tag||undefined,data:{url:data.url||"/"}}))});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=event.notification.data?.url||"/";event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if("focus" in client){client.navigate(url);return client.focus()}}return clients.openWindow?clients.openWindow(url):undefined}))});

// Order messages are written directly to Supabase from the authenticated order room.
// Observe only successful order_messages inserts and asynchronously ask our server-side
// push endpoint to notify the other participant. Push delivery never blocks chat sending.
self.addEventListener("fetch",event=>{
 const request=event.request;
 let url;try{url=new URL(request.url)}catch{return}
 if(request.method!=="POST"||!url.pathname.includes("/rest/v1/order_messages"))return;
 const requestClone=request.clone();
 event.respondWith((async()=>{
  const response=await fetch(request);
  if(!response.ok)return response;
  const responseClone=response.clone();
  const authorization=request.headers.get("authorization");
  if(authorization?.startsWith("Bearer ")){
   event.waitUntil((async()=>{try{
    const [data,requestBody]=await Promise.all([responseClone.json(),requestClone.json()]);
    const row=Array.isArray(data)?data[0]:data;
    const body=Array.isArray(requestBody)?requestBody[0]:requestBody;
    const messageId=Number(row?.id),orderId=Number(body?.order_id);
    if(Number.isInteger(messageId)&&Number.isInteger(orderId))await fetch("/api/push/order-message",{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({orderId,messageId})});
   }catch{}})());
  }
  return response;
 })());
});
