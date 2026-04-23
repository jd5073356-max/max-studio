// Cliente ligero para Supabase sin dependencias externas
// Usa PostgREST (API REST nativa de Supabase) via fetch

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// Funcion generica para consultar tablas via PostgREST
async function query<T>(table: string, params?: string): Promise<T[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? `?${params}` : ""}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    console.error(`Supabase query error [${table}]:`, res.statusText);
    return [];
  }
  return res.json();
}

// --- Tipos ---

export interface FinanceProject {
  id: string;
  name: string;
  description: string | null;
  monthly_income: number;
  currency: string;
  status: string;
  recurrence: string;
  start_date: string | null;
  end_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpenseCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  budget_limit: number;
  created_at: string;
}

export interface FinanceExpense {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  is_recurring: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FinanceAccount {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  currency: string;
  icon: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FinanceSnapshot {
  id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  total_liquidity: number;
  portfolio_value: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Queries publicas ---

export function getProjects(status?: string) {
  const params = status
    ? `status=eq.${status}&order=created_at.desc`
    : "order=created_at.desc";
  return query<FinanceProject>("finance_projects", params);
}

export function getExpenseCategories() {
  return query<FinanceExpenseCategory>("finance_expense_categories", "order=name.asc");
}

export function getExpenses(limit = 50) {
  return query<FinanceExpense>("finance_expenses", `order=expense_date.desc&limit=${limit}`);
}

export function getAccounts() {
  return query<FinanceAccount>("finance_accounts", "order=balance.desc");
}

export function getSnapshots() {
  return query<FinanceSnapshot>("finance_monthly_snapshots", "order=month.asc");
}

export interface FinanceLedgerEntry {
  id: string;
  entity_id: string;
  entity_type: string;
  amount: number;
  currency: string;
  recorded_at: string;
  metadata: Record<string, unknown>;
}

export function getEntityHistory(entityId: string, entityType: string, period?: string) {
  const params = `entity_id=eq.${entityId}&entity_type=eq.${entityType}&order=recorded_at.asc`;
  return query<FinanceLedgerEntry>("finance_ledger", params);
}
