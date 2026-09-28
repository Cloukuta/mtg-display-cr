import type {ReactNode} from "react";
import ProfileStoreLogoMount from "@/components/ProfileStoreLogoMount";

export default function ProfileLayout({children}:{children:ReactNode}){
 return <>{children}<ProfileStoreLogoMount/></>;
}
