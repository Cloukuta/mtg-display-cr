import {redirect} from "next/navigation";

export default function LegacyNotificationsPage(){
  redirect("/profile?section=notifications");
}
