from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.job import JobCreateRequest, JobListResponse, JobResponse, JobStatusUpdateRequest
from app.services.jobs import create_job, get_job_by_id, list_jobs, update_job_status

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job",
)
def create_job_endpoint(payload: JobCreateRequest, db: Session = Depends(get_db)) -> JobResponse:
    job = create_job(db=db, payload=payload)
    return JobResponse.model_validate(job)


@router.get(
    "",
    response_model=JobListResponse,
    summary="List jobs",
)
def list_jobs_endpoint(db: Session = Depends(get_db)) -> JobListResponse:
    jobs = list_jobs(db=db)
    return JobListResponse(items=[JobResponse.model_validate(job) for job in jobs])


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job by ID",
)
def get_job_endpoint(job_id: UUID, db: Session = Depends(get_db)) -> JobResponse:
    job = get_job_by_id(db=db, job_id=job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@router.patch(
    "/{job_id}/status",
    response_model=JobResponse,
    summary="Update job status",
)
def update_job_status_endpoint(
    job_id: UUID,
    payload: JobStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> JobResponse:
    job = update_job_status(db=db, job_id=job_id, payload=payload)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)