import uuid
import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def seed_db():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if we already have meetings
    if db.query(models.Meeting).count() > 0:
        print("Database already seeded.")
        return

    meeting1 = models.Meeting(
        id=str(uuid.uuid4()),
        title="Daily Standup",
        description="Daily team sync",
        scheduled_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        duration=30,
    )
    meeting1.invite_link = f"http://localhost:3000/join/{meeting1.id}"
    
    meeting2 = models.Meeting(
        id=str(uuid.uuid4()),
        title="Project Review",
        description="Review project milestones",
        scheduled_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        duration=60,
    )
    meeting2.invite_link = f"http://localhost:3000/join/{meeting2.id}"

    db.add(meeting1)
    db.add(meeting2)
    db.commit()
    print("Database seeded with sample meetings!")
    db.close()

if __name__ == "__main__":
    seed_db()
