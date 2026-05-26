import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { LicenseProvider } from "@/contexts/LicenseContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Processus = lazy(() => import("./pages/Processus"));
const ProcessDetail = lazy(() => import("./pages/ProcessDetail"));
const Cartographie = lazy(() => import("./pages/Cartographie"));
const Bpmn = lazy(() => import("./pages/Bpmn"));
const Documents = lazy(() => import("./pages/Documents"));
const Indicateurs = lazy(() => import("./pages/Indicateurs"));
const Risques = lazy(() => import("./pages/Risques"));
const Audits = lazy(() => import("./pages/Audits"));
const NonConformites = lazy(() => import("./pages/NonConformites"));
const Actions = lazy(() => import("./pages/Actions"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Journal = lazy(() => import("./pages/Journal"));
const Utilisateurs = lazy(() => import("./pages/Utilisateurs"));
const Acteurs = lazy(() => import("./pages/Acteurs"));
const Incidents = lazy(() => import("./pages/Incidents"));
const DashboardAuditNC = lazy(() => import("./pages/DashboardAuditNC"));
const EnjeuContexte = lazy(() => import("./pages/EnjeuContexte"));
const GroupesActeurs = lazy(() => import("./pages/GroupesActeurs"));
const PolitiqueQualite = lazy(() => import("./pages/PolitiqueQualite"));
const RevueDirection = lazy(() => import("./pages/RevueDirection"));
const RevueDirectionISO = lazy(() => import("./pages/RevueDirectionISO"));
const CompetencesPage = lazy(() => import("./pages/Competences"));
const SatisfactionClient = lazy(() => import("./pages/SatisfactionClient"));
const Fournisseurs = lazy(() => import("./pages/Fournisseurs"));
const EvaluationProcessus = lazy(() => import("./pages/EvaluationProcessus"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const AdminProcessPermissions = lazy(() => import("./pages/AdminProcessPermissions"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const SurveyPublicPage = lazy(() => import("./pages/SurveyPublicPage"));
const DashboardIndicateurs = lazy(() => import("./pages/DashboardIndicateurs"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminNotificationsConfig = lazy(() => import("./pages/AdminNotificationsConfig"));
const AdminDocumentsConfig = lazy(() => import("./pages/AdminDocumentsConfig"));
const ValidationsDashboard = lazy(() => import("./pages/ValidationsDashboard"));
const AdminEmailLogs = lazy(() => import("./pages/AdminEmailLogs"));
const Modules = lazy(() => import("./pages/Modules"));
const ProcessFlowchartPage = lazy(() => import("./pages/ProcessFlowchartPage"));
const ProjectPlanningPage = lazy(() => import("./pages/ProjectPlanningPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppSettingsProvider>
            <LicenseProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/survey/:token" element={<Suspense fallback={<PageLoader />}><SurveyPublicPage /></Suspense>} />
              {/* Principal */}
              <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
              <Route path="/modules" element={<ProtectedPage><Modules /></ProtectedPage>} />
              <Route path="/acteurs" element={<ProtectedPage><RoleGuard requiredModule="acteurs"><Acteurs /></RoleGuard></ProtectedPage>} />
              {/* Processus */}
              <Route path="/processus" element={<ProtectedPage><RoleGuard requiredModule="processus"><Processus /></RoleGuard></ProtectedPage>} />
              <Route path="/processus/:id" element={<ProtectedPage><RoleGuard requiredModule="processus"><ProcessDetail /></RoleGuard></ProtectedPage>} />
              <Route path="/processus/:id/logigramme" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><RoleGuard requiredModule="processus"><ProcessFlowchartPage /></RoleGuard></Suspense></ProtectedRoute>} />
              <Route path="/cartographie" element={<ProtectedPage><RoleGuard requiredModule="cartographie"><Cartographie /></RoleGuard></ProtectedPage>} />
              <Route path="/bpmn" element={<ProtectedPage><RoleGuard requiredModule="bpmn"><Bpmn /></RoleGuard></ProtectedPage>} />
              <Route path="/evaluation-processus" element={<ProtectedPage><RoleGuard requiredModule="evaluation_processus"><EvaluationProcessus /></RoleGuard></ProtectedPage>} />
              {/* Manager processus */}
              <Route path="/dashboard-indicateurs" element={<ProtectedPage><RoleGuard requiredModule="indicateurs"><DashboardIndicateurs /></RoleGuard></ProtectedPage>} />
              <Route path="/documents" element={<ProtectedPage><RoleGuard requiredModule="documents"><Documents /></RoleGuard></ProtectedPage>} />
              <Route path="/indicateurs" element={<ProtectedPage><RoleGuard requiredModule="indicateurs"><Indicateurs /></RoleGuard></ProtectedPage>} />
              <Route path="/risques" element={<ProtectedPage><RoleGuard requiredModule="risques"><Risques /></RoleGuard></ProtectedPage>} />
              <Route path="/incidents" element={<ProtectedPage><RoleGuard requiredModule="incidents"><Incidents /></RoleGuard></ProtectedPage>} />
              <Route path="/enjeux-contexte" element={<ProtectedPage><RoleGuard requiredModule="enjeux_contexte"><EnjeuContexte /></RoleGuard></ProtectedPage>} />
              {/* Pilotage SMQ */}
              <Route path="/politique-qualite" element={<ProtectedPage><RoleGuard requiredModule="politique_qualite"><PolitiqueQualite /></RoleGuard></ProtectedPage>} />
              <Route path="/revue-direction" element={<ProtectedPage><RoleGuard requiredModule="revue_direction"><RevueDirection /></RoleGuard></ProtectedPage>} />
              <Route path="/revue-direction-iso" element={<ProtectedPage><RoleGuard requiredModule="revue_direction_iso"><RevueDirectionISO /></RoleGuard></ProtectedPage>} />
              <Route path="/competences" element={<ProtectedPage><RoleGuard requiredModule="competences"><CompetencesPage /></RoleGuard></ProtectedPage>} />
              <Route path="/satisfaction-client" element={<ProtectedPage><RoleGuard requiredModule="satisfaction_client"><SatisfactionClient /></RoleGuard></ProtectedPage>} />
              <Route path="/fournisseurs" element={<ProtectedPage><RoleGuard requiredModule="fournisseurs"><Fournisseurs /></RoleGuard></ProtectedPage>} />
              {/* Audit & Amélioration */}
              <Route path="/dashboard-audit" element={<ProtectedPage><RoleGuard requiredModule="audits"><DashboardAuditNC /></RoleGuard></ProtectedPage>} />
              <Route path="/audits" element={<ProtectedPage><RoleGuard requiredModule="audits"><Audits /></RoleGuard></ProtectedPage>} />
              <Route path="/non-conformites" element={<ProtectedPage><RoleGuard requiredModule="non_conformites"><NonConformites /></RoleGuard></ProtectedPage>} />
              <Route path="/actions" element={<ProtectedPage><RoleGuard requiredModule="actions"><Actions /></RoleGuard></ProtectedPage>} />
              <Route path="/actions/:projectId" element={<ProtectedPage><RoleGuard requiredModule="actions"><ProjectDetail /></RoleGuard></ProtectedPage>} />
              <Route path="/actions/:projectId/planning" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><RoleGuard requiredModule="actions"><ProjectPlanningPage /></RoleGuard></Suspense></ProtectedRoute>} />
              <Route path="/journal" element={<ProtectedPage><RoleGuard requiredModule="journal"><Journal /></RoleGuard></ProtectedPage>} />
              {/* Administration */}
              <Route path="/utilisateurs" element={<ProtectedPage><RoleGuard requiredModule="utilisateurs"><Utilisateurs /></RoleGuard></ProtectedPage>} />
              <Route path="/groupes-acteurs" element={<ProtectedPage><RoleGuard requiredModule="groupes_acteurs"><GroupesActeurs /></RoleGuard></ProtectedPage>} />
              <Route path="/admin/permissions" element={<ProtectedPage><RoleGuard allowedRoles={["admin", "super_admin"]}><AdminPermissions /></RoleGuard></ProtectedPage>} />
              <Route path="/admin/permissions-processus" element={<ProtectedPage><RoleGuard allowedRoles={["admin", "super_admin", "rmq"]}><AdminProcessPermissions /></RoleGuard></ProtectedPage>} />
              <Route path="/admin/notifications" element={<ProtectedPage><RoleGuard requiredModule="notifications"><AdminNotificationsConfig /></RoleGuard></ProtectedPage>} />
              <Route path="/admin/documents-config" element={<ProtectedPage><RoleGuard requiredModule="gestion_documentaire"><AdminDocumentsConfig /></RoleGuard></ProtectedPage>} />
              <Route path="/admin/email-logs" element={<ProtectedPage><RoleGuard allowedRoles={["admin", "super_admin"]}><AdminEmailLogs /></RoleGuard></ProtectedPage>} />
              {/* Notifications */}
              <Route path="/notifications" element={<ProtectedPage><Notifications /></ProtectedPage>} />
              {/* Super Admin */}
              <Route path="/super-admin" element={<ProtectedPage><RoleGuard allowedRoles={["super_admin"]}><SuperAdmin /></RoleGuard></ProtectedPage>} />
              <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
            </Routes>
            </LicenseProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
