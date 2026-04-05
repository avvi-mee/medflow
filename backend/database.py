import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings

# Ensure SQLite directory exists
db_url = settings.database_url
if "sqlite" in db_url:
    db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
    db_dir = os.path.dirname(os.path.abspath(db_path)) if db_path else "."
    os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Patient, BloodTest, AuditLog, PreviousVisit  # noqa: F401
    Base.metadata.create_all(bind=engine)
