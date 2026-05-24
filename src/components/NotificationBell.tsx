import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_url: string | null;
  is_read: boolean;
  channel: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  assignation: "bg-blue-500",
  echeance_proche: "bg-amber-500",
  retard: "bg-destructive",
  statut_change: "bg-emerald-500",
};

const TYPE_LABELS: Record<string, string> = {
  assignation: "Assignation",
  echeance_proche: "Échéance proche",
  retard: "En retard",
  statut_change: "Statut modifié",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString("fr-FR");
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, wasUnread: boolean) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.entity_url) {
      navigate(notif.entity_url);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[95vw] max-w-sm sm:w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { navigate("/notifications"); setOpen(false); }}
            >
              Voir tout
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                    !notif.is_read && "bg-accent/30"
                  )}
                  onClick={() => handleClick(notif)}
                >
                  <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", TYPE_COLORS[notif.type] || "bg-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                      <span className="text-xs text-muted-foreground/60">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id, !notif.is_read); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
