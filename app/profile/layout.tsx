import type {ReactNode} from "react";
import ProfileStoreLogoMount from "@/components/ProfileStoreLogoMount";
import ProfileSectionDeepLink from "@/components/ProfileSectionDeepLink";

export default function ProfileLayout({children}:{children:ReactNode}){
 return <>{children}<ProfileStoreLogoMount/><ProfileSectionDeepLink/></>;
}
