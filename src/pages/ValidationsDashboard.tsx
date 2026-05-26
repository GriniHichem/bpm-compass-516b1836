import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2 } from "lucide-react";

interface Row {
  id: string;
  entity_type: string;
  entity_id: string;
  statut: string;
  date_soumission: string | null;
  updated_at: string;
  type_label: string;
}

const TYPE_LABELS: Record<string, string> = {
  document: "Document",
  processus: "Processus",
  politique_qualite: "Politique qualité",
  objectif_qualite: "Objectif qualité",
  plan_action: "Plan d'action",
  revue: "Revue",
  fournisseur: "Fournisseur",
  enquete_satisfaction: "Enquête",
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  en_approbation: "En approbation",
  approuve: "Approuvé",
  refuse: "Refusé",
  obsolete: "Obsolète",
};

export default function ValidationsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [toVerify, setToVerify] = useState<Row[]>([]);
  const [toApprove, setToApprove] = useState<Row[]>([]);
  const [refused, setRefused] = useState<Row[]>([]);
  const [submitted, setSubmitted] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const map = (rows: any[]): Row[] =>
        (rows ?? []).map((r) => ({ ...r, type_label: TYPE_LABELS[r.entity_type] ?? r.entity_type }));

      const q1 = supabase.from("validation_workflows" as any).select("*")
        .eq("verificateur_user_id", user.id).eq("statut", "en_revue").order("updated_at", { ascending: false });
      const q2 = supabase.from("validation_workflows" as any).select("*")
        .eq("approbateur_user_id", user.id).eq("statut", "en_approbation").order("updated_at", { ascending: false });
      const q3 = supabase.from("validation_workflows" as any).select("*")
        .eq("redacteur_user_id", user.id).eq("statut", "refuse").order("updated_at", { ascending: false });
      const q4 = supabase.from("validation_workflows" as any).select("*")
        .eq("redacteur_user_id", user.id).in("statut", ["en_revue", "en_approbation"]).order("updated_at", { ascending: false });

      const [r1, r2, r3, r4] = await Promise.all([q1, q2, q3, q4]);
      setToVerify(map((r1.data as any[]) ?? []));
      setToApprove(map((r2.data as any[]) ?? []));
      setRefused(map((r3.data as any[]) ?? []));
      setSubmitted(map((r4.data as any[]) ?? []));
      setLoading(false);
    })();
  }, [user]);

  const renderTable = (rows: Row[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Mise à jour</TableHead>
          <TableHead>ID entité</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun élément</TableCell></TableRow>
        ) : rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.type_label}</TableCell>
            <TableCell><Badge variant="secondary">{STATUT_LABELS[r.statut] ?? r.statut}</Badge></TableCell>
            <TableCell className="text-xs">{new Date(r.updated_at).toLocaleString("fr-FR")}</TableCell>
            <TableCell className="font-mono text-xs">{r.entity_id.slice(0, 8)}…</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Validations</h1>
          <p className="text-sm text-muted-foreground">Vue transversale de tous les workflows de validation ISO 9001</p>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="approve">
          <TabsList>
            <TabsTrigger value="approve">À approuver ({toApprove.length})</TabsTrigger>
            <TabsTrigger value="verify">À vérifier ({toVerify.length})</TabsTrigger>
            <TabsTrigger value="refused">Refusés ({refused.length})</TabsTrigger>
            <TabsTrigger value="submitted">En attente ({submitted.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="approve"><Card><CardHeader><CardTitle>En attente de mon approbation</CardTitle></CardHeader><CardContent>{renderTable(toApprove)}</CardContent></Card></TabsContent>
          <TabsContent value="verify"><Card><CardHeader><CardTitle>En attente de ma vérification</CardTitle></CardHeader><CardContent>{renderTable(toVerify)}</CardContent></Card></TabsContent>
          <TabsContent value="refused"><Card><CardHeader><CardTitle>Mes documents refusés à retravailler</CardTitle></CardHeader><CardContent>{renderTable(refused)}</CardContent></Card></TabsContent>
          <TabsContent value="submitted"><Card><CardHeader><CardTitle>Mes soumissions en cours</CardTitle></CardHeader><CardContent>{renderTable(submitted)}</CardContent></Card></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
