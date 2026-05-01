"""Pydantic models for HoustonLab OS."""
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- USER ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    email: EmailStr
    name: Optional[str] = None
    role: str = "admin"
    is_active: bool = True
    last_login_at: Optional[str] = None
    created_at: str


class UserCreatePayload(BaseModel):
    username: str
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: str = "collaborator"  # admin | collaborator | spectator
    is_active: bool = True


class UserUpdatePayload(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminResetPasswordPayload(BaseModel):
    new_password: str


class LoginPayload(BaseModel):
    identifier: str  # username or email
    password: str
    remember: bool = False


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdatePayload(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None


# ---------- CLIENT ----------
class ClientIn(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    trust_notes: Optional[str] = None


class Client(ClientIn):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


# ---------- DEVICE ----------
class DeviceIn(BaseModel):
    name: str
    device_type: str  # Desktop PC, Laptop, Console, iPhone, etc.
    brand: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    client_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "Active"
    photos: List[str] = []
    # Optional hardware specs (PC)
    specs: Dict[str, Any] = {}


class Device(DeviceIn):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


# ---------- TEMPLATE ----------
class CustomFieldDef(BaseModel):
    key: str
    label: str
    type: str  # text, textarea, number, date, checkbox, select, multiselect, url, file, secret
    required: bool = False
    options: List[str] = []
    placeholder: Optional[str] = None


class JobTemplate(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str
    description: Optional[str] = None
    fields: List[CustomFieldDef] = []
    checklist: List[str] = []
    timeline_types: List[str] = []
    attachment_categories: List[str] = []
    supports_devices: bool = True
    supports_secrets: bool = False
    is_predefined: bool = False
    created_at: str = Field(default_factory=now_iso)


# ---------- JOB ----------
class ChecklistItem(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    done: bool = False
    note: Optional[str] = None
    completed_at: Optional[str] = None


class TimelineEntry(BaseModel):
    id: str = Field(default_factory=new_id)
    type: str = "Note"  # Note, Diagnosis, Repair, Part Installed, Test, Customer Update, Payment, Problem
    text: str
    customer_visible: bool = False
    created_at: str = Field(default_factory=now_iso)
    attachment_id: Optional[str] = None


class Attachment(BaseModel):
    id: str = Field(default_factory=new_id)
    filename: str
    original_name: str
    mime: str
    size: int
    category: Optional[str] = None
    caption: Optional[str] = None
    url: str
    created_at: str = Field(default_factory=now_iso)


class FinanceInfo(BaseModel):
    labor_price: float = 0
    parts_price: float = 0
    discount: float = 0
    # Internal cost tracking (never shown to customers / spectators).
    parts_cost: float = 0
    other_costs: float = 0
    currency: str = "CZK"
    payment_status: str = "Unpaid"  # Unpaid, Partial, Paid
    payment_method: Optional[str] = None  # Cash, Bank Transfer, Card, Other
    payment_date: Optional[str] = None
    payment_note: Optional[str] = None
    paid_amount: float = 0


class SecretItem(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str
    encrypted_value: str  # AES-GCM ciphertext (base64)
    created_at: str = Field(default_factory=now_iso)


class JobIn(BaseModel):
    title: str
    template_id: Optional[str] = None
    category: str
    status: str = "New"
    priority: str = "Normal"
    client_id: Optional[str] = None
    device_id: Optional[str] = None
    received_date: Optional[str] = None
    deadline: Optional[str] = None
    completed_date: Optional[str] = None
    description: Optional[str] = None
    internal_notes: Optional[str] = None
    customer_summary: Optional[str] = None
    tags: List[str] = []
    custom_fields: Dict[str, Any] = {}
    checklist: List[ChecklistItem] = []
    finance: FinanceInfo = Field(default_factory=FinanceInfo)


class Job(JobIn):
    id: str = Field(default_factory=new_id)
    code: str = ""  # human-readable e.g. HL-0001
    timeline: List[TimelineEntry] = []
    attachments: List[Attachment] = []
    secrets: List[SecretItem] = []
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class TimelineEntryIn(BaseModel):
    type: str = "Note"
    text: str
    customer_visible: bool = False
    attachment_id: Optional[str] = None


class ChecklistItemIn(BaseModel):
    text: str
    note: Optional[str] = None
    done: bool = False


class SecretIn(BaseModel):
    label: str
    value: str


# ---------- SETTINGS ----------
class Settings(BaseModel):
    brand_name: str = "HoustonLab"
    accent_color: str = "#34D399"
    currency: str = "CZK"
    logo_url: Optional[str] = None
    updated_at: str = Field(default_factory=now_iso)
