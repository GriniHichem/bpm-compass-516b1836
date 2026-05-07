import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AtSign, Hash, ListTodo, CalendarIcon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useActeurs } from "@/hooks/useActeurs";
import { ActeurUserSelect } from "@/components/ActeurUserSelect";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildUserTag,
  buildActionTag,
  buildTaskTag,
  buildDateTag,
} from "@/lib/commentTags";

interface Profile {
  id: string;
  nom: string | null;
  prenom: string | null;
  email: string;
}

interface ActionItem {
  id: string;
  title: string;
}

interface Props {
  projectId: string;
  actionId: string;
  canCreateTask: boolean;
  onInsert: (token: string) => void;
}

export function CommentToolbar({ projectId, actionId, canCreateTask, onInsert }: Props) {
  const { user } = useAuth();
  const { acteurs } = useActeurs();

  // ----- Mention picker state -----
  const [users, setUsers] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersOpen, setUsersOpen] = useState(false);

  // ----- Action picker state -----
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [actionSearch, setActionSearch] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);

  // ----- Task creator state -----
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskActeur, setTaskActeur] = useState("");
  const [taskUser, setTaskUser] = useState("");
  const [taskDate, setTaskDate] = useState<Date | undefined>(undefined);
  const [creatingTask, setCreatingTask] = useState(false);

  // ----- Date picker state -----
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (!usersOpen || users.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nom, prenom, email")
        .eq("actif", true)
        .order("nom");
      setUsers((data ?? []) as Profile[]);
    })();
  }, [usersOpen]);

  useEffect(() => {
    if (!actionsOpen) return;
    (async () => {
      const { data } = await supabase
        .from("project_actions")
        .select("id, title")
        .eq("project_id", projectId)
        .order("ordre");
      setActions((data ?? []) as ActionItem[]);
    })();
  }, [actionsOpen, projectId]);

  const filteredUsers = users.filter((p) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (p.nom ?? "").toLowerCase().includes(q) ||
      (p.prenom ?? "").toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });
  const filteredActions = actions.filter((a) =>
    !actionSearch.trim() ? true : a.title.toLowerCase().includes(actionSearch.toLowerCase())
  );

  const handleSelectUser = (p: Profile) => {
    const label = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.email;
    onInsert(buildUserTag(p.id, label));
    setUsersOpen(false);
    setUserSearch("");
  };

  const handleSelectAction = (a: ActionItem) => {
    onInsert(buildActionTag(a.id, a.title));
    setActionsOpen(false);
    setActionSearch("");
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setCreatingTask(true);
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        action_id: actionId,
        title: taskTitle.trim(),
        responsable_id: taskActeur || null,
        responsable_user_id: taskUser || null,
        echeance: taskDate ? format(taskDate, "yyyy-MM-dd") : null,
        statut: "a_faire",
        avancement: 0,
      })
      .select("id, title")
      .single();
    setCreatingTask(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erreur de création");
      return;
    }
    // Ensure parent action is in multi_tasks mode so the task is visible
    await supabase.from("project_actions").update({ multi_tasks: true }).eq("id", actionId);
    toast.success("Tâche créée");
    onInsert(buildTaskTag(data.id, data.title));
    setTaskOpen(false);
    setTaskTitle("");
    setTaskActeur("");
    setTaskUser("");
    setTaskDate(undefined);
  };

  const handleSelectDate = (d: Date | undefined) => {
    if (!d) return;
    const iso = format(d, "yyyy-MM-dd");
    const label = format(d, "dd MMM yyyy", { locale: fr });
    onInsert(buildDateTag(iso, label));
    setDateOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Mention */}
      <Popover open={usersOpen} onOpenChange={setUsersOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <AtSign className="h-3.5 w-3.5" /> Mentionner
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            placeholder="Rechercher un utilisateur..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="h-8 text-xs mb-2"
            autoFocus
          />
          <ScrollArea className="h-56">
            <div className="space-y-0.5">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucun utilisateur</p>
              )}
              {filteredUsers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectUser(p)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
                >
                  <span className="font-medium">{`${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.email}</span>
                  <span className="block text-[10px] text-muted-foreground">{p.email}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Action reference */}
      <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Hash className="h-3.5 w-3.5" /> Action
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            placeholder="Rechercher une action..."
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            className="h-8 text-xs mb-2"
            autoFocus
          />
          <ScrollArea className="h-56">
            <div className="space-y-0.5">
              {filteredActions.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucune action</p>
              )}
              {filteredActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAction(a)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
                >
                  {a.title}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Task creator */}
      {canCreateTask && (
        <Popover open={taskOpen} onOpenChange={setTaskOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <ListTodo className="h-3.5 w-3.5" /> Tâche
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-2" align="start">
            <p className="text-xs font-medium">Créer une tâche</p>
            <Input
              placeholder="Titre de la tâche"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
            <ActeurUserSelect
              acteurValue={taskActeur}
              userValue={taskUser}
              onActeurChange={setTaskActeur}
              onUserChange={setTaskUser}
              acteurs={acteurs}
              placeholder="Responsable (optionnel)"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start w-full">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {taskDate ? format(taskDate, "dd MMM yyyy", { locale: fr }) : "Échéance (optionnelle)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={taskDate}
                  onSelect={setTaskDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              size="sm"
              className="h-8 w-full text-xs gap-1"
              onClick={handleCreateTask}
              disabled={!taskTitle.trim() || creatingTask}
            >
              <Plus className="h-3.5 w-3.5" /> Créer et insérer
            </Button>
          </PopoverContent>
        </Popover>
      )}

      {/* Date */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" /> Date
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            onSelect={handleSelectDate}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
