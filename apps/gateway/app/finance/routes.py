from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
import yfinance as yf

from app.core.supabase import SupabaseRest

finance_router = APIRouter(prefix="/finance", tags=["Finance"])


# ── Estado financiero para MAX ────────────────────────────────────────────────

async def get_finance_state() -> dict:
    """Retorna el estado actual de finanzas desde Supabase (para system prompt)."""
    sb = SupabaseRest()
    try:
        projects, accounts, categories = await _fetch_all(sb)
    except Exception:
        return {}
    return {"projects": projects, "accounts": accounts, "categories": categories}


async def _fetch_all(sb: SupabaseRest):
    import asyncio
    return await asyncio.gather(
        sb.select_many("finance_projects", columns="id,name,monthly_income,status,currency,metadata"),
        sb.select_many("finance_accounts", columns="id,name,account_type,balance,currency,institution"),
        sb.select_many("finance_expense_categories", columns="id,name,budget_limit,color"),
    )


# ── Endpoint de acción (ejecutado por el parser de ws.py) ────────────────────

class FinanceActionRequest(BaseModel):
    action: str
    payload: dict[str, Any]


@finance_router.post("/action")
async def execute_finance_action(req: FinanceActionRequest):
    sb = SupabaseRest()
    action = req.action
    p = req.payload

    if action == "update_account":
        account_id = p.pop("id")
        await sb.update("finance_accounts", account_id, p)
        return {"ok": True, "action": action, "id": account_id}

    elif action == "update_project":
        project_id = p.pop("id")
        await sb.update("finance_projects", project_id, p)
        return {"ok": True, "action": action, "id": project_id}

    elif action == "add_ledger":
        # Mapear "note" → "metadata" si viene del modelo
        if "note" in p:
            p.setdefault("metadata", {})["note"] = p.pop("note")
        p.setdefault("currency", "COP")
        await sb.insert("finance_ledger", p, returning=False)
        return {"ok": True, "action": action}

    elif action == "create_expense_category":
        row = await sb.insert("finance_expense_categories", p)
        return {"ok": True, "action": action, "id": (row or {}).get("id")}

    elif action == "update_expense_category":
        cat_id = p.pop("id")
        await sb.update("finance_expense_categories", cat_id, p)
        return {"ok": True, "action": action, "id": cat_id}

    raise HTTPException(status_code=400, detail=f"Acción desconocida: {action}")

@finance_router.get("/budgets")
async def get_budgets_prediction() -> list[dict]:
    """Retorna categorías de gasto con % consumido y fecha predicha de agotamiento."""
    sb = SupabaseRest()
    categories = await sb.select_many(
        "finance_expense_categories", columns="id,name,budget_limit,color"
    )
    now = datetime.now(timezone.utc)
    day_of_month = now.day or 1

    ledger_rows = await sb.select_many(
        "finance_ledger",
        columns="entity_id,amount",
        filters={"entity_type": "category"},
    )
    totals: dict[str, float] = {}
    for row in ledger_rows:
        eid = row["entity_id"]
        totals[eid] = totals.get(eid, 0.0) + float(row.get("amount", 0))

    result = []
    for cat in categories:
        limit = float(cat["budget_limit"]) or 1.0
        spent = totals.get(cat["id"], 0.0)
        pct = min(100.0, round((spent / limit) * 100, 1))
        remaining = limit - spent

        daily_burn = spent / day_of_month if day_of_month > 0 else 0.0
        if daily_burn > 0 and remaining > 0:
            days_left = int(remaining / daily_burn)
            depleted_date = now.replace(
                day=min(now.day + days_left, 28)
            ).strftime("%d/%m/%Y")
        elif remaining <= 0:
            depleted_date = "Agotado"
        else:
            depleted_date = "Sin datos"

        result.append({
            "id": cat["id"],
            "name": cat["name"],
            "color": cat["color"],
            "budget_limit": limit,
            "current_spend": spent,
            "pct": pct,
            "remaining": remaining,
            "daily_burn": round(daily_burn, 0),
            "depleted_date": depleted_date,
        })
    return result


@finance_router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        if not hasattr(info, 'last_price'):
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        last_price = info.last_price
        prev_close = info.previous_close
        change = last_price - prev_close
        change_percent = (change / prev_close) * 100 if prev_close else 0
        
        return {
            "symbol": symbol.upper(),
            "price": round(last_price, 2),
            "change": round(change, 2),
            "changePercent": round(change_percent, 2),
            "volume": info.last_volume,
            "dayHigh": info.day_high,
            "dayLow": info.day_low
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@finance_router.get("/history/{symbol}")
async def get_history(symbol: str, period: str = "1mo", interval: str = "1d"):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            raise HTTPException(status_code=404, detail="No historical data found")
        
        hist = hist.reset_index()
        data = []
        for _, row in hist.iterrows():
            date_col = row.keys()[0]
            data.append({
                "date": str(row[date_col].date() if hasattr(row[date_col], 'date') else row[date_col]),
                "close": round(row["Close"], 2)
            })
        
        return {"symbol": symbol.upper(), "history": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
