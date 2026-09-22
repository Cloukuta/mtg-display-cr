self.addEventListener("push",event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||""}}const title=data.title||"MTG Display CR";event.waitUntil(self.registration.showNotification(title,{body:data.body||"Tienes una nueva notificación.",icon:data.icon||"/favicon.ico",badge:data.badge||"/favicon.ico",tag:data.tag||undefined,data:{url:data.url||"/"}}))});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=event.notification.data?.url||"/";event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if("focus" in client){client.navigate(url);return client.focus()}}return clients.openWindow?clients.openWindow(url):undefined}))});

// Order messages are written directly to Supabase from the authenticated order room.
// Observe successful order_messages inserts and asynchronously ask our server-side push
// endpoint to notify the other participant. The original chat request is not delayed.
self.addEventListener("fetch",event=>{
 const request=event.request;
 let url;try{url=new URL(request.url)}catch{return}
 if(request.method!=="POST"||!url.pathname.includes("/rest/v1/order_messages"))return;
 const requestClone=request.clone(),authorization=request.headers.get("authorization");
 const networkPromise=fetch(request);
 event.respondWith(networkPromise);
 if(authorization?.startsWith("Bearer "))event.waitUntil(networkPromise.then(async response=>{if(!response.ok)return;try{
  const [data,requestBody]=await Promise.all([response.clone().json(),requestClone.json()]);
  const row=Array.isArray(data)?data[0]:data,body=Array.isArray(requestBody)?requestBody[0]:requestBody;
  const messageId=Number(row?.id),orderId=Number(body?.order_id);
  if(Number.isInteger(messageId)&&Number.isInteger(orderId))await fetch("/api/push/order-message",{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({orderId,messageId})});
 }catch{}}));
});
