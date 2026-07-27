import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EditorInfo = { userId: string; userName: string };

export function usePagePresence(pageId: string, currentUser: EditorInfo) {
  const [otherEditors, setOtherEditors] = useState<EditorInfo[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`page:${pageId}`, {
      config: { presence: { key: currentUser.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<EditorInfo>();
        const others = Object.values(state)
          .flat()
          .filter((p) => p.userId !== currentUser.userId);
        setOtherEditors(others);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(currentUser);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, currentUser.userId, currentUser.userName]);

  return otherEditors;
}
