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
