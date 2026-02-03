from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class AlarmRecord(Base):
    __tablename__ = "alarm_records"

    id = Column(Integer, primary_key=True, index=True)
    alarm_type = Column(String(50)) # e.g., "FENCE_ENTRY", "SOS", "HELMET_OFF"
    severity = Column(String(20)) # LOW, MEDIUM, HIGH
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(String(255))
    status = Column(String(20), default="pending") # pending, resolved
    handled_at = Column(DateTime, nullable=True)
    location = Column(String(100), nullable=True) # e.g. "Zone A"

    recording_path = Column(String(255), nullable=True) 
    recording_status = Column(String(20), default="pending")
    recording_error = Column(String(255), nullable=True)
    
    # Relationships
    device_id = Column(String(50), index=True)
    # device = relationship("Device", back_populates="alarms")
    
    fence_id = Column(Integer, ForeignKey("electronic_fences.id"), nullable=True)
