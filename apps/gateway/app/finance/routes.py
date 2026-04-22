from fastapi import APIRouter, HTTPException
import yfinance as yf

finance_router = APIRouter(prefix="/finance", tags=["Finance"])

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
