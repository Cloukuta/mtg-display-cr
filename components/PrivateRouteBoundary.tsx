"use client";
import{usePathname}from"next/navigation";import type{ReactNode}from"react";import AuthGuard from"@/components/AuthGuard";
const PRIVATE_PREFIXES=["/dashboard","/catalog","/import","/pending-sales","/orders","/profile","/settings","/checkout"];
export default function PrivateRouteBoundary({children}:{children:ReactNode}){const pathname=usePathname();const isPrivate=PRIVATE_PREFIXES.some(p=>pathname===p||pathname.startsWith(`${p}/`));return isPrivate?<AuthGuard>{children}</AuthGuard>:<>{children}</>}
