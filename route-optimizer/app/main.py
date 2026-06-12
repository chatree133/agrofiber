import logging
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

from app.models import OptimizeRequest, OptimizeResponse
from app.optimizer import solve_vrp

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vehicle Routing & Load Optimization API",
    description="Optimal routing and loading planner using Google OR-Tools and FastAPI.",
    version="1.0.0"
)

# Add CORS Middleware to support frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Diagnostic"])
def health():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "route-optimizer"}

@app.post("/optimize", response_model=OptimizeResponse, tags=["Optimization"])
def optimize(payload: OptimizeRequest):
    """
    Solves Capacitated Vehicle Routing Problem (CVRP).
    Accepts depot coordinates, fleet list, and delivery orders.
    Returns optimized vehicle routes, load assignments, and total distances.
    """
    try:
        logger.info("Solving routing optimization...")
        response = solve_vrp(payload)
        logger.info(f"Optimization finished. Status: {response.status}")
        return response
    except Exception as e:
        logger.exception("Uncaught exception during VRP solve")
        raise HTTPException(
            status_code=500,
            detail=f"Optimization solver failed: {str(e)}"
        )
