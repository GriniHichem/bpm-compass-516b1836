import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Copy, Archive, Star, Eye, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import SurveyTemplateEditor from "./SurveyTemplateEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ValidationPanel } from "@/components/validation/ValidationPanel";

const statusConfig: Record<string, { label: string; color: string }> = {
  actif: { label: "Actif", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  inactif: { label: "Inactif", color: "bg-muted text-muted-foreground" },
  brouillon: { label: "Brouillon", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

const typeLabels: Record<string, string> = {
  satisfaction_client: "Satisfaction client",
  fournisseur: "Fournisseur",
  service: "Service",
  audit_interne: "Audit interne",
  autre: "Autre",
};

export default function SurveyTemplateManager() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("rmq");
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [validationId, setValidationId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["survey_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_templates")
        .select("*")
        .neq("status", "archive")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: async (id: string) => {
      // Remove all defaults first
      await supabase.from("survey_templates").update({ is_default: false }).eq("is_default", true);
      const { error } = await supabase.from("survey_templates").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey_templates"] });
      toast({ title: "Modèle par défaut mis à jour" });
    },
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("survey_templates").update({ status: "archive" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey_templates"] });
      toast({ title: "Modèle archivé" });
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (tpl: any) => {
      // Duplicate template
      const { data: newTpl, error } = await supabase.from("survey_templates").insert({
        name: `${tpl.name} (copie)`,
        code: `${tpl.code}-COPY-${Date.now().toString(36).toUpperCase()}`,
        version: 1,
        description: tpl.description,
        type: tpl.type,
        status: "brouillon",
        is_default: false,
        notes_internes: tpl.notes_internes,
      }).select().single();
      if (error) throw error;

      // Duplicate sections and questions
      const { data: sections } = await supabase
        .from("survey_template_sections")
        .select("*, survey_template_questions(*)")
        .eq("template_id", tpl.id)
        .order("order_index");

      for (const sec of sections || []) {
        const { data: newSec } = await supabase.from("survey_template_sections").insert({
          template_id: newTpl.id,
          title: sec.title,
          code: sec.code,
          description: sec.description,
          order_index: sec.order_index,
          is_active: sec.is_active,
        }).select().single();

        if (newSec && sec.survey_template_questions?.length) {
          const questions = sec.survey_template_questions.map((q: any) => ({
            section_id: newSec.id,
            label: q.label,
            question_type: q.question_type,
            order_index: q.order_index,
            has_absolute_evaluation: q.has_absolute_evaluation,
            has_competitor_evaluation: q.has_competitor_evaluation,
            has_observation_absolute: q.has_observation_absolute,
            has_observation_relative: q.has_observation_relative,
            is_required: q.is_required,
            options: q.options,
            poids: q.poids,
          }));
          await supabase.from("survey_template_questions").insert(questions);
        }
      }
      return newTpl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey_templates"] });
      toast({ title: "Modèle dupliqué avec succès" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditingTemplate(null); setViewOnly(false); setEditorOpen(true); };
  const openEdit = (tpl: any) => { setEditingTemplate(tpl); setViewOnly(false); setEditorOpen(true); };
  const openView = (tpl: any) => { setEditingTemplate(tpl); setViewOnly(true); setEditorOpen(true); };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" />Nouveau modèle</Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Par défaut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : templates.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun modèle de sondage.</TableCell></TableRow>
            ) : templates.map((tpl: any) => {
              const st = statusConfig[tpl.status] || statusConfig.brouillon;
              return (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell className="font-mono text-xs">{tpl.code}</TableCell>
                  <TableCell>v{tpl.version}</TableCell>
                  <TableCell>{typeLabels[tpl.type] || tpl.type}</TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                  <TableCell>
                    {tpl.is_default ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <Star className="h-3 w-3 mr-1 fill-current" />Par défaut
                      </Badge>
                    ) : canEdit ? (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDefaultMut.mutate(tpl.id)}>
                        Définir
                      </Button>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(tpl.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openView(tpl)} title="Voir"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setValidationId(tpl.id)} title="Validation R/V/A"><ShieldCheck className="h-4 w-4 text-primary" /></Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)} title="Modifier"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => duplicateMut.mutate(tpl)} title="Dupliquer"><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => archiveMut.mutate(tpl.id)} title="Archiver"><Archive className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <SurveyTemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        viewOnly={viewOnly}
      />

      <Dialog open={!!validationId} onOpenChange={(o) => !o && setValidationId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Validation du modèle d'enquête</DialogTitle></DialogHeader>
          {validationId && (
            <ValidationPanel
              entityType="enquete_satisfaction"
              entityId={validationId}
              onApproved={() => qc.invalidateQueries({ queryKey: ["survey_templates"] })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
