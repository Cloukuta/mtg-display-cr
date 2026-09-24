type BrandLoaderProps={label?:string;fullscreen?:boolean;compact?:boolean};
export default function BrandLoader({label,fullscreen=false,compact=false}:BrandLoaderProps){
 const body=<div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 text-center"><img src="/favicon.svg" alt="" className={`${compact?"h-10 w-10":"h-16 w-16 sm:h-20 sm:w-20"} animate-spin`}/><div className={`${compact?"w-16":"w-24"} h-1 overflow-hidden rounded-full bg-border`}><div className="h-full w-1/2 animate-pulse rounded-full bg-primary"/></div>{label?<p className="text-xs font-semibold text-muted-foreground">{label}</p>:null}<span className="sr-only">{label||"Loading"}</span></div>;
 if(fullscreen)return <div className="fixed inset-0 z-[100] grid place-items-center bg-background">{body}</div>;
 return <div className={`${compact?"py-6":"py-12"} grid place-items-center`}>{body}</div>;
}
