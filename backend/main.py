"""
CROPIC Backend API — Full 17-Step Flow
"""

from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine as db_engine, get_db, Base
from models import User, Submission, Claim

from schemas import (
    LoginRequest,
    LoginResponse,
    UserOut,
    SubmissionCreate,
    SubmissionOut,
    ClaimCreate,
    ClaimReview,
    ClaimOut,
)

from auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_official,
    normalize_role,
)

from ai_engine import engine as ai_engine


# =====================================================
# DB INIT
# =====================================================

Base.metadata.create_all(bind=db_engine)


# =====================================================
# APP
# =====================================================

app = FastAPI(
    title="CROPIC API",
    description="PMFBY Crop Monitoring — Full Flow",
    version="2.0.0",
)


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Change later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# HEALTH
# =====================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "time": datetime.utcnow()
    }


# =====================================================
# AUTH
# =====================================================

@app.post("/api/auth/register", response_model=UserOut)
def register(
    username: str,
    password: str,
    full_name: str,
    role: str = "farmer",
    district: Optional[str] = None,
    state: Optional[str] = None,
    aadhaar_id: Optional[str] = None,
    db: Session = Depends(get_db),
):

    existing_user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        role=normalize_role(role),
        district=district,
        state=state,
        aadhaar_id=aadhaar_id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post("/api/auth/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):

    user = (
        db.query(User)
        .filter(User.username == payload.username)
        .first()
    )

    if not user or not verify_password(
        payload.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_token(user.id)

    return LoginResponse(
        token=token,
        user_id=user.id,
        full_name=user.full_name,
        role=normalize_role(user.role),
    )


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=normalize_role(user.role),
        district=user.district,
        state=user.state,
    )


# =====================================================
# SUBMISSION (AI FLOW)
# =====================================================

@app.post("/api/submit", response_model=SubmissionOut)
def submit_image(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    rejection_reason = None

    # GPS validation
    if payload.latitude and payload.longitude:
        if not (
            6.5 <= payload.latitude <= 37.1
            and
            68.1 <= payload.longitude <= 97.4
        ):
            rejection_reason = "Outside India"

    # Image validation
    if payload.image_base64 and len(payload.image_base64) < 500:
        rejection_reason = "Invalid image"

    ai_result = {}

    status = (
        "rejected"
        if rejection_reason
        else "assessed"
    )

    if not rejection_reason:
        ai_result = ai_engine.analyse(
            payload.image_base64,
            payload.growth_stage
        )

    damage = ai_result.get("damage_type", "none")

    prediction_label = (
        "healthy"
        if damage == "none"
        else "diseased"
    )

    sub = Submission(
        user_id=user.id,
        farmer_name=user.full_name,
        crop_type=payload.crop_type,
        growth_stage=payload.growth_stage,
        latitude=payload.latitude,
        longitude=payload.longitude,
        image_base64=payload.image_base64,
        status=status,
        rejection_reason=rejection_reason,
        prediction_label=prediction_label,
        damage_type=ai_result.get("damage_type"),
        severity_score=ai_result.get("severity_score"),
        yield_loss_pct=ai_result.get("yield_loss_pct"),
    )

    db.add(sub)
    db.commit()
    db.refresh(sub)

    return sub


@app.get("/api/submissions", response_model=list[SubmissionOut])
def list_submissions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    return (
        db.query(Submission)
        .filter(Submission.user_id == user.id)
        .all()
    )


# =====================================================
# CLAIMS
# =====================================================

@app.post("/api/claims", response_model=ClaimOut)
def create_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    sub = (
        db.query(Submission)
        .filter(Submission.id == payload.submission_id)
        .first()
    )

    if not sub:
        raise HTTPException(
            status_code=404,
            detail="Submission not found"
        )

    claim = Claim(
        submission_id=sub.id,
        user_id=user.id,
        damage_description=payload.damage_description,
        estimated_loss_inr=payload.estimated_loss_inr,
        status="pending",
    )

    db.add(claim)
    db.commit()
    db.refresh(claim)

    return claim


@app.get("/api/claims", response_model=list[ClaimOut])
def list_claims(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    return (
        db.query(Claim)
        .filter(Claim.user_id == user.id)
        .all()
    )


# =====================================================
# OFFICIAL REVIEW
# =====================================================

# =====================================================
# OFFICIAL REVIEW
# =====================================================

@app.get("/api/official/claims")
def official_claims(
    status: str = "all",
    db: Session = Depends(get_db),
    official: User = Depends(require_official),  # ← official only
):
    q = db.query(Claim, Submission, User)\
        .join(Submission, Claim.submission_id == Submission.id)\
        .join(User, Claim.user_id == User.id)

    if status != "all":
        q = q.filter(Claim.status == status)

    rows = q.order_by(Claim.created_at.desc()).all()

    return [{
        "claim_id":            c.id,
        "claim_status":        c.status,
        "damage_description":  c.damage_description,
        "estimated_loss_inr":  c.estimated_loss_inr,
        "review_notes":        c.review_notes,
        "reviewed_at":         str(c.reviewed_at) if c.reviewed_at else None,
        "created_at":          str(c.created_at),
        # submission info
        "submission_id":       s.id,
        "crop_type":           s.crop_type,
        "growth_stage":        s.growth_stage,
        "prediction_label":    s.prediction_label,
        "damage_type":         s.damage_type,
        "severity_score":      s.severity_score,
        "yield_loss_pct":      s.yield_loss_pct,
        "district":            s.district if hasattr(s, 'district') else None,
        "latitude":            s.latitude,
        "longitude":           s.longitude,
        # farmer info
        "farmer_name":         u.full_name,
        "farmer_username":     u.username,
    } for c, s, u in rows]

@app.post("/api/claims/{cid}/review", response_model=ClaimOut)
def review_claim(
    cid: int,
    payload: ClaimReview,
    db: Session = Depends(get_db),
    official: User = Depends(require_official),
):

    claim = (
        db.query(Claim)
        .filter(Claim.id == cid)
        .first()
    )

    if not claim:
        raise HTTPException(
            status_code=404,
            detail="Claim not found"
        )

    claim.status = (
        "approved"
        if payload.action == "approve"
        else "rejected"
    )

    claim.review_notes = payload.review_notes
    claim.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(claim)

    return claim


# =====================================================
# STATS
# =====================================================

@app.get("/api/stats")
def stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Submission.id)).scalar()
    assessed = db.query(func.count(Submission.id)).filter(Submission.status == "assessed").scalar()
    pending = db.query(func.count(Submission.id)).filter(Submission.status == "pending").scalar()
    rejected = db.query(func.count(Submission.id)).filter(Submission.status == "rejected").scalar()

    total_claims = db.query(func.count(Claim.id)).scalar()
    claims_pending = db.query(func.count(Claim.id)).filter(Claim.status == "pending").scalar()
    claims_approved = db.query(func.count(Claim.id)).filter(Claim.status == "approved").scalar()
    claims_rejected = db.query(func.count(Claim.id)).filter(Claim.status == "rejected").scalar()

    avg_sev = db.query(func.avg(Submission.severity_score)).filter(Submission.status == "assessed").scalar()
    avg_loss = db.query(func.avg(Submission.yield_loss_pct)).filter(Submission.status == "assessed").scalar()

    damage_rows = db.query(
        Submission.damage_type,
        func.count(Submission.id)
    ).filter(Submission.status == "assessed").group_by(Submission.damage_type).all()
    damage_breakdown = {r[0] or "unknown": r[1] for r in damage_rows}

    district_rows = db.query(
        Submission.district if hasattr(Submission, 'district') else Submission.crop_type,
        func.count(Submission.id).label("count"),
        func.avg(Submission.severity_score).label("avg_sev"),
        func.avg(Submission.yield_loss_pct).label("avg_loss"),
        func.avg(Submission.latitude).label("lat"),
        func.avg(Submission.longitude).label("lng"),
    ).group_by(
        Submission.district if hasattr(Submission, 'district') else Submission.crop_type
    ).all()

    district_breakdown = [{
        "district": r[0] or "Unknown",
        "count": r[1],
        "avg_severity": round(r[2], 1) if r[2] else None,
        "avg_yield_loss": round(r[3], 1) if r[3] else None,
        "lat": round(r[4], 4) if r[4] else None,
        "lng": round(r[5], 4) if r[5] else None,
    } for r in district_rows]

    return {
        "total_submissions": total,
        "assessed": assessed,
        "pending": pending,
        "rejected": rejected,
        "total_claims": total_claims,
        "claims_pending": claims_pending,
        "claims_approved": claims_approved,
        "claims_rejected": claims_rejected,
        "avg_severity": round(avg_sev, 1) if avg_sev else None,
        "avg_yield_loss": round(avg_loss, 1) if avg_loss else None,
        "damage_breakdown": damage_breakdown,
        "district_breakdown": district_breakdown,
    }