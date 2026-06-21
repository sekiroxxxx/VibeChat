"""POST /api/sessions · GET /:id · POST /:id/leave · POST /:id/report"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/api/sessions")
async def create_session():
    raise NotImplementedError


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    raise NotImplementedError


@router.post("/api/sessions/{session_id}/leave")
async def leave_session(session_id: str):
    raise NotImplementedError


@router.post("/api/sessions/{session_id}/report")
async def report_session(session_id: str):
    raise NotImplementedError
