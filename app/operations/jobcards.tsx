// app/operations/jobcards.tsx
// The Job Cards module: "My work" and the work item forms. Opened from the Ops tab, or from a push notification
// (the notification passes ?jobCard=<id> to open that job card's work directly; an older one passes ?workItem=<id>).
import JobCardsHome from "@/components/jobcards/jobCardsHome";
import WorkItemScreen from "@/components/jobcards/WorkItemScreen";
import { useAuth } from "@/src/contexts/auth-context";
import {
  leaveJobCardSession,
  pauseJobCardSession,
  requestSync,
  resumeJobCardSession,
  startJobCardSession,
} from "@/src/jobcards/controller";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, BackHandler } from "react-native";

export default function JobCardsRoute() {
  const { user } = useAuth();
  const { workItem, jobCard } = useLocalSearchParams<{
    workItem?: string;
    jobCard?: string;
  }>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobCardId, setJobCardId] = useState<string | null>(null);
  const [showWork, setShowWork] = useState(false);

  // Time worked: it pauses the moment the phone is locked or another app is opened, and resumes on return.
  // Leaving the Job Cards module ends the session.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void resumeJobCardSession();
      else void pauseJobCardSession();
    });
    return () => {
      sub.remove();
      void leaveJobCardSession();
    };
  }, []);

  // a push notification opens its job card (or, for an older one, its work item) straight away
  useEffect(() => {
    if (workItem) setOpenId(workItem);
  }, [workItem]);
  useEffect(() => {
    if (!jobCard) return;
    // A notification is sent because the office expects the technician to look at the WORK on that job card,
    // not the summary. Land directly on scales and work.
    setShowWork(true);
    setJobCardId(jobCard);
    void requestSync();
    void startJobCardSession(jobCard);
  }, [jobCard]);

  // the Android back button goes from a work item back to the list (not out of the module)
  useEffect(() => {
    if (!openId && !jobCardId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (openId) setOpenId(null);
      else if (showWork) setShowWork(false);
      else setJobCardId(null);
      return true;
    });
    return () => sub.remove();
  }, [openId, jobCardId, showWork]);

  if (openId)
    return (
      <WorkItemScreen workItemId={openId} onBack={() => setOpenId(null)} />
    );
  return (
    <JobCardsHome
      userSub={user?.sub ?? user?.username}
      onOpen={setOpenId}
      jobCardId={jobCardId}
      onSelectJobCard={(id) => {
        setShowWork(false);
        setJobCardId(id);
      }}
      onBackToList={() => {
        setShowWork(false);
        setJobCardId(null);
      }}
      showWork={showWork}
      onShowWork={() => setShowWork(true)}
      onHideWork={() => setShowWork(false)}
    />
  );
}
