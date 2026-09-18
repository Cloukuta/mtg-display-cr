"use client";
import {useParams} from "next/navigation";import NativeBinderInventoryEditor from "@/components/NativeBinderInventoryEditor";
export default function BinderLayout({children}:{children:React.ReactNode}){const params=useParams<{id:string}>();const binderId=Number(params.id);return <>{children}{Number.isFinite(binderId)&&<NativeBinderInventoryEditor binderId={binderId}/>}</>}
