from pydantic import BaseModel

class DeviceBase(BaseModel):
    id: str
    device_name: str
    device_type: str | None = "HELMET_CAM"
    ip_address: str
    port: int | None = 8000
    stream_url: str | None = None
    owner_id: int | None = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    device_name: str | None = None
    device_type: str | None = None
    ip_address: str | None = None
    port: int | None = None
    stream_url: str | None = None
    is_online: bool | None = None
    owner_id: int | None = None
    last_latitude: float | None = None
    last_longitude: float | None = None

class DeviceOut(DeviceBase):
    is_online: bool
    last_latitude: float | None = None
    last_longitude: float | None = None
    
    class Config:
        from_attributes=True
