// app/operations/jobcards.tsx
// The Job Cards module: "My work" and the work item forms. Opened from the Ops tab, or from a push notification
// (the notification passes ?workItem=<id> to open that work item directly).
import JobCardsHome from "@/components/jobcards/jobCardsHome";
import WorkItemScreen from "@/components/jobcards/WorkItemScreen";
import { useAuth } from "@/src/contexts/auth-context";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler } from "react-native";

export default function JobCardsRoute() {
  const { user } = useAuth();
  const { workItem } = useLocalSearchParams<{ workItem?: string }>();
  const [openId, setOpenId] = useState<string | null>(null);

  // a push notification opens its work item straight away
  useEffect(() => {
    if (workItem) setOpenId(workItem);
  }, [workItem]);

  // the Android back button goes from a work item back to the list (not out of the module)
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpenId(null);
      return true;
    });
    return () => sub.remove();
  }, [openId]);

  if (openId)
    return (
      <WorkItemScreen workItemId={openId} onBack={() => setOpenId(null)} />
    );
  return (
    <JobCardsHome userSub={user?.sub ?? user?.username} onOpen={setOpenId} />
  );
}
