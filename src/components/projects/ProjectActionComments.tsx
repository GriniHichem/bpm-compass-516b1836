import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, Pencil, Trash2, X, Check, Lock } from "lucide-react";
import { formatDistanceToNow, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { CommentToolbar } from "@/components/projects/CommentToolbar";
import { CommentRenderer } from "@/components/projects/CommentRenderer";
import { extractMentionedUserIds } from "@/lib/commentTags";

interface Comment {
  id: string;
  action_id: string;
  user_id: string;
  content: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  fonction?: string | null;
}

interface Props {
  actionId: string;
  canComment: boolean;
  isAdmin: boolean;
  projectId?: string;
  projectResponsableUserId?: string | null;
  actionResponsableUserId?: string | null;
}

export function ProjectActionComments({ actionId, canComment, isAdmin, projectId, projectResponsableUserId, actionResponsableUserId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newContent, setNewContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [allActionResponsables, setAllActionResponsables] = useState<string[]>([]);
  const [resolvedProjectResp, setResolvedProjectResp] = useState<string | null>(projectResponsableUserId ?? null);

  useEffect(() => {
    (async () => {
      let pid = projectId;
      if (!pid) {
        const { data: act } = await supabase
          .from("project_actions")
          .select("project_id")
          .eq("id", actionId)
          .maybeSingle();
        pid = (act as any)?.project_id;
      }
      if (!pid) return;
      const [{ data: proj }, { data: acts }] = await Promise.all([
        supabase.from("projects").select("responsable_user_id").eq("id", pid).maybeSingle(),
        supabase.from("project_actions").select("responsable_user_id").eq("project_id", pid),
      ]);
      setResolvedProjectResp(((proj as any)?.responsable_user_id) ?? null);
      const ids = ((acts ?? []) as any[]).map(a => a.responsable_user_id).filter(Boolean) as string[];
      setAllActionResponsables([...new Set(ids)]);
    })();
  }, [actionId, projectId]);

  const canSeePrivate = (comment: Comment) => {
    if (!comment.is_private) return true;
    if (!user) return false;
    if (isAdmin) return true;
    if (comment.user_id === user.id) return true;
    const projResp = resolvedProjectResp ?? projectResponsableUserId;
    if (projResp && user.id === projResp) return true;
    if (allActionResponsables.includes(user.id)) return true;
    if (actionResponsableUserId && user.id === actionResponsableUserId) return true;
    return false;
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("project_action_comments")
      .select("*")
      .eq("action_id", actionId)
      .order("created_at", { ascending: true });
    const cmts = (data ?? []) as Comment[];
    setComments(cmts);

    const userIds = [...new Set(cmts.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nom, prenom, email, fonction")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => { fetchComments(); }, [actionId]);

  const handleSubmit = async () => {
    if (!newContent.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("project_action_comments").insert({
      action_id: actionId,
      user_id: user.id,
      content: newContent.trim(),
      is_private: isPrivate,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setNewContent("");
    setIsPrivate(false);
    fetchComments();
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from("project_action_comments")
      .update({ content: editContent.trim() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("project_action_comments")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commentaire supprimé");
    fetchComments();
  };

  const getDisplayName = (userId: string) => {
    const p = profiles[userId];
    if (!p) return "Utilisateur";
    if (p.prenom || p.nom) return `${p.prenom || ""} ${p.nom || ""}`.trim();
    return p.email || "Utilisateur";
  };

  const getInitials = (userId: string) => {
    const p = profiles[userId];
    if (!p) return "?";
    return `${(p.prenom || "")[0] || ""}${(p.nom || "")[0] || ""}`.toUpperCase() || "?";
  };

  const canEditComment = (comment: Comment) => {
    if (comment.user_id !== user?.id) return false;
    return differenceInMinutes(new Date(), parseISO(comment.created_at)) < 5;
  };

  const canDeleteComment = (comment: Comment) => {
    if (isAdmin) return true;
    if (comment.user_id !== user?.id) return false;
    return differenceInMinutes(new Date(), parseISO(comment.created_at)) < 5;
  };

  const isEdited = (comment: Comment) => comment.updated_at !== comment.created_at;

  /** Returns true if the comment author is DG or PDG (matched on profile.fonction) */
  const isExecutiveAuthor = (userId: string) => {
    const f = (profiles[userId]?.fonction || "").toLowerCase().trim();
    if (!f) return false;
    // Match standalone "dg" or "pdg" (also "directeur général" / "président")
    return /\b(dg|pdg)\b/.test(f)
      || /directeur\s+g[ée]n[ée]ral/.test(f)
      || /pr[ée]sident.*directeur/.test(f);
  };

  /** Show red "Direction" badge for 48h after the comment was posted */
  const showExecutiveBadge = (comment: Comment) => {
    if (!isExecutiveAuthor(comment.user_id)) return false;
    const ageHours = (Date.now() - parseISO(comment.created_at).getTime()) / 36e5;
    return ageHours < 48;
  };

  const visibleComments = comments.filter(canSeePrivate);

  return (
    <div className="space-y-3">
      {visibleComments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Aucun commentaire</p>
      )}

      {visibleComments.map(comment => {
        const execBadge = showExecutiveBadge(comment);
        return (
        <div
          key={comment.id}
          className={`flex gap-2.5 ${
            execBadge
              ? "rounded-md border-2 border-destructive/60 bg-destructive/5 p-2 ring-1 ring-destructive/20"
              : comment.is_private
                ? "rounded-md border border-amber-400/40 bg-amber-500/5 p-2"
                : ""
          }`}
        >
          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
            <AvatarFallback className={`text-[10px] ${execBadge ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>{getInitials(comment.user_id)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">{getDisplayName(comment.user_id)}</span>
              {execBadge && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide animate-pulse">
                  Direction · Nouveau
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true, locale: fr })}
              </span>
              {isEdited(comment) && <span className="text-[10px] text-muted-foreground italic">(modifié)</span>}
              {comment.is_private && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  <Lock className="h-2.5 w-2.5" /> Privé
                </span>
              )}
            </div>

            {editingId === comment.id ? (
              <div className="mt-1 space-y-1.5">
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="text-xs min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => handleUpdate(comment.id)}>
                    <Check className="h-3 w-3" /> Valider
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" /> Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{comment.content}</p>
            )}

            {editingId !== comment.id && (
              <div className="flex gap-1 mt-1">
                {canEditComment(comment) && (
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                    onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                  >
                    <Pencil className="h-2.5 w-2.5" /> Modifier
                  </button>
                )}
                {canDeleteComment(comment) && (
                  <button
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5 ml-2"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        );
      })}

      {canComment && (
        <div className="space-y-2">
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="text-xs min-h-[50px] flex-1"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            <Button size="sm" className="h-8 shrink-0" onClick={handleSubmit} disabled={submitting || !newContent.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          {(() => {
            const projResp = resolvedProjectResp ?? projectResponsableUserId;
            const canMarkPrivate = isAdmin
              || (!!user && projResp === user.id)
              || (!!user && allActionResponsables.includes(user.id))
              || (!!user && actionResponsableUserId === user.id);
            if (!canMarkPrivate) return null;
            return (
              <div className="flex items-center gap-2">
                <Switch
                  id={`private-${actionId}`}
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  className="scale-75 origin-left"
                />
                <Label
                  htmlFor={`private-${actionId}`}
                  className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="h-3 w-3" /> Commentaire privé (responsables uniquement)
                </Label>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
