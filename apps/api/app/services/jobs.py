from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.schemas.job import JobCreateRequest, JobStatusUpdateRequest


VALID_TRANSITIONS: dict[JobStatus, set[JobStatus]] = {
    JobStatus.QUEUED: {JobStatus.PROCESSING, JobStatus.EXPIRED, JobStatus.FAILED},
    JobStatus.PROCESSING: {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.EXPIRED},
    JobStatus.COMPLETED: set(),
    JobStatus.FAILED: set(),
    JobStatus.EXPIRED: set(),
}


def create_job(db: Session, payload: JobCreateRequest) -> Job:
    job = Job(
        status=JobStatus.QUEUED,
        preset=payload.preset,
        input_metadata=payload.input_metadata,
        output_count=payload.output_count,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc())
    return list(db.scalars(stmt).all())


def get_job_by_id(db: Session, job_id: UUID) -> Job | None:
    return db.get(Job, job_id)


def update_job_status(db: Session, job_id: UUID, payload: JobStatusUpdateRequest) -> Job | None:
    job = db.get(Job, job_id)
    if job is None:
        return None

    new_status = JobStatus(payload.status)

    if new_status not in VALID_TRANSITIONS[job.status]:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail=f"Invalid status transition: {job.status.value} -> {new_status.value}",
        )

    if new_status == JobStatus.COMPLETED and payload.error is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Completed jobs cannot include an error")

    if new_status == JobStatus.FAILED and not payload.error:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Failed jobs must include an error")

    job.status = new_status
    job.processing_time_ms = payload.processing_time_ms
    job.error = payload.error

    db.add(job)
    db.commit()
    db.refresh(job)
    return job