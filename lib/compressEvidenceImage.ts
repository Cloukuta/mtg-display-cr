const TARGET_BYTES=500*1024;
const MAX_BYTES=950*1024;
const MAX_SOURCE_BYTES=12*1024*1024;
const MAX_DIMENSION=1600;

function loadImage(file:File):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("IMAGE_DECODE_FAILED"))};
  image.src=url;
 });
}

function canvasBlob(canvas:HTMLCanvasElement,quality:number):Promise<Blob>{
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("IMAGE_COMPRESSION_FAILED")),"image/webp",quality));
}

export async function compressEvidenceImage(file:File):Promise<File>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("UNSUPPORTED_IMAGE_TYPE");
 if(file.size>MAX_SOURCE_BYTES)throw new Error("SOURCE_IMAGE_TOO_LARGE");
 if(file.size<=TARGET_BYTES)return file;

 const image=await loadImage(file);
 const scale=Math.min(1,MAX_DIMENSION/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
 canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const context=canvas.getContext("2d");
 if(!context)throw new Error("CANVAS_UNAVAILABLE");
 context.drawImage(image,0,0,canvas.width,canvas.height);

 let quality=.82;
 let blob=await canvasBlob(canvas,quality);
 while(blob.size>TARGET_BYTES&&quality>.42){quality-=.08;blob=await canvasBlob(canvas,quality)}

 if(blob.size>MAX_BYTES){
  const shrink=Math.sqrt(MAX_BYTES/blob.size)*.92;
  const resized=document.createElement("canvas");
  resized.width=Math.max(1,Math.round(canvas.width*shrink));
  resized.height=Math.max(1,Math.round(canvas.height*shrink));
  const resizedContext=resized.getContext("2d");
  if(!resizedContext)throw new Error("CANVAS_UNAVAILABLE");
  resizedContext.drawImage(canvas,0,0,resized.width,resized.height);
  blob=await canvasBlob(resized,.68);
 }
 if(blob.size>MAX_BYTES)throw new Error("COMPRESSED_IMAGE_TOO_LARGE");

 const base=file.name.replace(/\.[^.]+$/,"" ).replace(/[^a-zA-Z0-9._-]/g,"-")||"evidence";
 return new File([blob],`${base}.webp`,{type:"image/webp",lastModified:Date.now()});
}
