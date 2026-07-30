import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMetaStatus } from "@/hooks/useMetaStatus";
import { useMetaWebhook } from "@/hooks/useMetaWebhook";
import { useMetaMessages } from "@/hooks/useMetaMessages";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { saveMetaConfig, diagnosticarMeta } from "@/lib/meta.functions";
import { useServerFn } from "@tanstack/react-start";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Activity,
  Send,
  Settings,
  Webhook,
  BarChart3,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Phone,
  Clock,
  Loader2,
  Copy,
  FileCode2,
  Building2,
  Key,
} from "lucide-react";

export const Route = createFileRoute("/app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Meta Cloud API" },
      { name: "description", content: "Administração oficial via Meta WhatsApp Cloud API (Graph API v20.0+)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetaWhatsAppAdminPage,
});

function MetaWhatsAppAdminPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("ADMIN");
  const qc = useQueryClient();

  // 1. Hooks de estado da Meta Cloud API
  const { status, isLoadingStatus, refetchStatus, config, refetchConfig } = useMetaStatus();
  const webhookInfo = useMetaWebhook();
  const [searchLog, setSearchLog] = useState("");
  const {
    sendTestMessage,
    isSending,
    sendResult,
    metrics,
    logs,
    isLoadingLogs,
  } = useMetaMessages(searchLog);

  const {
    templates,
    isLoadingTemplates,
    sendTemplateTest,
    isSendingTemplate,
    sendTemplateResult,
  } = useMetaTemplates();

  // 2. Formulário de Teste de Texto
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Olá! Esta é uma mensagem de teste enviada via Meta WhatsApp Cloud API oficial.",
  );

  // 3. Formulário de Teste de Template
  const [templatePhone, setTemplatePhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("solicitacao_consulta");

  // 4. Formulário de Configurações
  const saveCfgFn = useServerFn(saveMetaConfig);
  const [cfgForm, setCfgForm] = useState({
    access_token: "",
    phone_number_id: "",
    business_account_id: "",
    app_id: "",
    app_secret: "",
    verify_token: "clinica_zoe_verify_token_2026",
    graph_version: "v20.0",
  });
  const [isSaving, setIsSaving] = useState(false);

  // 5. Diagnóstico de homologação (usa o token salvo, em tempo real)
  const diagnosticarFn = useServerFn(diagnosticarMeta);
  const [diag, setDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const runDiagnostico = async () => {
    try {
      setDiagLoading(true);
      const r = await diagnosticarFn({ data: {} });
      setDiag(r);
      if (r.ok) toast.success("Token válido — conexão com a Meta confirmada.");
      else toast.error(r.erro ?? "Falha na validação do token.", { duration: 12000 });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao executar diagnóstico.");
    } finally {
      setDiagLoading(false);
    }
  };


  useEffect(() => {
    if (config) {
      setCfgForm({
        access_token: config.access_token ?? "",
        phone_number_id: config.phone_number_id ?? "",
        business_account_id: config.business_account_id ?? "",
        app_id: config.app_id ?? "",
        app_secret: config.app_secret ?? "",
        verify_token: config.verify_token ?? "clinica_zoe_verify_token_2026",
        graph_version: config.graph_version ?? "v20.0",
      });
    }
  }, [config]);

  const handleSaveMetaConfig = async () => {
    try {
      setIsSaving(true);
      await saveCfgFn({ data: cfgForm });
      toast.success("Configurações salvas com sucesso!");
      refetchStatus();
      refetchConfig();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const systemWebhookUrl = `${currentOrigin}/api/public/hooks/meta`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp (Meta Cloud API)</h1>
          <p className="text-sm text-muted-foreground">
            Integração nativa e oficial via Meta for Developers (Graph API v20.0+).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStatus();
              refetchConfig();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Sincronizar API
          </Button>
        </div>
      </div>

      {/* Banner Informativo de Modo Development / Allowed List */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-soft dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              Aviso Importante — Modo de Desenvolvimento (Development Mode)
            </p>
            <p className="text-xs leading-relaxed">
              O aplicativo da Meta está configurado em modo <strong>Development</strong>. Apenas números cadastrados na <strong>Allowed List (Destinatários de Teste)</strong> no painel da Meta podem receber mensagens.
            </p>
            <div className="pt-1 text-xs">
              <span className="font-medium">Como cadastrar números de teste:</span>
              <ol className="list-decimal pl-4 mt-0.5 space-y-0.5 text-[11px] opacity-90">
                <li>Acesse o <strong>Meta Developers Console</strong> &gt; seu App &gt; <strong>WhatsApp API Setup</strong>.</li>
                <li>No campo <strong>"To" (Destinatário)</strong>, selecione <em>"Manage Phone Number List"</em>.</li>
                <li>Adicione seu número de WhatsApp com DDD e valide o código SMS de verificação recebido.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Cards Superiores */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* CARD 1: Status da Meta Cloud API */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Status da Meta Cloud API</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Graph Meta</span>
              <Badge
                variant="outline"
                className={
                  status?.online
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300"
                }
              >
                {isLoadingStatus ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : status?.online ? (
                  "Online"
                ) : (
                  "Offline"
                )}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Token de Acesso</span>
              <span className="font-semibold text-foreground">
                {status?.tokenValid ? (
                  <span className="text-emerald-600">Válido</span>
                ) : (
                  <span className="text-red-600">Inválido / Ausente</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Número Conectado</span>
              <span className="font-semibold text-foreground">
                {status?.displayPhoneNumber ?? "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Business Account</span>
              <span className="font-semibold text-foreground">
                {config?.business_account_id ? `ID ${config.business_account_id}` : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Versão Graph API</span>
              <span className="font-semibold text-foreground">{status?.graphVersion ?? "v20.0"}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Latência</span>
              <span className="font-semibold text-foreground">
                {status?.latencyMs != null ? `${status.latencyMs} ms` : "—"}
              </span>
            </div>

            {status?.error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Erro: {status.error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* CARD 3: Webhook Status */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Status do Webhook</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Integração Webhook</span>
              <Badge
                variant="outline"
                className={
                  webhookInfo.isValid
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : webhookInfo.isConfigured
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-red-100 text-red-800 border-red-200"
                }
              >
                {webhookInfo.isValid
                  ? "Configurado"
                  : webhookInfo.isConfigured
                    ? "Pendente"
                    : "Inexistente"}
              </Badge>
            </div>

            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-muted-foreground">URL de Callback (Meta Dashboard):</p>
              <div className="flex items-center gap-1">
                <Input value={systemWebhookUrl} readOnly className="h-8 font-mono text-[11px]" />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(systemWebhookUrl);
                    toast.success("URL do Webhook copiada!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Verify Token:</p>
              <code className="block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
                {webhookInfo.verifyToken}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* CARD 6: Monitoramento Rápido */}
        <Card className="shadow-soft md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Resumo de Mensagens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">Enviadas</p>
                <p className="text-lg font-bold text-blue-600">{metrics?.enviadas ?? 0}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">Entregues</p>
                <p className="text-lg font-bold text-sky-600">{metrics?.entregues ?? 0}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">Lidas</p>
                <p className="text-lg font-bold text-indigo-600">{metrics?.lidas ?? 0}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">Respostas</p>
                <p className="text-lg font-bold text-emerald-600">{metrics?.recebidas ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais */}
      <Tabs defaultValue="configuracao" className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="configuracao" className="gap-2">
            <Settings className="h-4 w-4" /> Configuração Meta
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-2">
            <Send className="h-4 w-4" /> Enviar Teste
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileCode2 className="h-4 w-4" /> Templates Oficiais
          </TabsTrigger>
          <TabsTrigger value="monitoramento" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Monitoramento
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" /> Histórico de Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CARD 2 - Configuração Meta */}
        <TabsContent value="configuracao">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais Oficiais da Meta WhatsApp Cloud API</CardTitle>
              <CardDescription>
                Insira as credenciais do seu aplicativo cadastrado na Meta for Developers. Os tokens são armazenados com segurança no servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Access Token (Permanent User / System User Token)</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="EAAG..."
                    value={cfgForm.access_token}
                    onChange={(e) => setCfgForm((f) => ({ ...f, access_token: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input
                    placeholder="Ex: 105928374659201"
                    value={cfgForm.phone_number_id}
                    onChange={(e) => setCfgForm((f) => ({ ...f, phone_number_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID (WABA ID)</Label>
                  <Input
                    placeholder="Ex: 109283746192837"
                    value={cfgForm.business_account_id}
                    onChange={(e) => setCfgForm((f) => ({ ...f, business_account_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>App ID</Label>
                  <Input
                    placeholder="Ex: 928374619283"
                    value={cfgForm.app_id}
                    onChange={(e) => setCfgForm((f) => ({ ...f, app_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>App Secret (Assinatura de Segurança)</Label>
                  <Input
                    type="password"
                    placeholder="Chave secreta do aplicativo Meta"
                    value={cfgForm.app_secret}
                    onChange={(e) => setCfgForm((f) => ({ ...f, app_secret: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Webhook Verify Token</Label>
                  <Input
                    value={cfgForm.verify_token}
                    onChange={(e) => setCfgForm((f) => ({ ...f, verify_token: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Versão Graph API</Label>
                  <Input
                    value={cfgForm.graph_version}
                    onChange={(e) => setCfgForm((f) => ({ ...f, graph_version: e.target.value }))}
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSaveMetaConfig} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Salvar Configurações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      refetchStatus();
                      toast.info("Validando token com a Meta API...");
                    }}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Validar Token & Conexão
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Homologação: usa imediatamente o token salvo, sem recompilar */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Diagnóstico e Homologação</CardTitle>
              <CardDescription>
                Consulta a Meta em tempo real com o token atualmente salvo. Ideal para validar um token temporário antes de migrar para o permanente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={runDiagnostico} disabled={diagLoading} className="gap-2">
                {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Executar diagnóstico agora
              </Button>

              {diag && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={diag.ok ? "default" : "destructive"}>
                      {diag.ok ? "Token válido" : "Token inválido"}
                    </Badge>
                    <Badge variant="outline">HTTP {diag.httpStatus ?? "—"}</Badge>
                    <Badge variant="outline">{diag.graphVersion ?? "—"}</Badge>
                    <Badge variant="outline">{diag.duracaoMs} ms</Badge>
                  </div>

                  {diag.numero && (
                    <p className="text-sm text-muted-foreground">
                      Número: <strong>{diag.numero.display_phone_number}</strong> — {diag.numero.verified_name} (qualidade{" "}
                      {diag.numero.quality_rating})
                    </p>
                  )}
                  {diag.erro && <p className="text-sm text-destructive">{diag.erro}</p>}

                  {diag.templates?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {diag.templates.map((t: any) => (
                        <Badge key={`${t.name}-${t.language}`} variant="secondary" className="font-normal">
                          {t.name} · {t.language} · {t.status}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                    {JSON.stringify(diag, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* TAB 2: CARD 4 - Envio de Teste de Texto */}
        <TabsContent value="mensagens">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensagem de Teste (Texto)</CardTitle>
              <CardDescription>
                Envie uma mensagem livre para testar a comunicação direta com o número cadastrado na Meta Cloud API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Telefone do Destinatário (WhatsApp)</Label>
                <Input
                  placeholder="Ex: 5511999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  rows={4}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
              </div>

              <Button
                onClick={() => sendTestMessage({ to: testPhone, message: testMessage })}
                disabled={isSending || !testPhone || !testMessage}
                className="gap-2"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Teste de Texto
              </Button>

              {sendResult && (
                <div className="mt-4 rounded-xl border bg-muted p-4">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <span>Retorno da Meta Cloud API (HTTP {sendResult.status}):</span>
                    <span>Tempo: {sendResult.duracaoMs} ms</span>
                  </div>
                  {sendResult.wamid && (
                    <p className="text-xs text-emerald-600 font-mono mb-2">
                      Message ID (wamid): {sendResult.wamid}
                    </p>
                  )}
                  <pre className="max-h-60 overflow-auto rounded bg-black/90 p-3 text-xs text-emerald-400 font-mono">
                    {JSON.stringify(sendResult.raw ?? sendResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CARD 5 - Templates Oficiais */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Templates Oficiais do WhatsApp (HSM)</CardTitle>
              <CardDescription>
                Selecione um dos modelos aprovados na sua conta WhatsApp Business na Meta para enviar mensagens fora da janela de 24 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Selecione um Template Aprovado</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Selecione um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} ({t.language}) — {t.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone do Destinatário</Label>
                <Input
                  placeholder="Ex: 5511999999999"
                  value={templatePhone}
                  onChange={(e) => setTemplatePhone(e.target.value)}
                />
              </div>

              <Button
                onClick={() => sendTemplateTest({ to: templatePhone, templateName: selectedTemplate })}
                disabled={isSendingTemplate || !templatePhone}
                className="gap-2"
              >
                {isSendingTemplate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCode2 className="h-4 w-4" />
                )}
                Enviar Template de Teste
              </Button>

              {sendTemplateResult && (
                <div className="mt-4 rounded-xl border bg-muted p-4">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <span>Retorno da Meta Cloud API (HTTP {sendTemplateResult.status}):</span>
                    <span>Tempo: {sendTemplateResult.duracaoMs} ms</span>
                  </div>
                  <pre className="max-h-60 overflow-auto rounded bg-black/90 p-3 text-xs text-emerald-400 font-mono">
                    {JSON.stringify(sendTemplateResult.raw ?? sendTemplateResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CARD 6 - Monitoramento */}
        <TabsContent value="monitoramento" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de Mensagens</CardDescription>
                <CardTitle className="text-2xl">{metrics?.total ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Enviadas / Entregues</CardDescription>
                <CardTitle className="text-2xl text-blue-600">
                  {metrics?.enviadas ?? 0} / {metrics?.entregues ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Lidas / Respostas</CardDescription>
                <CardTitle className="text-2xl text-emerald-600">
                  {metrics?.lidas ?? 0} / {metrics?.recebidas ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Falhas de Envio</CardDescription>
                <CardTitle className="text-2xl text-red-600">{metrics?.falhas ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho da API Meta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Tempo Médio de Envio</p>
                  <p className="text-lg font-bold">{metrics?.tempoMedioMs ?? 0} ms</p>
                </div>
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Último Envio Registrado</p>
                  <p className="text-sm font-semibold">
                    {metrics?.ultimoEnvio
                      ? new Date(metrics.ultimoEnvio).toLocaleString("pt-BR")
                      : "Nenhum disparo recente"}
                  </p>
                </div>
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CARD 7 - Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Histórico de Logs das Mensagens</CardTitle>
                <CardDescription>
                  Histórico completo de mensagens via Meta Cloud API com wamid e respostas.
                </CardDescription>
              </div>
              <Input
                placeholder="Buscar por telefone, mensagem..."
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                className="md:w-64"
              />
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="grid place-items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="grid place-items-center py-12 text-sm text-muted-foreground">
                  Nenhum log encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm md:flex-row md:items-start md:justify-between"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {log.paciente_nome || log.profissional_nome || log.destinatario_telefone || "Contato"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.status_envio}
                          </Badge>
                          {log.template_name && (
                            <Badge variant="secondary" className="text-xs">
                              {log.template_name}
                            </Badge>
                          )}
                        </div>

                        <p className="text-muted-foreground whitespace-pre-line text-xs font-mono bg-muted/50 p-2 rounded-lg">
                          {log.mensagem}
                        </p>

                        {log.mensagem_recebida && (
                          <div className="rounded-lg bg-emerald-500/10 p-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            <strong>Resposta recebida:</strong> {log.mensagem_recebida}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Data: {new Date(log.created_at).toLocaleString("pt-BR")}</span>
                          <span>Telefone: {log.destinatario_telefone}</span>
                          {log.wamid && <span className="font-mono text-[11px]">WAMID: {log.wamid}</span>}
                          {log.duracao_ms && <span>Duração: {log.duracao_ms} ms</span>}
                        </div>

                        {log.ultimo_erro && (
                          <p className="text-xs text-red-600 dark:text-red-400">Erro: {log.ultimo_erro}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
